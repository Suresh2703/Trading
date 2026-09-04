import models, schemas
from routers.master_factory import build_master_router

router = build_master_router(
    prefix="/units",
    tag="units",
    model=models.Unit,
    read_schema=schemas.Unit,
    create_schema=schemas.UnitCreate,
    update_schema=schemas.UnitUpdate,
    label="Unit",
    dependents=[(models.Product, "unit_id", "product(s)")],
)
