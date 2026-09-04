import models, schemas
from routers.master_factory import build_master_router

router = build_master_router(
    prefix="/customers",
    tag="customers",
    model=models.Customer,
    read_schema=schemas.Customer,
    create_schema=schemas.CustomerCreate,
    update_schema=schemas.CustomerUpdate,
    label="Customer",
)
