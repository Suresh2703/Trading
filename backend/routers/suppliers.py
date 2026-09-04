import models, schemas
from routers.master_factory import build_master_router

router = build_master_router(
    prefix="/suppliers",
    tag="suppliers",
    model=models.Supplier,
    read_schema=schemas.Supplier,
    create_schema=schemas.SupplierCreate,
    update_schema=schemas.SupplierUpdate,
    label="Supplier",
)
