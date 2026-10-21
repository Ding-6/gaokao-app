"""高考志愿模拟填报系统 — Flask 后端

对齐 gaokao.db 中已有的真实表结构：
  users(id, username, password[sha256], display_name, created_at, updated_at)
  user_data(user_id, user_score, user_rank, draft, updated_at)
  admission_plans(id, college_code, college_name, province, year,
                  is_real_data, majors, payload, updated_at)
  colleges / score_rank_tables / students / admins

API 与前端 js/db.js、js/app.js 一一对应。

启动：conda activate gaokao ; python server.py
"""
import hashlib
import json
import os
import sqlite3
from datetime import datetime, timezone

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, "gaokao.db")

app = Flask(__name__, static_folder=BASE_DIR, static_url_path="/static")
CORS(app)


@app.get("/")
def index():
    return send_from_directory(BASE_DIR, "index.html")


@app.get("/<path:filename>")
def static_files(filename):
    """让 index.html 中的相对路径（css/、js/、data/）可直接访问。"""
    return send_from_directory(BASE_DIR, filename)


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def hash_pw(pw):
    return hashlib.sha256(pw.encode("utf-8")).hexdigest()


def dumps(obj):
    return json.dumps(obj, ensure_ascii=False)


SCHEMA = [
    """CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL, display_name TEXT,
        created_at TEXT, updated_at TEXT)""",
    """CREATE TABLE IF NOT EXISTS user_data (
        user_id TEXT PRIMARY KEY, user_score INTEGER DEFAULT 0,
        user_rank INTEGER DEFAULT 0, draft TEXT DEFAULT '[]',
        updated_at TEXT)""",
    """CREATE TABLE IF NOT EXISTS admission_plans (
        id TEXT PRIMARY KEY, college_code TEXT, college_name TEXT,
        province TEXT, year INTEGER, is_real_data INTEGER DEFAULT 0,
        majors TEXT DEFAULT '[]', payload TEXT DEFAULT '{}',
        updated_at TEXT)""",
    """CREATE TABLE IF NOT EXISTS colleges (
        id TEXT PRIMARY KEY, collegeCode TEXT, collegeName TEXT,
        level TEXT, ownership TEXT, province TEXT, city TEXT,
        tags TEXT, tuitionRange TEXT, isRealData INTEGER DEFAULT 0)""",
    """CREATE TABLE IF NOT EXISTS score_rank_tables (
        id TEXT PRIMARY KEY, province TEXT, year INTEGER,
        subject_category TEXT, is_real_data INTEGER DEFAULT 0,
        table_data TEXT DEFAULT '[]', payload TEXT DEFAULT '{}',
        updated_at TEXT)""",
    """CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL, display_name TEXT,
        created_at TEXT, updated_at TEXT)""",
]


def init_db():
    conn = get_db()
    cur = conn.cursor()
    for sql in SCHEMA:
        cur.execute(sql)
    conn.commit()
    conn.close()


# ---------------- 用户 ----------------

@app.post("/api/users/register")
def register():
    d = request.get_json(silent=True) or {}
    u = (d.get("username") or "").strip()
    p = d.get("password") or ""
    n = (d.get("displayName") or "").strip() or u
    if not 2 <= len(u) <= 20:
        return jsonify(success=False, error="用户名长度需 2-20"), 400
    if not 3 <= len(p) <= 30:
        return jsonify(success=False, error="密码长度需 3-30"), 400
    conn = get_db()
    try:
        if conn.execute("SELECT 1 FROM users WHERE username=?", (u,)).fetchone():
            return jsonify(success=False, error="用户名已存在"), 400
        uid = "u_" + datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S%f")
        now = now_iso()
        conn.execute(
            "INSERT INTO users (id,username,password,display_name,created_at,updated_at)"
            " VALUES (?,?,?,?,?,?)",
            (uid, u, hash_pw(p), n, now, now),
        )
        conn.commit()
        return jsonify(success=True, user={"id": uid, "username": u, "display_name": n})
    finally:
        conn.close()


@app.post("/api/users/login")
def login():
    d = request.get_json(silent=True) or {}
    u = (d.get("username") or "").strip()
    p = d.get("password") or ""
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT id,username,display_name,password FROM users WHERE username=?", (u,)
        ).fetchone()
        if not row or row["password"] != hash_pw(p):
            return jsonify(success=False, error="用户名或密码错误"), 401
        return jsonify(success=True, user={
            "id": row["id"], "username": row["username"],
            "display_name": row["display_name"]})
    finally:
        conn.close()


