from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import crud, schemas
from database import get_db

router = APIRouter(
    prefix="/users/{user_id}/orders",
    tags=["orders"],
)

@router.post("/", response_model=schemas.Order)
def create_order_for_user(
    user_id: int, order: schemas.OrderCreate, db: Session = Depends(get_db)
):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
        
    db_product = crud.get_product(db, product_id=order.product_id)
    if db_product is None:
        raise HTTPException(status_code=404, detail="Product not found")
        
    return crud.create_order(db=db, order=order, user_id=user_id)

@router.get("/", response_model=List[schemas.Order])
def read_orders_for_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user.orders
