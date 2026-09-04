from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Optional
from datetime import date

import crud, models, schemas
from database import get_db
from routers import document_engine as engine

router = APIRouter(
    prefix="/purchase-documents",
    tags=["purchase-documents"],
)

ORDER = "ORDER"
RECEIPT = "RECEIPT"
INVOICE = "INVOICE"
RETURN = "RETURN"
DEBIT_NOTE = "DEBIT_NOTE"

SPEC = engine.DocumentSpec(
    model=models.PurchaseDocument,
    line_model=models.PurchaseDocumentLine,
    party_model=models.Supplier,
    party_field="supplier_id",
    party_label="supplier",
    doc_types={ORDER, RECEIPT, INVOICE, RETURN, DEBIT_NOTE},
    # Mirror of sales: a goods receipt brings stock in, a purchase return
    # sends it back to the supplier.
    stock_effect={RECEIPT: "IN", RETURN: "OUT"},
    allowed_parents={
        ORDER: set(),
        RECEIPT: {ORDER},
        INVOICE: {ORDER, RECEIPT},
        RETURN: {RECEIPT, INVOICE},
        DEBIT_NOTE: {INVOICE, RETURN},
    },
    source_column="source_purchase_id",
)


@router.get("/", response_model=List[schemas.PurchaseDocument])
def read_documents(skip: int = 0, limit: int = 200,
                   doc_type: Optional[str] = None,
                   supplier_id: Optional[int] = None,
                   status: Optional[str] = None,
                   date_from: Optional[date] = None,
                   date_to: Optional[date] = None,
                   db: Session = Depends(get_db)):
    return engine.list_documents(db, SPEC, skip=skip, limit=limit, doc_type=doc_type,
                                 party_id=supplier_id, status=status,
                                 date_from=date_from, date_to=date_to)


@router.get("/{doc_id}", response_model=schemas.PurchaseDocument)
def read_document(doc_id: int, db: Session = Depends(get_db)):
    doc = crud.get_one(db, models.PurchaseDocument, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("/", response_model=schemas.PurchaseDocument, status_code=201)
def create_document(payload: schemas.PurchaseDocumentCreate, db: Session = Depends(get_db)):
    return engine.create_document(db, SPEC, payload)


@router.put("/{doc_id}", response_model=schemas.PurchaseDocument)
def update_document(doc_id: int, payload: schemas.PurchaseDocumentUpdate,
                    db: Session = Depends(get_db)):
    return engine.update_document(db, SPEC, doc_id, payload, schemas.PurchaseLineCreate)


@router.delete("/{doc_id}")
def delete_document(doc_id: int, db: Session = Depends(get_db)):
    try:
        return engine.delete_document(db, SPEC, doc_id)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Could not delete document: {exc.__class__.__name__}"
        )
