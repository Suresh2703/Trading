from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from fastapi import HTTPException
from typing import List, Optional
from datetime import date

import crud, models, schemas
from database import get_db
from routers import document_engine as engine

router = APIRouter(
    prefix="/sales-documents",
    tags=["sales-documents"],
)

QUOTATION = "QUOTATION"
ORDER = "ORDER"
DELIVERY = "DELIVERY"
INVOICE = "INVOICE"
RETURN = "RETURN"
CREDIT_NOTE = "CREDIT_NOTE"

SPEC = engine.DocumentSpec(
    model=models.SalesDocument,
    line_model=models.SalesDocumentLine,
    party_model=models.Customer,
    party_field="customer_id",
    party_label="customer",
    doc_types={QUOTATION, ORDER, DELIVERY, INVOICE, RETURN, CREDIT_NOTE},
    # A delivery ships goods out; a sales return brings them back.
    stock_effect={DELIVERY: "OUT", RETURN: "IN"},
    allowed_parents={
        QUOTATION: set(),
        ORDER: {QUOTATION},
        DELIVERY: {ORDER},
        INVOICE: {ORDER, DELIVERY},
        RETURN: {INVOICE, DELIVERY},
        CREDIT_NOTE: {INVOICE, RETURN},
    },
    source_column="source_document_id",
)


@router.get("/", response_model=List[schemas.SalesDocument])
def read_documents(skip: int = 0, limit: int = 200,
                   doc_type: Optional[str] = None,
                   customer_id: Optional[int] = None,
                   status: Optional[str] = None,
                   date_from: Optional[date] = None,
                   date_to: Optional[date] = None,
                   db: Session = Depends(get_db)):
    return engine.list_documents(db, SPEC, skip=skip, limit=limit, doc_type=doc_type,
                                 party_id=customer_id, status=status,
                                 date_from=date_from, date_to=date_to)


@router.get("/{doc_id}", response_model=schemas.SalesDocument)
def read_document(doc_id: int, db: Session = Depends(get_db)):
    doc = crud.get_one(db, models.SalesDocument, doc_id)
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.post("/", response_model=schemas.SalesDocument, status_code=201)
def create_document(payload: schemas.SalesDocumentCreate, db: Session = Depends(get_db)):
    return engine.create_document(db, SPEC, payload)


@router.put("/{doc_id}", response_model=schemas.SalesDocument)
def update_document(doc_id: int, payload: schemas.SalesDocumentUpdate,
                    db: Session = Depends(get_db)):
    return engine.update_document(db, SPEC, doc_id, payload, schemas.SalesLineCreate)


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
