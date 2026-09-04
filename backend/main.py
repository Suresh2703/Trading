import traceback

from fastapi import FastAPI, Request, Depends
from fastapi.responses import JSONResponse
import models
from app.trading import models as trading_models # Import to trigger table creation
from database import engine
from routers import (users, accounts, products, orders, categories, units,
                     customers, suppliers, taxes, opening_stock, stock_movements,
                     sales_documents, purchase_documents, trades, accounting, reports, warehouses)
from app.trading import router as trading_router
from deps import get_current_user

# Create database tables
models.Base.metadata.create_all(bind=engine)

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Product Sales Trading API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
def unhandled_exception_handler(request: Request, exc: Exception):
    """Return unhandled errors as JSON.

    Starlette's default 500 is produced outside the CORS middleware, so the
    browser sees an opaque "Failed to fetch" instead of the real error. Routing
    them through an exception handler keeps the CORS headers on the response.
    """
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {exc.__class__.__name__}"},
    )


# Business data requires a signed-in caller. users.router is excluded because
# it carries /users/login, which necessarily has to be reachable first; its own
# endpoints declare their requirements individually.
AUTHENTICATED = [Depends(get_current_user)]

app.include_router(users.router)
app.include_router(accounts.router, dependencies=AUTHENTICATED)
app.include_router(products.router, dependencies=AUTHENTICATED)
app.include_router(orders.router, dependencies=AUTHENTICATED)
app.include_router(categories.router, dependencies=AUTHENTICATED)
app.include_router(units.router, dependencies=AUTHENTICATED)
app.include_router(customers.router, dependencies=AUTHENTICATED)
app.include_router(suppliers.router, dependencies=AUTHENTICATED)
app.include_router(taxes.router, dependencies=AUTHENTICATED)
app.include_router(warehouses.router, dependencies=AUTHENTICATED)
app.include_router(opening_stock.router, dependencies=AUTHENTICATED)
app.include_router(stock_movements.router, dependencies=AUTHENTICATED)
app.include_router(sales_documents.router, dependencies=AUTHENTICATED)
app.include_router(purchase_documents.router, dependencies=AUTHENTICATED)
app.include_router(trades.router, dependencies=AUTHENTICATED)
app.include_router(accounting.router, dependencies=AUTHENTICATED)
app.include_router(reports.router, dependencies=AUTHENTICATED)
app.include_router(trading_router.router, dependencies=AUTHENTICATED)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Product Sales Trading API"}
