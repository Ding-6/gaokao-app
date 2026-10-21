import sqlite3
import os
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "gaokao.db")


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def create_default_admin():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("CREATE TABLE IF NOT EXISTS admins (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, display_name TEXT, created_at TEXT, updated_at TEXT)")
    
    try:
        cursor.execute("SELECT id FROM admins WHERE username = 'admin'")
        if cursor.fetchone():
            print("Admin 'admin' already exists, skipping")
            return
        
        admin_id = f"admin_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_0000"
        now = now_iso()
        
        cursor.execute("INSERT INTO admins (id, username, password, display_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)", 
                      (admin_id, 'admin', 'admin123', 'Administrator', now, now))
        
        conn.commit()
        print("Default admin 'admin' created successfully!")
        print("   Username: admin")
        print("   Password: admin123")
    except Exception as exc:
        print("Create failed:", exc)
    finally:
        conn.close()


if __name__ == "__main__":
    create_default_admin()