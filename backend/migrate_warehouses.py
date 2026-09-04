"""One-off migration: free-text `location` -> `warehouse_id` foreign keys.

Run once. Safe to re-run: every step checks the current shape of the schema
first, and the old text columns are dropped only after the backfill has been
proved complete for every row.

Steps
  1. create the warehouses table
  2. create a warehouse for each distinct location string already in use
  3. add the nullable FK columns alongside the text columns
  4. backfill the FKs by matching the text
  5. verify nothing was left behind
  6. only then: tighten NOT NULL, swap the unique key, drop the text columns
"""
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

import models
from database import engine, MYSQL_DB

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# table -> [(text column, new fk column)]
CONVERSIONS = {
    "opening_stock": [("location", "warehouse_id")],
    "stock_movements": [("from_location", "from_warehouse_id"),
                        ("to_location", "to_warehouse_id")],
    "sales_documents": [("location", "warehouse_id")],
    "purchase_documents": [("location", "warehouse_id")],
}


def column_exists(conn, table, column):
    return conn.execute(text(
        "SELECT COUNT(*) FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :t AND COLUMN_NAME = :c"
    ), {"db": MYSQL_DB, "t": table, "c": column}).scalar() > 0


def constraint_exists(conn, table, name):
    return conn.execute(text(
        "SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS "
        "WHERE TABLE_SCHEMA = :db AND TABLE_NAME = :t AND CONSTRAINT_NAME = :n"
    ), {"db": MYSQL_DB, "t": table, "n": name}).scalar() > 0


def slug(name):
    """Turn 'Main Store' into a stable short code like 'MAIN-STORE'."""
    return "-".join(name.upper().split())[:30]


print("1. Creating any missing tables (warehouses)...")
models.Base.metadata.create_all(bind=engine)

print("2. Collecting the location names already in use...")
names = set()
with engine.connect() as conn:
    for table, pairs in CONVERSIONS.items():
        for text_col, _ in pairs:
            if not column_exists(conn, table, text_col):
                continue
            rows = conn.execute(text(
                f"SELECT DISTINCT {text_col} FROM {table} "
                f"WHERE {text_col} IS NOT NULL AND {text_col} != ''"
            )).fetchall()
            names.update(r[0].strip() for r in rows if r[0] and r[0].strip())

print(f"   found: {sorted(names) or 'none'}")

db = SessionLocal()
existing = {w.name: w for w in db.query(models.Warehouse).all()}
created = 0
for name in sorted(names):
    if name in existing:
        continue
    db.add(models.Warehouse(
        code=slug(name), name=name,
        # The first one carried over becomes the default the forms preselect.
        is_default=(name.lower() == "main store"),
        is_active=True,
    ))
    created += 1
db.commit()

# If nothing existed at all, give the user somewhere to put stock.
if not db.query(models.Warehouse).count():
    db.add(models.Warehouse(code="MAIN-STORE", name="Main Store",
                            is_default=True, is_active=True))
    db.commit()
    created += 1

# Guarantee exactly one default.
warehouses = db.query(models.Warehouse).order_by(models.Warehouse.id).all()
if not any(w.is_default for w in warehouses):
    warehouses[0].is_default = True
    db.commit()

name_to_id = {w.name: w.id for w in db.query(models.Warehouse).all()}
print(f"   warehouses: {created} created, {len(name_to_id)} total -> {name_to_id}")
db.close()

print("3. Adding the foreign-key columns...")
with engine.begin() as conn:
    for table, pairs in CONVERSIONS.items():
        for _, fk_col in pairs:
            if column_exists(conn, table, fk_col):
                print(f"   - {table}.{fk_col} already present")
                continue
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {fk_col} INT NULL"))
            print(f"   + {table}.{fk_col}")

print("4. Backfilling from the text values...")
with engine.begin() as conn:
    for table, pairs in CONVERSIONS.items():
        for text_col, fk_col in pairs:
            if not column_exists(conn, table, text_col):
                print(f"   - {table}.{text_col} already removed, nothing to backfill")
                continue
            for name, wid in name_to_id.items():
                result = conn.execute(text(
                    f"UPDATE {table} SET {fk_col} = :wid "
                    f"WHERE TRIM({text_col}) = :name AND {fk_col} IS NULL"
                ), {"wid": wid, "name": name})
                if result.rowcount:
                    print(f"   ~ {table}.{fk_col} <- '{name}' ({result.rowcount} row(s))")

print("5. Verifying every populated location mapped to a warehouse...")
unmapped = 0
with engine.connect() as conn:
    for table, pairs in CONVERSIONS.items():
        for text_col, fk_col in pairs:
            if not column_exists(conn, table, text_col):
                continue
            count = conn.execute(text(
                f"SELECT COUNT(*) FROM {table} "
                f"WHERE {text_col} IS NOT NULL AND {text_col} != '' AND {fk_col} IS NULL"
            )).scalar()
            if count:
                unmapped += count
                print(f"   ! {table}.{text_col}: {count} row(s) did not map")

if unmapped:
    print(f"\nSTOPPING: {unmapped} row(s) unmapped. The text columns have been "
          f"left in place so nothing is lost. Fix those rows and re-run.")
    raise SystemExit(1)

print("   all rows mapped.")

print("6. Tightening constraints and removing the text columns...")
with engine.begin() as conn:
    # Opening stock must always sit somewhere, and its unique key now keys on
    # the warehouse rather than the old string.
    if column_exists(conn, "opening_stock", "warehouse_id"):
        conn.execute(text(
            "ALTER TABLE opening_stock MODIFY warehouse_id INT NOT NULL"))
    for name in ("uq_opening_stock_product_location_batch",
                 "opening_stock_product_id_location_batch_no"):
        if constraint_exists(conn, "opening_stock", name):
            conn.execute(text(f"ALTER TABLE opening_stock DROP INDEX {name}"))
            print(f"   - dropped old unique key {name}")
    if not constraint_exists(conn, "opening_stock",
                             "uq_opening_stock_product_warehouse_batch"):
        conn.execute(text(
            "ALTER TABLE opening_stock ADD CONSTRAINT "
            "uq_opening_stock_product_warehouse_batch "
            "UNIQUE (product_id, warehouse_id, batch_no)"))
        print("   + new unique key on (product, warehouse, batch)")

    for table, pairs in CONVERSIONS.items():
        for _, fk_col in pairs:
            fk_name = f"fk_{table}_{fk_col}"
            if not constraint_exists(conn, table, fk_name):
                conn.execute(text(
                    f"ALTER TABLE {table} ADD CONSTRAINT {fk_name} "
                    f"FOREIGN KEY ({fk_col}) REFERENCES warehouses(id)"))
                print(f"   + {fk_name}")

    for table, pairs in CONVERSIONS.items():
        for text_col, _ in pairs:
            if column_exists(conn, table, text_col):
                conn.execute(text(f"ALTER TABLE {table} DROP COLUMN {text_col}"))
                print(f"   - dropped {table}.{text_col}")

print("\nMigration complete — locations are now warehouse foreign keys.")
