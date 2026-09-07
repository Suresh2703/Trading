"""Idempotent schema + seed script for the master-data tables.

Safe to re-run: columns are added only when information_schema says they are
missing, and seed rows are inserted only when absent.

Running this against an empty MySQL server is enough to stand the application
up from nothing: the schema itself, every table, and the seed data.
"""
from urllib.parse import quote_plus

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

import config
import models


def ensure_database():
    """Create the schema itself if the server does not have it yet.

    Every other connection in the app is opened against MYSQL_DB, so on a fresh
    server they all fail with "Unknown database" before anything has a chance to
    create it. Connecting to the server without naming a schema is the only way
    to break that circle.
    """
    server = create_engine(
        f"mysql+pymysql://{quote_plus(config.MYSQL_USER)}:"
        f"{quote_plus(config.MYSQL_PASSWORD)}@{config.MYSQL_HOST}/"
    )
    try:
        with server.connect() as conn:
            exists = conn.execute(
                text("SELECT COUNT(*) FROM information_schema.SCHEMATA "
                     "WHERE SCHEMA_NAME = :db"),
                {"db": config.MYSQL_DB},
            ).scalar()

            if exists:
                print(f"Schema '{config.MYSQL_DB}' already exists.")
            else:
                # Back-quoted rather than bound: an identifier cannot be a
                # parameter. MYSQL_DB comes from our own environment, not a user.
                conn.execute(text(
                    f"CREATE DATABASE `{config.MYSQL_DB}` "
                    "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
                conn.commit()
                print(f"Created schema '{config.MYSQL_DB}'.")
    finally:
        server.dispose()


ensure_database()

# Imported only once the schema is known to exist, because importing binds an
# engine to it.
from database import engine, MYSQL_DB  # noqa: E402

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def column_exists(conn, table, column):
    result = conn.execute(
        text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :t AND COLUMN_NAME = :c"
        ),
        {"db": MYSQL_DB, "t": table, "c": column},
    )
    return result.scalar() > 0


def add_column(conn, table, column, ddl):
    if column_exists(conn, table, column):
        print(f"  - {table}.{column} already present, skipping")
        return
    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
    print(f"  + added {table}.{column}")


def add_foreign_key(conn, table, column, ref_table):
    fk_name = f"fk_{table}_{column}"
    exists = conn.execute(
        text(
            "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS "
            "WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :t AND CONSTRAINT_NAME = :n"
        ),
        {"db": MYSQL_DB, "t": table, "n": fk_name},
    ).scalar()
    if exists:
        print(f"  - {fk_name} already present, skipping")
        return
    conn.execute(
        text(
            f"ALTER TABLE {table} ADD CONSTRAINT {fk_name} "
            f"FOREIGN KEY ({column}) REFERENCES {ref_table}(id)"
        )
    )
    print(f"  + added {fk_name}")


print("Creating any missing tables...")
models.Base.metadata.create_all(bind=engine)

print("Applying column changes to existing tables...")
with engine.begin() as conn:
    add_column(conn, "products", "category_id", "INT NULL")
    add_column(conn, "products", "unit_id", "INT NULL")
    add_foreign_key(conn, "products", "category_id", "categories")
    add_foreign_key(conn, "products", "unit_id", "units")
    add_column(conn, "categories", "is_active", "TINYINT(1) NOT NULL DEFAULT 1")
    add_column(conn, "units", "is_active", "TINYINT(1) NOT NULL DEFAULT 1")

# The orders/transactions tables predate the current models and drifted:
# orders has user_id/side where the model expects owner_id/order_type, and
# transactions has executed_quantity/execution_price where the model expects
# quantity/price. Both tables are empty, so reconcile additively and relax the
# stale columns to nullable rather than dropping anything.
print("Reconciling drifted transaction tables...")
with engine.begin() as conn:
    add_column(conn, "orders", "owner_id", "INT NULL")
    add_column(conn, "orders", "order_type", "VARCHAR(10) NULL")
    add_column(conn, "transactions", "quantity", "INT NULL")
    add_column(conn, "transactions", "price", "FLOAT NULL")
    for table, column, ddl in [
        ("orders", "user_id", "INT NULL"),
        ("orders", "side", "VARCHAR(10) NULL"),
        ("transactions", "executed_quantity", "INT NULL"),
        ("transactions", "execution_price", "FLOAT NULL"),
    ]:
        if column_exists(conn, table, column):
            conn.execute(text(f"ALTER TABLE {table} MODIFY {column} {ddl}"))
            print(f"  ~ relaxed {table}.{column} to nullable")

# Links an auto-posted movement back to the sales document that created it.
print("Linking stock movements to their source documents...")
with engine.begin() as conn:
    add_column(conn, "stock_movements", "source_document_id", "INT NULL")
    add_column(conn, "stock_movements", "source_line_id", "INT NULL")
    add_foreign_key(conn, "stock_movements", "source_document_id", "sales_documents")
    add_column(conn, "stock_movements", "source_purchase_id", "INT NULL")
    add_foreign_key(conn, "stock_movements", "source_purchase_id", "purchase_documents")

# Roles gate who can manage other accounts.
print("Adding the user role column...")
with engine.begin() as conn:
    is_new = not column_exists(conn, "users", "role")
    add_column(conn, "users", "role", "VARCHAR(20) NOT NULL DEFAULT 'USER'")
    if is_new:
        # Every account that existed before roles was an administrator by
        # necessity — there was no other kind. Defaulting them to USER would
        # lock the only real accounts out of user management.
        result = conn.execute(text("UPDATE users SET role = 'ADMIN'"))
        print(f"  ~ existing {result.rowcount} account(s) marked ADMIN")

db = SessionLocal()

def seed(model, rows, key):
    created = 0
    for row in rows:
        exists = db.query(model).filter(getattr(model, key) == row[key]).first()
        if not exists:
            db.add(model(**row))
            created += 1
    print(f"  {model.__tablename__}: {created} new, {len(rows) - created} already present")

print("Seeding roles and their permissions...")
import modules as module_defs

for spec in module_defs.DEFAULT_ROLES:
    role = db.query(models.Role).filter(models.Role.code == spec["code"]).first()
    if role is None:
        role = models.Role(code=spec["code"], name=spec["name"],
                           description=spec["description"],
                           is_system=spec["is_system"], is_active=True)
        db.add(role)
        db.flush()
        created = 0
        for module, perm in spec["permissions"].items():
            db.add(models.RolePermission(role_id=role.id, module=module, **perm))
            created += 1
        print(f"  + {spec['code']:9} seeded with {created} module grant(s)")
    else:
        # Existing roles are left alone — the matrix is editable, and re-running
        # the migration must not undo somebody's changes.
        print(f"  - {spec['code']:9} already present, permissions untouched")
db.commit()

print("Seeding default master data...")
seed(models.Category, [
    {"name": "Electronics", "description": "Electronic devices and components"},
    {"name": "Raw Materials", "description": "Basic materials for production"},
    {"name": "Finished Goods", "description": "Ready to sell products"},
    {"name": "Services", "description": "Non-tangible services"},
], key="name")

seed(models.Unit, [
    {"name": "Pieces", "abbreviation": "pcs"},
    {"name": "Kilograms", "abbreviation": "kg"},
    {"name": "Liters", "abbreviation": "L"},
    {"name": "Hours", "abbreviation": "hrs"},
    {"name": "Boxes", "abbreviation": "box"},
], key="name")

seed(models.Tax, [
    {"name": "GST 0%", "tax_type": "GST", "rate": 0.0, "description": "Exempt / nil rated"},
    {"name": "GST 5%", "tax_type": "GST", "rate": 5.0, "description": "Essential goods"},
    {"name": "GST 12%", "tax_type": "GST", "rate": 12.0, "description": "Standard reduced rate"},
    {"name": "GST 18%", "tax_type": "GST", "rate": 18.0, "description": "Standard rate"},
    {"name": "GST 28%", "tax_type": "GST", "rate": 28.0, "description": "Luxury / demerit goods"},
], key="name")

# Counter sales need a customer, because a sales document must have one. This
# is the anonymous shopper every till falls back to.
seed(models.Customer, [
    {"code": "WALKIN", "name": "Walk-in Customer",
     "country": "India", "is_active": True},
], key="code")

print("Seeding a standard chart of accounts...")
# A conventional 4-digit chart, enough to record real transactions on day one.
# CASH / BANK / RECEIVABLE / PAYABLE / TAX groups are the ones the ledger
# screens filter on, so those codes matter more than the rest.
seed(models.ChartOfAccount, [
    # Assets
    {"code": "1000", "name": "Cash in Hand", "account_type": "ASSET", "account_group": "CASH"},
    {"code": "1010", "name": "Petty Cash", "account_type": "ASSET", "account_group": "CASH"},
    {"code": "1050", "name": "Bank Current Account", "account_type": "ASSET", "account_group": "BANK"},
    {"code": "1060", "name": "Bank Savings Account", "account_type": "ASSET", "account_group": "BANK"},
    {"code": "1100", "name": "Accounts Receivable", "account_type": "ASSET", "account_group": "RECEIVABLE"},
    {"code": "1200", "name": "Inventory", "account_type": "ASSET", "account_group": "CURRENT_ASSET"},
    {"code": "1300", "name": "Input GST Receivable", "account_type": "ASSET", "account_group": "TAX"},
    {"code": "1500", "name": "Furniture & Equipment", "account_type": "ASSET", "account_group": "FIXED_ASSET"},
    # Liabilities
    {"code": "2100", "name": "Accounts Payable", "account_type": "LIABILITY", "account_group": "PAYABLE"},
    {"code": "2200", "name": "Output GST Payable", "account_type": "LIABILITY", "account_group": "TAX"},
    {"code": "2300", "name": "Accrued Expenses", "account_type": "LIABILITY", "account_group": "CURRENT_LIABILITY"},
    {"code": "2500", "name": "Bank Loan", "account_type": "LIABILITY", "account_group": "LOAN"},
    # Equity
    {"code": "3000", "name": "Owner's Capital", "account_type": "EQUITY", "account_group": "CAPITAL"},
    {"code": "3100", "name": "Retained Earnings", "account_type": "EQUITY", "account_group": "RESERVE"},
    {"code": "3200", "name": "Drawings", "account_type": "EQUITY", "account_group": "CAPITAL"},
    # Income
    {"code": "4000", "name": "Sales Revenue", "account_type": "INCOME", "account_group": "DIRECT_INCOME"},
    {"code": "4100", "name": "Trading Profit", "account_type": "INCOME", "account_group": "DIRECT_INCOME"},
    {"code": "4900", "name": "Other Income", "account_type": "INCOME", "account_group": "INDIRECT_INCOME"},
    # Expenses
    {"code": "5000", "name": "Purchases", "account_type": "EXPENSE", "account_group": "DIRECT_EXPENSE"},
    {"code": "5100", "name": "Freight & Carriage", "account_type": "EXPENSE", "account_group": "DIRECT_EXPENSE"},
    {"code": "6000", "name": "Salaries & Wages", "account_type": "EXPENSE", "account_group": "INDIRECT_EXPENSE"},
    {"code": "6100", "name": "Rent", "account_type": "EXPENSE", "account_group": "INDIRECT_EXPENSE"},
    {"code": "6200", "name": "Utilities", "account_type": "EXPENSE", "account_group": "INDIRECT_EXPENSE"},
    {"code": "6300", "name": "Office & Admin", "account_type": "EXPENSE", "account_group": "INDIRECT_EXPENSE"},
    {"code": "6400", "name": "Bank Charges", "account_type": "EXPENSE", "account_group": "INDIRECT_EXPENSE"},
    {"code": "6500", "name": "Brokerage & Commission", "account_type": "EXPENSE", "account_group": "INDIRECT_EXPENSE"},
], key="code")

db.commit()
db.close()
print("Database update and seeding completed!")
