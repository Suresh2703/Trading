from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker
from urllib.parse import quote_plus

import config

# All from the environment — see config.py. The password has no fallback.
MYSQL_USER = config.MYSQL_USER
MYSQL_PASSWORD = config.MYSQL_PASSWORD
MYSQL_HOST = config.MYSQL_HOST
MYSQL_DB = config.MYSQL_DB

# Escaped, so a password containing @ : / or # cannot corrupt the URL.
SQLALCHEMY_DATABASE_URL = (
    f"mysql+pymysql://{quote_plus(MYSQL_USER)}:{quote_plus(MYSQL_PASSWORD)}"
    f"@{MYSQL_HOST}/{MYSQL_DB}"
)

# Create engine using PyMySQL driver
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
