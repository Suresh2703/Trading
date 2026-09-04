from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
from datetime import date

import crud, models, schemas
from database import get_db

router = APIRouter(
    prefix="/stock-movements",
    tags=["stock-movements"],
)

IN, OUT, TRANSFER, ADJUSTMENT = "IN", "OUT", "TRANSFER", "ADJUSTMENT"
MOVEMENT_TYPES = {IN, OUT, TRANSFER, ADJUSTMENT}


# --- Balance helpers -------------------------------------------------------

def available_stock(db: Session, product_id: int, warehouse_id: int,
                    exclude_movement_id: Optional[int] = None,
                    exclude_source_document_id: Optional[int] = None,
                    exclude_source_purchase_id: Optional[int] = None) -> float:
    """On-hand quantity for a product in a warehouse.

    opening stock + everything moved in - everything moved out. When validating
    an edit, the row being edited is excluded so it is not counted against
    itself; likewise a sales document re-saving its own auto-posted movements
    excludes them via `exclude_source_document_id`.
    """
    if not warehouse_id:
        return 0.0

    opening = db.query(
        func.coalesce(func.sum(models.OpeningStock.quantity), 0.0)
    ).filter(
        models.OpeningStock.product_id == product_id,
        models.OpeningStock.warehouse_id == warehouse_id,
        models.OpeningStock.is_active.is_(True),
    ).scalar() or 0.0

    def moved(column):
        q = db.query(func.coalesce(func.sum(models.StockMovement.quantity), 0.0)).filter(
            models.StockMovement.product_id == product_id,
            column == warehouse_id,
        )
        if exclude_movement_id is not None:
            q = q.filter(models.StockMovement.id != exclude_movement_id)
        if exclude_source_document_id is not None:
            q = q.filter(
                (models.StockMovement.source_document_id.is_(None))
                | (models.StockMovement.source_document_id != exclude_source_document_id)
            )
        if exclude_source_purchase_id is not None:
            q = q.filter(
                (models.StockMovement.source_purchase_id.is_(None))
                | (models.StockMovement.source_purchase_id != exclude_source_purchase_id)
            )
        return q.scalar() or 0.0

    return float(opening) + moved(models.StockMovement.to_warehouse_id) \
                          - moved(models.StockMovement.from_warehouse_id)


# --- Validation ------------------------------------------------------------

def validate(db: Session, data: dict, exclude_movement_id: Optional[int] = None):
    """Enforce the rules that make a movement meaningful for its type."""
    mtype = (data.get("movement_type") or "").upper()
    if mtype not in MOVEMENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"movement_type must be one of {', '.join(sorted(MOVEMENT_TYPES))}"
        )

    if crud.get_one(db, models.Product, data.get("product_id")) is None:
        raise HTTPException(status_code=400, detail="Selected product does not exist")

    quantity = data.get("quantity") or 0.0
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be greater than zero")
    if (data.get("unit_cost") or 0.0) < 0:
        raise HTTPException(status_code=400, detail="Unit cost cannot be negative")

    src = data.get("from_warehouse_id")
    dst = data.get("to_warehouse_id")

    for warehouse_id, side in ((src, "source"), (dst, "destination")):
        if warehouse_id and crud.get_one(db, models.Warehouse, warehouse_id) is None:
            raise HTTPException(
                status_code=400, detail=f"Selected {side} warehouse does not exist")

    if mtype == IN:
        if not dst:
            raise HTTPException(status_code=400, detail="Stock In needs a destination warehouse")
    elif mtype == OUT:
        if not src:
            raise HTTPException(status_code=400, detail="Stock Out needs a source warehouse")
    elif mtype == TRANSFER:
        if not src or not dst:
            raise HTTPException(
                status_code=400,
                detail="A transfer needs both a source and a destination warehouse"
            )
        # Now an id comparison rather than a case-insensitive string match —
        # two spellings of one warehouse can no longer slip through.
        if src == dst:
            raise HTTPException(
                status_code=400,
                detail="Source and destination warehouses must be different"
            )
    elif mtype == ADJUSTMENT:
        if bool(src) == bool(dst):
            raise HTTPException(
                status_code=400,
                detail=("An adjustment must either increase stock in one warehouse "
                        "or decrease it in one warehouse, not both or neither")
            )

    # Anything leaving a warehouse must actually be there.
    if src:
        on_hand = available_stock(db, data["product_id"], src, exclude_movement_id)
        if quantity > on_hand:
            warehouse = crud.get_one(db, models.Warehouse, src)
            where = warehouse.name if warehouse else f"warehouse #{src}"
            raise HTTPException(
                status_code=400,
                detail=(f"Only {on_hand:g} available at {where}, cannot move {quantity:g}. "
                        f"Add stock or reduce the quantity.")
            )


def reject_if_auto_posted(movement: models.StockMovement):
    """Auto-posted movements belong to their sales document.

    Editing or deleting one by hand would be silently undone the next time the
    document is saved, so the change is refused and the caller is pointed at the
    document instead.
    """
    owner = ("sales document", movement.source_document_id) if movement.source_document_id \
        else ("purchase document", movement.source_purchase_id) if movement.source_purchase_id \
        else None
    if owner:
        kind, doc_id = owner
        raise HTTPException(
            status_code=409,
            detail=(f"This movement was posted automatically from {kind} "
                    f"#{doc_id} ({movement.reference_no}). "
                    f"Edit that document instead.")
        )