@app.get("/api/users/list")
def user_list():
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id,username,display_name FROM users ORDER BY created_at"
        ).fetchall()
        return jsonify(success=True, users=[dict(r) for r in rows])
    finally:
        conn.close()


# ---------------- 用户数据 ----------------

@app.get("/api/user_data")
def get_user_data():
    uid = request.args.get("user_id", "default")
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM user_data WHERE user_id=?", (uid,)).fetchone()
        if not row:
            return jsonify(user_id=uid, user_score=0, user_rank=0, draft=[])
        d = dict(row)
        try:
            d["draft"] = json.loads(d.get("draft") or "[]")
        except (TypeError, ValueError):
            d["draft"] = []
        return jsonify(d)
    finally:
        conn.close()


@app.post("/api/user_data")
def set_user_data():
    d = request.get_json(silent=True) or {}
    uid = d.get("user_id") or "default"
    conn = get_db()
    try:
        conn.execute(
            """INSERT INTO user_data (user_id,user_score,user_rank,draft,updated_at)
               VALUES (?,?,?,?,?)
               ON CONFLICT(user_id) DO UPDATE SET
                 user_score=excluded.user_score, user_rank=excluded.user_rank,
                 draft=excluded.draft, updated_at=excluded.updated_at""",
            (uid, d.get("user_score") or 0, d.get("user_rank") or 0,
             dumps(d.get("draft") or []), now_iso()),
        )
        conn.commit()
        return jsonify(success=True)
    finally:
        conn.close()


# ---------------- 招生计划 ----------------

def _plan_id(p):
    return p.get("id") or "_".join(
        str(p.get(k, "")) for k in ("collegeCode", "groupId", "year", "subjectRequirement"))


@app.get("/api/plans")
def get_plans():
    conn = get_db()
    try:
        out = []
        for r in conn.execute("SELECT payload FROM admission_plans"):
            try:
                out.append(json.loads(r["payload"]))
            except (TypeError, ValueError):
                pass
        return jsonify(out)
    finally:
        conn.close()


@app.post("/api/plans")
def post_plans():
    items = request.get_json(silent=True) or []
    if isinstance(items, dict):
        items = items.get("admissionPlans") or []
    if not isinstance(items, list):
        return jsonify(success=0, failed=0, error="需要数组"), 400

    conn = get_db()
    ok = bad = 0
    try:
        for it in items:
            if not isinstance(it, dict) or not it.get("collegeCode"):
                bad += 1
                continue
            try:
                conn.execute(
                    """INSERT INTO admission_plans
                       (id,college_code,college_name,province,year,is_real_data,majors,payload,updated_at)
                       VALUES (?,?,?,?,?,?,?,?,?)
                       ON CONFLICT(id) DO UPDATE SET
                         college_code=excluded.college_code,
                         college_name=excluded.college_name,
                         province=excluded.province, year=excluded.year,
                         is_real_data=excluded.is_real_data, majors=excluded.majors,
                         payload=excluded.payload, updated_at=excluded.updated_at""",
                    (_plan_id(it), it.get("collegeCode"), it.get("collegeName") or "",
                     it.get("province"), it.get("year"),
                     1 if it.get("isRealData") else 0,
                     dumps(it.get("majors") or []), dumps(it), now_iso()),
                )
                ok += 1
            except sqlite3.Error:
                bad += 1
        conn.commit()
    finally:
        conn.close()
    return jsonify(success=ok, failed=bad)


@app.get("/api/plans/count")
def plans_count():
    conn = get_db()
    try:
        total = conn.execute("SELECT COUNT(*) c FROM admission_plans").fetchone()["c"]
        return jsonify(total_plans=total)
    finally:
        conn.close()


@app.post("/api/clear_plans")
@app.post("/api/plans/clear")
def clear_plans():
    conn = get_db()
    try:
        conn.execute("DELETE FROM admission_plans")
        conn.commit()
        return jsonify(success=True)
    finally:
        conn.close()


@app.get("/api/colleges")
def get_colleges():
    conn = get_db()
    try:
        out = []
        for r in conn.execute("SELECT payload FROM colleges"):
            try:
                out.append(json.loads(r["payload"]))
            except (TypeError, ValueError):
                pass
        return jsonify(out)
    finally:
        conn.close()


@app.get("/api/score_rank_tables")
def get_score_rank():
    conn = get_db()
    try:
        out = []
        for r in conn.execute("SELECT payload FROM score_rank_tables"):
            try:
                out.append(json.loads(r["payload"]))
            except (TypeError, ValueError):
                pass
        return jsonify(out)
    finally:
        conn.close()


init_db()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)