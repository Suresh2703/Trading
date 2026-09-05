"""The permission modules, and the default access each seeded role gets.

One module per sidebar section. That is the granularity the menu is actually
built from, so the matrix stays readable — finer would mean a grid of forty
columns nobody wants to reason about.
"""

DASHBOARD = "DASHBOARD"
MASTER_DATA = "MASTER_DATA"
INVENTORY = "INVENTORY"
SALES = "SALES"
PURCHASES = "PURCHASES"
TRADING = "TRADING"
ACCOUNTS = "ACCOUNTS"
REPORTS = "REPORTS"
AUTH_USERS = "AUTH_USERS"
SETTINGS = "SETTINGS"

# Order matters: this is the order the matrix screen renders them in.
MODULES = [
    (DASHBOARD, "Dashboard"),
    (MASTER_DATA, "Master Data"),
    (INVENTORY, "Inventory"),
    (SALES, "Sales"),
    (PURCHASES, "Purchases"),
    (TRADING, "Trading"),
    (ACCOUNTS, "Accounts"),
    (REPORTS, "Reports"),
    (AUTH_USERS, "Auth & Users"),
    (SETTINGS, "Settings"),
]

MODULE_CODES = [code for code, _ in MODULES]

VIEW = "view"
EDIT = "edit"


def _grant(view=(), edit=()):
    """Build a permission map. Edit implies view — being able to change
    something you cannot see is not a coherent state."""
    perms = {}
    for module in view:
        perms[module] = {"can_view": True, "can_edit": False}
    for module in edit:
        perms[module] = {"can_view": True, "can_edit": True}
    return perms


ALL = MODULE_CODES

# Seeded roles. These are starting points — the matrix is editable afterwards,
# which is the whole point of storing it rather than hardcoding it.
DEFAULT_ROLES = [
    {
        "code": "ADMIN", "name": "Administrator", "is_system": True,
        "description": "Full access, including user and role management.",
        "permissions": _grant(edit=ALL),
    },
    {
        "code": "ACCOUNTS", "name": "Accountant", "is_system": False,
        "description": "Books, ledgers and financial reporting.",
        "permissions": _grant(
            view=[DASHBOARD, MASTER_DATA, SALES, PURCHASES],
            edit=[ACCOUNTS, REPORTS]),
    },
    {
        "code": "SALES", "name": "Sales", "is_system": False,
        "description": "Customer orders, deliveries and invoices.",
        "permissions": _grant(
            view=[DASHBOARD, MASTER_DATA, INVENTORY, REPORTS],
            edit=[SALES]),
    },
    {
        "code": "PURCHASE", "name": "Purchasing", "is_system": False,
        "description": "Supplier orders, receipts and invoices.",
        "permissions": _grant(
            view=[DASHBOARD, MASTER_DATA, INVENTORY, REPORTS],
            edit=[PURCHASES]),
    },
    {
        "code": "STORE", "name": "Store Keeper", "is_system": False,
        "description": "Stock movements and warehouse balances.",
        "permissions": _grant(
            view=[DASHBOARD, MASTER_DATA, REPORTS],
            edit=[INVENTORY]),
    },
    {
        "code": "TRADER", "name": "Trader", "is_system": False,
        "description": "The trading book and its profit calculation.",
        "permissions": _grant(
            view=[DASHBOARD, MASTER_DATA, REPORTS],
            edit=[TRADING]),
    },
    {
        "code": "VIEWER", "name": "Viewer", "is_system": False,
        "description": "Read-only across the business, changes nothing.",
        "permissions": _grant(
            view=[DASHBOARD, MASTER_DATA, INVENTORY, SALES,
                  PURCHASES, TRADING, ACCOUNTS, REPORTS]),
    },
    {
        # Every account created before roles existed carried USER, so it has to
        # keep meaning something rather than becoming an access denial.
        "code": "USER", "name": "General User", "is_system": False,
        "description": "Day-to-day access without the books or user management.",
        "permissions": _grant(
            view=[DASHBOARD, MASTER_DATA, REPORTS],
            edit=[INVENTORY, SALES, PURCHASES]),
    },
]
