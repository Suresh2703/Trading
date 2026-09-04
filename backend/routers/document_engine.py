"""Shared logic for line-item documents (sales and purchases).

Sales and purchase documents are the same machine pointed in opposite
directions: a header, a set of priced lines, a document chain, and — for the
types that move goods — stock movements posted from those lines. Everything
that does not depend on which side of the trade you are on lives here, so a bug
fixed for one module is fixed for both.

A `DocumentSpec` supplies the parts that do differ.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import Optional, List

import crud, models
from routers.stock_movements import available_stock

STATUSES = {"DRAFT", "CONFIRMED", "CANCELLED"}


class DocumentSpec:
    """Everything that differs between the sales and purchase modules."""

    def __init__(self, *, model, line_model, party_model, party_field,
                 party_label, doc_types, stock_effect, allowed_parents,
                 source_column):
        self.model = model
        self.line_model = line_model
        self.party_model = party_model
        self.party_field = party_field        # "customer_id" | "supplier_id"
        self.party_label = party_label        # "customer"    | "supplier"
        self.doc_types = doc_types
        self.stock_effect = stock_effect      # {doc_type: "IN" | "OUT"}
        self.allowed_parents = allowed_parents
        # Which stock_movements column links a movement back to this module.
        self.source_column = source_column    # "source_document_id" | "source_purchase_id"


def pretty(doc_type: str) -> str:
    return doc_type.replace("_", " ").title()


# --- Validation ------------------------------------------------------------

def validate_header(db: Session, spec: DocumentSpec, doc_type: str,
                    data: dict, doc_id: Optional[int] = None):
    if doc_type not in spec.doc_types:
        raise HTTPException(
            status_code=400,
            detail=f"doc_type must be one of {', '.join(sorted(spec.doc_types))}"
        )

    if not (data.get("doc_no") or "").strip():
        raise HTTPException(status_code=400, detail="Document number is required")

    status = (data.get("status") or "DRAFT").upper()
    if status not in STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"status must be one of {', '.join(sorted(STATUSES))}"
        )

    if crud.get_one(db, spec.party_model, data.get(spec.party_field)) is None:
        raise HTTPException(
            status_code=400,
            detail=f"Selected {spec.party_label} does not exist"
        )

    if doc_type in spec.stock_effect:
        warehouse_id = data.get("warehouse_id")
        if not warehouse_id:
            raise HTTPException(
                status_code=400,
                detail=f"{pretty(doc_type)} needs a warehouse, because it moves stock"
            )
        if crud.get_one(db, models.Warehouse, warehouse_id) is None:
            raise HTTPException(
                status_code=400, detail="Selected warehouse does not exist")

    parent_id = data.get("parent_id")
    if parent_id:
        if parent_id == doc_id:
            raise HTTPException(status_code=400, detail="A document cannot reference itself")
        parent = crud.get_one(db, spec.model, parent_id)
        if parent is None:
            raise HTTPException(status_code=400, detail="Linked document does not exist")
        allowed = spec.allowed_parents.get(doc_type, set())
        if parent.doc_type not in allowed:
            names = ', '.join(sorted(allowed)) if allowed else 'nothing'
            raise HTTPException(
                status_code=400,
                detail=f"{pretty(doc_type)} can only be raised against: {names}"
            )


def validate_lines(db: Session, lines: List):
    if not lines:
        raise HTTPException(status_code=400, detail="Add at least one line item")
    for idx, line in enumerate(lines, start=1):
        if crud.get_one(db, models.Product, line.product_id) is None:
            raise HTTPException(status_code=400, detail=f"Line {idx}: product does not exist")
        if (line.quantity or 0) <= 0:
            raise HTTPException(status_code=400, detail=f"Line {idx}: quantity must be greater than zero")
        if (line.unit_price or 0) < 0:
            raise HTTPException(status_code=400, detail=f"Line {idx}: unit price cannot be negative")
        if not (0 <= (line.discount_pct or 0) <= 100):
            raise HTTPException(status_code=400, detail=f"Line {idx}: discount must be between 0 and 100")
        if line.tax_id and crud.get_one(db, models.Tax, line.tax_id) is None:
            raise HTTPException(status_code=400, detail=f"Line {idx}: tax rate does not exist")


def validate_stock(db: Session, spec: DocumentSpec, doc_type: str, status: str,
                   warehouse_id: int, lines: List, doc_id: Optional[int] = None):
    """Stock leaving a warehouse must actually be there.

    Only applies to the outbound types (a delivery, a purchase return).
    Quantities are summed per product first, so two lines of the same product
    are checked against the balance together rather than each in isolation.
    """
    if spec.stock_effect.get(doc_type) != "OUT" or status == "CANCELLED":
        return

    wanted = {}
    for line in lines:
        wanted[line.product_id] = wanted.get(line.product_id, 0.0) + (line.quantity or 0.0)

    for product_id, qty in wanted.items():
        on_hand = available_stock(
            db, product_id, warehouse_id,
            exclude_source_document_id=doc_id if spec.source_column == "source_document_id" else None,
            exclude_source_purchase_id=doc_id if spec.source_column == "source_purchase_id" else None,
        )
        if qty > on_hand:
            product = crud.get_one(db, models.Product, product_id)
            ticker = product.ticker if product else f"#{product_id}"
            warehouse = crud.get_one(db, models.Warehouse, warehouse_id)
            where = warehouse.name if warehouse else f"warehouse #{warehouse_id}"
            raise HTTPException(
                status_code=400,
                detail=(f"Only {on_hand:g} of {ticker} available at {where}, "
                        f"cannot move {qty:g}.")
            )


# --- Stock posting ---------------------------------------------------------

def sync_stock_movements(db: Session, spec: DocumentSpec, doc):
    """Make this document's stock movements match its lines exactly.

    Rather than diffing, the document's own movements are cleared and rewritten
    — the document is the source of truth, so there is no partial-update state
    to get wrong.
    """
    source_col = getattr(models.StockMovement, spec.source_column)
    db.query(models.StockMovement).filter(source_col == doc.id).delete(
        synchronize_session=False
    )

    direction = spec.stock_effect.get(doc.doc_type)
    if direction is None or doc.status == "CANCELLED":
        db.commit()
        return

    party_kwargs = {spec.party_field: getattr(doc, spec.party_field)}
    for line in doc.lines:
        movement = models.StockMovement(
            movement_type=direction,
            product_id=line.product_id,
            quantity=line.quantity,
            unit_cost=line.unit_price,
            from_warehouse_id=doc.warehouse_id if direction == "OUT" else None,
            to_warehouse_id=doc.warehouse_id if direction == "IN" else None,
            reference_no=doc.doc_no,
            movement_date=doc.doc_date,
            remarks=f"Auto-posted from {pretty(doc.doc_type)} {doc.doc_no}",
            source_line_id=line.id,
            **party_kwargs,
        )
        setattr(movement, spec.source_column, doc.id)
        db.add(movement)
    db.commit()


# --- Shared CRUD bodies ----------------------------------------------------

def create_document(db: Session, spec: DocumentSpec, payload):
    doc_type = (payload.doc_type or "").upper()
    data = payload.model_dump(exclude={"lines"})
    data["doc_type"] = doc_type
    data["status"] = (data.get("status") or "DRAFT").upper()

    validate_header(db, spec, doc_type, data)
    validate_lines(db, payload.lines)
    validate_stock(db, spec, doc_type, data["status"], data.get("warehouse_id"),
                   payload.lines)

    doc = spec.model(**data)
    for line in payload.lines:
        doc.lines.append(spec.line_model(**line.model_dump()))
    db.add(doc)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"{pretty(doc_type)} '{payload.doc_no}' already exists"
        )
    db.refresh(doc)
    sync_stock_movements(db, spec, doc)
    db.refresh(doc)
    return doc


def update_document(db: Session, spec: DocumentSpec, doc_id: int, payload, line_schema):
    doc = crud.get_one(db, spec.model, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    patch = payload.model_dump(exclude_unset=True, exclude={"lines"})
    data = {
        "doc_no": doc.doc_no,
        "doc_date": doc.doc_date,
        spec.party_field: getattr(doc, spec.party_field),
        "parent_id": doc.parent_id,
        "warehouse_id": doc.warehouse_id,
        "status": doc.status,
    }
    data.update(patch)
    data["status"] = (data.get("status") or "DRAFT").upper()

    validate_header(db, spec, doc.doc_type, data, doc_id=doc_id)

    lines = payload.lines if payload.lines is not None else [
        line_schema(
            product_id=l.product_id, quantity=l.quantity, unit_price=l.unit_price,
            discount_pct=l.discount_pct, tax_id=l.tax_id, remarks=l.remarks
        ) for l in doc.lines
    ]
    validate_lines(db, lines)
    validate_stock(db, spec, doc.doc_type, data["status"], data.get("warehouse_id"),
                   lines, doc_id=doc_id)

    for field, value in data.items():
        setattr(doc, field, value)
    if payload.lines is not None:
        doc.lines.clear()
        db.flush()
        for line in payload.lines:
            doc.lines.append(spec.line_model(**line.model_dump()))

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail=f"A document with number '{data['doc_no']}' already exists"
        )
    db.refresh(doc)
    sync_stock_movements(db, spec, doc)
    db.refresh(doc)
    return doc


def delete_document(db: Session, spec: DocumentSpec, doc_id: int):
    doc = crud.get_one(db, spec.model, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")

    children = db.query(spec.model).filter(spec.model.parent_id == doc_id).count()
    if children:
        raise HTTPException(
            status_code=409,
            detail=(f"Cannot delete — {children} other document(s) are raised "
                    f"against this one. Delete those first.")
        )

    # Take the auto-posted movements down with it, so stock stays correct.
    source_col = getattr(models.StockMovement, spec.source_column)
    db.query(models.StockMovement).filter(source_col == doc_id).delete(
        synchronize_session=False
    )
    db.delete(doc)
    db.commit()
    return {"ok": True, "deleted_id": doc_id}


def list_documents(db: Session, spec: DocumentSpec, *, skip, limit, doc_type,
                   party_id, status, date_from, date_to):
    query = db.query(spec.model)
    if doc_type:
        query = query.filter(spec.model.doc_type == doc_type.upper())
    if party_id is not None:
        query = query.filter(getattr(spec.model, spec.party_field) == party_id)
    if status:
        query = query.filter(spec.model.status == status.upper())
    if date_from:
        query = query.filter(spec.model.doc_date >= date_from)
    if date_to:
        query = query.filter(spec.model.doc_date <= date_to)
    return query.order_by(spec.model.id.desc()).offset(skip).limit(limit).all()
