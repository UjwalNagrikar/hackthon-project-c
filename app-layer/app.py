from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DB_DIR = Path(os.getenv("DB_DIR", BASE_DIR / "data"))
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "placement.db"

app = Flask(__name__)
CORS(app)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def rows_to_dicts(rows):
    return [dict(row) for row in rows]


def init_db():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prn TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        branch TEXT,
        year TEXT,
        division TEXT,
        cgpa REAL,
        backlogs INTEGER DEFAULT 0,
        ssc REAL,
        hsc REAL,
        status TEXT DEFAULT 'Seeking',
        skills TEXT,
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        sector TEXT,
        location TEXT,
        contact_person TEXT,
        email TEXT,
        phone TEXT,
        min_cgpa REAL,
        openings INTEGER DEFAULT 0,
        status TEXT DEFAULT 'Active',
        about TEXT,
        roles TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS internships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        stipend REAL,
        start_date TEXT,
        end_date TEXT,
        mode TEXT,
        status TEXT DEFAULT 'Ongoing',
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS placements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        company_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        ctc REAL NOT NULL,
        placement_type TEXT,
        offer_date TEXT,
        joining_date TEXT,
        location TEXT,
        remarks TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
        FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        role TEXT,
        department TEXT,
        email TEXT,
        status TEXT DEFAULT 'Active',
        last_login TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()
    conn.close()


@app.route("/")
def home():
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/style.css")
def serve_css():
    return send_from_directory(STATIC_DIR, "style.css")


@app.route("/app.js")
def serve_js():
    return send_from_directory(STATIC_DIR, "app.js")


@app.route("/<path:filename>")
def serve_files(filename):
    file_path = STATIC_DIR / filename
    if file_path.exists():
        return send_from_directory(STATIC_DIR, filename)
    return jsonify({"error": "File not found"}), 404


@app.route("/api/health")
def health():
    return jsonify({"status": "ok"})


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)