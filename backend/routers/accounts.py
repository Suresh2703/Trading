from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import crud, schemas
from database import get_db

router = APIRouter(
    prefix="/users/{user_id}/accounts",
    tags=["accounts"],
)

@router.post("/", response_model=schemas.Account)
def create_account_for_user(
    user_id: int, account: schemas.AccountCreate, db: Session = Depends(get_db)
):
    # Verify user exists
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return crud.create_account(db=db, account=account, user_id=user_id)

@router.get("/", response_model=List[schemas.Account])
def read_accounts_for_user(user_id: int, db: Session = Depends(get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    # For now, crud doesn't have get_accounts_by_user, so we just use user.accounts
    return db_user.accounts
