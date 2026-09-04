import models, schemas
from routers.master_factory import build_master_router

router = build_master_router(
    prefix="/taxes",
    tag="taxes",
    model=models.Tax,
    read_schema=schemas.Tax,
    create_schema=schemas.TaxCreate,
    update_schema=schemas.TaxUpdate,
    label="Tax",
)
