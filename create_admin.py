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


def create_admin(username, password, display_name=None):
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id FROM admins WHERE username = ?", (username,))
        if cursor.fetchone():
            print(f"❌ 用户名 '{username}' 已存在！")
            return False
        
        display_name = display_name or username
        admin_id = f"admin_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}_{hash(username) % 10000}"
        now = now_iso()
        
        cursor.execute("""
            INSERT INTO admins (id, username, password, display_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (admin_id, username, password, display_name, now, now))
        
        conn.commit()
        print(f"✅ 管理员 '{username}' 创建成功！")
        print(f"   ID: {admin_id}")
        print(f"   显示名称: {display_name}")
        return True
    except Exception as exc:
        print(f"❌ 创建失败: {exc}")
        return False
    finally:
        conn.close()


def list_admins():
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id, username, display_name, created_at FROM admins ORDER BY created_at DESC")
        rows = cursor.fetchall()
        
        if not rows:
            print("暂无管理员")
            return
        
        print("\n=== 管理员列表 ===")
        for row in rows:
            print(f"ID: {row['id']}")
            print(f"  用户名: {row['username']}")
            print(f"  显示名称: {row['display_name']}")
            print(f"  创建时间: {row['created_at']}")
            print()
    except Exception as exc:
        print(f"❌ 查询失败: {exc}")
    finally:
        conn.close()


def delete_admin(username):
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT id FROM admins WHERE username = ?", (username,))
        row = cursor.fetchone()
        
        if not row:
            print(f"❌ 管理员 '{username}' 不存在！")
            return False
        
        cursor.execute("DELETE FROM admins WHERE username = ?", (username,))
        conn.commit()
        
        print(f"✅ 管理员 '{username}' 删除成功！")
        return True
    except Exception as exc:
        print(f"❌ 删除失败: {exc}")
        return False
    finally:
        conn.close()


def main():
    print("=" * 40)
    print("    高考志愿系统 - 管理员管理工具")
    print("=" * 40)
    print()
    
    while True:
        print("请选择操作:")
        print("1. 创建管理员")
        print("2. 列出所有管理员")
        print("3. 删除管理员")
        print("4. 退出")
        print()
        
        choice = input("输入选项 [1-4]: ").strip()
        
        if choice == "1":
            username = input("输入管理员用户名: ").strip()
            if not username:
                print("用户名不能为空！")
                continue
            
            password = input("输入管理员密码: ").strip()
            if len(password) < 3:
                print("密码长度不能少于3位！")
                continue
            
            display_name = input("输入显示名称 (可选): ").strip()
            
            create_admin(username, password, display_name)
        
        elif choice == "2":
            list_admins()
        
        elif choice == "3":
            username = input("输入要删除的管理员用户名: ").strip()
            if not username:
                print("用户名不能为空！")
                continue
            
            if username == "admin":
                print("警告: 正在删除默认管理员！")
            
            delete_admin(username)
        
        elif choice == "4":
            print("退出程序...")
            break
        
        else:
            print("无效选项，请重新输入！")
        
        print()


if __name__ == "__main__":
    main()