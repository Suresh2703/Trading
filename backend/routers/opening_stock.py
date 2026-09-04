from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import List, Optional

import crud, models, schemas
from database import get_db

router = APIRouter(
    prefix="/opening-stock",
    tags=["opening-stock"],
)

DUPLICATE_DETAIL = (
    "Opening stock for this product already exists in this warehouse and batch. "
    "Edit the existing entry instead."
)


def ensure_refs_exist(db: Session, product_id, warehouse_id):
    if product_id is not None and crud.get_one(db, models.Product, product_id) is None:
        raise HTTPException(status_code=400, detail="Selected product does not exist")
    if warehouse_id is not None and crud.get_one(db, models.Warehouse, warehouse_id) is None:
        raise HTTPException(status_code=400, detail="Selected warehouse does not exist")


@router.get("/", response_model=List[schemas.OpeningStock])
def read_opening_stock(skip: int = 0, limit: int = 100,
                       product_id: Optional[int] = None,
                       warehouse_id: Optional[int] = None,
                       db: Session = Depends(get_db)):
    query = db.query(models.OpeningStock)
    if product_id is not None:
        query = query.filter(models.OpeningStock.product_id == product_id)
    if warehouse_id is not None:
        query = query.filter(models.OpeningStock.warehouse_id == warehouse_id)
    return (query.order_by(models.OpeningStock.id.desc())
                 .offset(skip).limit(limit).all())


@router.get("/{entry_id}", response_model=schemas.OpeningStock)
def read_one(entry_id: int, db: Session = Depends(get_db)):
    entry = crud.get_one(db, models.OpeningStock, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Opening stock entry not found")
    return entry


@router.post("/", response_model=schemas.OpeningStock, status_code=201)
def create(payload: schemas.OpeningStockCreate, db: Session = Depends(get_db)):
    ensure_refs_exist(db, payload.product_id, payload.warehouse_id)
    if payload.quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")
    if payload.unit_cost < 0:
        raise HTTPException(status_code=400, detail="Unit cost cannot be negative")
    try:
        return crud.create_one(db, models.OpeningStock, payload)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=DUPLICATE_DETAIL)


@router.put("/{entry_id}", response_model=schemas.OpeningStock)
def update(entry_id: int, payload: schemas.OpeningStockUpdate,
           db: Session = Depends(get_db)):
    ensure_refs_exist(db, payload.product_id, payload.warehouse_id)
    if payload.quantity is not None and payload.quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")
    if payload.unit_cost is not None and payload.unit_cost < 0:
        raise HTTPException(status_code=400, detail="Unit cost cannot be negative")
    try:
        entry = crud.update_one(db, models.OpeningStock, entry_id, payload)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=DUPLICATE_DETAIL)
    if entry is None:
        raise HTTPException(status_code=404, detail="Opening stock entry not found")
    return entry


@router.delete("/{entry_id}")
def delete(entry_id: int, db: Session = Depends(get_db)):
    try:
        entry = crud.delete_one(db, models.OpeningStock, entry_id)
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Could not delete opening stock entry: {exc.__class__.__name__}"
        )
    if entry is None:
        raise HTTPException(status_code=404, detail="Opening stock entry not found")
    return {"ok": True, "deleted_id": entry_id}
