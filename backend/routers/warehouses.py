import models, schemas
from routers.master_factory import build_master_router

router = build_master_router(
    prefix="/warehouses",
    tag="warehouses",
    model=models.Warehouse,
    read_schema=schemas.Warehouse,
    create_schema=schemas.WarehouseCreate,
    update_schema=schemas.WarehouseUpdate,
    label="Warehouse",
    # Deleting a warehouse that still holds stock or is named on a document
    # would orphan those records, so block it and say what is using it.
    dependents=[
        (models.OpeningStock, "warehouse_id", "opening stock entry/entries"),
        (models.StockMovement, "from_warehouse_id", "outbound stock movement(s)"),
        (models.StockMovement, "to_warehouse_id", "inbound stock movement(s)"),
        (models.SalesDocument, "warehouse_id", "sales document(s)"),
        (models.PurchaseDocument, "warehouse_id", "purchase document(s)"),
    ],
)
