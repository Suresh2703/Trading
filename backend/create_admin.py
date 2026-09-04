import sys
import os

# Add current dir to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import SessionLocal
import models
from crud import get_password_hash

def seed_admin():
    db = SessionLocal()
    try:
        # Check if admin already exists
        admin = db.query(models.User).filter(models.User.username == "admin").first()
        if admin:
            # Update password
            admin.hashed_password = get_password_hash("admin123")
            admin.email = "admin@erp.com"
            print("Admin user updated.")
        else:
            # Create new
            hashed_pwd = get_password_hash("admin123")
            admin = models.User(
                username="admin",
                email="admin@erp.com",
                hashed_password=hashed_pwd,
                is_active=True
            )
            db.add(admin)
            print("Admin user created.")
        db.commit()
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
