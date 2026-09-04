import models, schemas
from routers.master_factory import build_master_router

router = build_master_router(
    prefix="/categories",
    tag="categories",
    model=models.Category,
    read_schema=schemas.Category,
    create_schema=schemas.CategoryCreate,
    update_schema=schemas.CategoryUpdate,
    label="Category",
    dependents=[(models.Product, "category_id", "product(s)")],
)
