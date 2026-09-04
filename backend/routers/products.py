from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from typing import List, Optional

import crud, models, schemas
from database import get_db

router = APIRouter(
    prefix="/products",
    tags=["products"],
)

@router.post("/", response_model=schemas.Product, status_code=201)
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_product(db=db, product=product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="A product with this ticker already exists")

@router.get("/", response_model=List[schemas.Product])
def read_products(skip: int = 0, limit: int = 100, search: Optional[str] = None,
                  db: Session = Depends(get_db)):
    return crud.get_all(db, models.Product, skip=skip, limit=limit, search=search)

@router.get("/{product_id}", response_model=schemas.Product)
def read_product(product_id: int, db: Session = Depends(get_db)):
    db_product = crud.get_product(db, product_id=product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product

@router.put("/{product_id}", response_model=schemas.Product)
def update_product(product_id: int, product: schemas.ProductUpdate,
                   db: Session = Depends(get_db)):
    try:
        db_product = crud.update_one(db, models.Product, product_id, product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="A product with this ticker already exists")
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product

@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    if crud.get_product(db, product_id) is None:
        raise HTTPException(status_code=404, detail="Product not found")

    # Block rather than let SQLAlchemy NULL out the child foreign keys.
    blocking = []
    for child_model, plural in [(models.Order, "order(s)"),
                                (models.OpeningStock, "opening stock entry/entries"),
                                (models.StockMovement, "stock movement(s)")]:
        count = db.query(child_model).filter(
            child_model.product_id == product_id
        ).count()
        if count:
            blocking.append(f"{count} {plural}")
    if blocking:
        raise HTTPException(
            status_code=409,
            detail=(f"Cannot delete this product — it is still used by "
                    f"{' and '.join(blocking)}.")
        )

    try:
        db_product = crud.delete_one(db, models.Product, product_id)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Product is referenced by existing orders and cannot be deleted"
        )
    except SQLAlchemyError as exc:
        # Without this the error escapes as a bare 500 that skips the CORS
        # middleware, so the browser only ever sees "Failed to fetch".
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Could not delete product: {exc.__class__.__name__}"
        )
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"ok": True, "deleted_id": product_id}
