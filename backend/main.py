import traceback

from fastapi import FastAPI, Request, Depends
from fastapi.responses import JSONResponse
import models
from app.trading import models as trading_models # Import to trigger table creation
from database import engine
from routers import (users, accounts, products, orders, categories, units,
                     customers, suppliers, taxes, opening_stock, stock_movements,
                     sales_documents, purchase_documents, trades, accounting, reports, warehouses, roles,
                     pos, settings, api_keys, notifications)
from app.trading import router as trading_router
from deps import get_current_user, require_module
import modules as M

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


# Each router is guarded by the module its screens belong to. The dependency
# is method-aware: reading needs view, writing needs edit. users.router is
# excluded because it carries /users/login, which has to be reachable before
# anyone has a token; its endpoints declare their own requirements.
def guard(module):
    return [Depends(require_module(module))]

app.include_router(users.router)
# Roles declare their own requirements: /roles/me has to stay open to
# anyone signed in, or the menu cannot be built.
app.include_router(roles.router)
# Reading settings has to stay open to any signed-in user — the app needs the
# values to behave correctly; writing them is admin-only inside the router.
app.include_router(settings.router)
# Alerts are computed from whatever the caller may already see.
app.include_router(notifications.router)
app.include_router(api_keys.router, dependencies=guard(M.SETTINGS))
app.include_router(accounts.router, dependencies=guard(M.ACCOUNTS))
app.include_router(products.router, dependencies=guard(M.MASTER_DATA))
app.include_router(orders.router, dependencies=guard(M.SALES))
app.include_router(categories.router, dependencies=guard(M.MASTER_DATA))
app.include_router(units.router, dependencies=guard(M.MASTER_DATA))
app.include_router(customers.router, dependencies=guard(M.MASTER_DATA))
app.include_router(suppliers.router, dependencies=guard(M.MASTER_DATA))
app.include_router(taxes.router, dependencies=guard(M.MASTER_DATA))
app.include_router(warehouses.router, dependencies=guard(M.MASTER_DATA))
app.include_router(opening_stock.router, dependencies=guard(M.INVENTORY))
app.include_router(stock_movements.router, dependencies=guard(M.INVENTORY))
app.include_router(sales_documents.router, dependencies=guard(M.SALES))
# The till sells, so it lives behind the same permission as the sales screens.
app.include_router(pos.router, dependencies=guard(M.SALES))
app.include_router(purchase_documents.router, dependencies=guard(M.PURCHASES))
app.include_router(trades.router, dependencies=guard(M.TRADING))
app.include_router(accounting.router, dependencies=guard(M.ACCOUNTS))
app.include_router(reports.router, dependencies=guard(M.REPORTS))
app.include_router(trading_router.router, dependencies=guard(M.TRADING))

@app.get("/")
def read_root():
    return {"message": "Welcome to the Product Sales Trading API"}