def merged_state(existing: models.StockMovement, payload: schemas.StockMovementUpdate) -> dict:
    """Existing row overlaid with the fields the update actually set."""
    state = {
        "movement_type": existing.movement_type,
        "product_id": existing.product_id,
        "quantity": existing.quantity,
        "unit_cost": existing.unit_cost,
        "from_warehouse_id": existing.from_warehouse_id,
        "to_warehouse_id": existing.to_warehouse_id,
    }
    state.update(payload.model_dump(exclude_unset=True))
    return state


# --- Endpoints -------------------------------------------------------------

@router.get("/", response_model=List[schemas.StockMovement])
def read_movements(skip: int = 0, limit: int = 200,
                   movement_type: Optional[str] = None,
                   product_id: Optional[int] = None,
                   warehouse_id: Optional[int] = None,
                   date_from: Optional[date] = None,
                   date_to: Optional[date] = None,
                   db: Session = Depends(get_db)):
    query = db.query(models.StockMovement)
    if movement_type:
        query = query.filter(models.StockMovement.movement_type == movement_type.upper())
    if product_id is not None:
        query = query.filter(models.StockMovement.product_id == product_id)
    if warehouse_id is not None:
        query = query.filter(
            (models.StockMovement.from_warehouse_id == warehouse_id)
            | (models.StockMovement.to_warehouse_id == warehouse_id)
        )
    if date_from:
        query = query.filter(models.StockMovement.movement_date >= date_from)
    if date_to:
        query = query.filter(models.StockMovement.movement_date <= date_to)
    return (query.order_by(models.StockMovement.id.desc())
                 .offset(skip).limit(limit).all())


@router.get("/balance", response_model=List[schemas.StockBalance])
def read_balances(product_id: Optional[int] = None,
                  warehouse_id: Optional[int] = None,
                  include_zero: bool = Query(False),
                  db: Session = Depends(get_db)):
    """Current on-hand stock per product per warehouse.

    Warehouses are gathered from opening stock and from both ends of every
    movement, so one that only ever received a transfer still appears.
    """
    pairs = set()

    pairs.update(db.query(
        models.OpeningStock.product_id, models.OpeningStock.warehouse_id
    ).filter(models.OpeningStock.is_active.is_(True)).all())

    for column in (models.StockMovement.from_warehouse_id,
                   models.StockMovement.to_warehouse_id):
        pairs.update(db.query(models.StockMovement.product_id, column)
                       .filter(column.isnot(None)).all())

    products = {p.id: p for p in db.query(models.Product).all()}
    warehouses = {w.id: w for w in db.query(models.Warehouse).all()}

    results = []
    for pid, wid in pairs:
        if product_id is not None and pid != product_id:
            continue
        if warehouse_id is not None and wid != warehouse_id:
            continue
        product = products.get(pid)
        warehouse = warehouses.get(wid)
        if product is None or warehouse is None:
            continue

        opening = db.query(
            func.coalesce(func.sum(models.OpeningStock.quantity), 0.0)
        ).filter(
            models.OpeningStock.product_id == pid,
            models.OpeningStock.warehouse_id == wid,
            models.OpeningStock.is_active.is_(True),
        ).scalar() or 0.0

        def moved(column):
            return db.query(
                func.coalesce(func.sum(models.StockMovement.quantity), 0.0)
            ).filter(
                models.StockMovement.product_id == pid,
                column == wid,
            ).scalar() or 0.0

        in_qty = moved(models.StockMovement.to_warehouse_id)
        out_qty = moved(models.StockMovement.from_warehouse_id)
        on_hand = float(opening) + in_qty - out_qty

        if not include_zero and on_hand == 0:
            continue

        results.append(schemas.StockBalance(
            product_id=pid,
            ticker=product.ticker,
            product_name=product.name,
            warehouse_id=wid,
            warehouse_name=warehouse.name,
            opening_qty=float(opening),
            in_qty=float(in_qty),
            out_qty=float(out_qty),
            on_hand=on_hand,
        ))

    results.sort(key=lambda r: (r.ticker, r.warehouse_name))
    return results


@router.get("/{movement_id}", response_model=schemas.StockMovement)
def read_movement(movement_id: int, db: Session = Depends(get_db)):
    movement = crud.get_one(db, models.StockMovement, movement_id)
    if movement is None:
        raise HTTPException(status_code=404, detail="Stock movement not found")
    return movement


@router.post("/", response_model=schemas.StockMovement, status_code=201)
def create_movement(payload: schemas.StockMovementCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    data["movement_type"] = (data.get("movement_type") or "").upper()
    validate(db, data)
    payload.movement_type = data["movement_type"]
    return crud.create_one(db, models.StockMovement, payload)


@router.put("/{movement_id}", response_model=schemas.StockMovement)
def update_movement(movement_id: int, payload: schemas.StockMovementUpdate,
                    db: Session = Depends(get_db)):
    existing = crud.get_one(db, models.StockMovement, movement_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Stock movement not found")
    reject_if_auto_posted(existing)

    state = merged_state(existing, payload)
    state["movement_type"] = (state.get("movement_type") or "").upper()
    validate(db, state, exclude_movement_id=movement_id)

    movement = crud.update_one(db, models.StockMovement, movement_id, payload)
    return movement


@router.delete("/{movement_id}")
def delete_movement(movement_id: int, db: Session = Depends(get_db)):
    existing = crud.get_one(db, models.StockMovement, movement_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Stock movement not found")
    reject_if_auto_posted(existing)

    try:
        movement = crud.delete_one(db, models.StockMovement, movement_id)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Could not delete stock movement: {exc.__class__.__name__}"
        )
    if movement is None:
        raise HTTPException(status_code=404, detail="Stock movement not found")
    return {"ok": True, "deleted_id": movement_id}
