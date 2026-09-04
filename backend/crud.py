from sqlalchemy.orm import Session
import models, schemas

# --- User ---
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = get_password_hash(user.password)
    db_user = models.User(email=user.email, username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# --- Account ---
def create_account(db: Session, account: schemas.AccountCreate, user_id: int):
    db_account = models.Account(**account.model_dump(), owner_id=user_id)
    db.add(db_account)
    db.commit()
    db.refresh(db_account)
    return db_account

def get_accounts(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Account).offset(skip).limit(limit).all()

# --- Generic master-data helpers ---
# Every master (Category, Unit, Customer, Supplier, Tax, Product) shares the same
# list/get/create/update/delete shape, so the logic lives here once.

def get_all(db: Session, model, skip: int = 0, limit: int = 100, search: str = None):
    query = db.query(model)
    # Not every record type has a `name` column (opening stock is keyed by
    # product), so only apply the text filter where one exists.
    if search and hasattr(model, "name"):
        term = f"%{search}%"
        query = query.filter(model.name.ilike(term))
    return query.order_by(model.id.desc()).offset(skip).limit(limit).all()

def get_one(db: Session, model, obj_id: int):
    return db.query(model).filter(model.id == obj_id).first()

def create_one(db: Session, model, payload):
    db_obj = model(**payload.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def update_one(db: Session, model, obj_id: int, payload):
    db_obj = get_one(db, model, obj_id)
    if db_obj is None:
        return None
    # exclude_unset so a PATCH-style partial payload never nulls untouched columns
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(db_obj, field, value)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def delete_one(db: Session, model, obj_id: int):
    db_obj = get_one(db, model, obj_id)
    if db_obj is None:
        return None
    db.delete(db_obj)
    db.commit()
    return db_obj

# --- Category ---
def get_categories(db: Session, skip: int = 0, limit: int = 100):
    return get_all(db, models.Category, skip=skip, limit=limit)

# --- Unit ---
def get_units(db: Session, skip: int = 0, limit: int = 100):
    return get_all(db, models.Unit, skip=skip, limit=limit)

# --- Product ---
def get_product(db: Session, product_id: int):
    return get_one(db, models.Product, product_id)

def get_products(db: Session, skip: int = 0, limit: int = 100):
    return get_all(db, models.Product, skip=skip, limit=limit)

def create_product(db: Session, product: schemas.ProductCreate):
    return create_one(db, models.Product, product)

# --- Order ---
def create_order(db: Session, order: schemas.OrderCreate, user_id: int):
    db_order = models.Order(**order.model_dump(), owner_id=user_id)
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

def get_orders(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Order).offset(skip).limit(limit).all()
