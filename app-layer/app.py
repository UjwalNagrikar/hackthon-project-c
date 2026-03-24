from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
STATIC_DIR = PROJECT_DIR / "static"

# Use environment variable for database path, default to data directory
DB_DIR = os.getenv('DB_DIR', str(BASE_DIR / "data"))
DB_PATH = Path(DB_DIR) / "placement.db"

# Ensure database directory exists
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

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
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/static/<path:filename>")
def serve_static(filename):
    return send_from_directory(STATIC_DIR, filename)


@app.route("/style.css")
def style():
    return send_from_directory(STATIC_DIR, "style.css")


@app.route("/app.js")
def script():
    return send_from_directory(STATIC_DIR, "app.js")


# ---------------- STUDENTS ----------------
@app.route("/api/students", methods=["GET"])
def get_students():
    conn = get_db()
    rows = conn.execute("SELECT * FROM students ORDER BY id DESC").fetchall()
    conn.close()
    return jsonify(rows_to_dicts(rows))


@app.route("/api/students", methods=["POST"])
def create_student():
    data = request.get_json()

    if not data or not data.get("prn") or not data.get("name"):
        return jsonify({"error": "prn and name are required"}), 400

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO students
            (prn, name, email, phone, branch, year, division, cgpa, backlogs, ssc, hsc, status, skills, address)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("prn"),
            data.get("name"),
            data.get("email"),
            data.get("phone"),
            data.get("branch"),
            data.get("year"),
            data.get("division"),
            data.get("cgpa"),
            data.get("backlogs", 0),
            data.get("ssc"),
            data.get("hsc"),
            data.get("status", "Seeking"),
            data.get("skills"),
            data.get("address")
        ))
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return jsonify({"message": "Student created", "id": new_id}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "PRN already exists"}), 409


@app.route("/api/students/<int:student_id>", methods=["DELETE"])
def delete_student(student_id):
    conn = get_db()
    cur = conn.execute("DELETE FROM students WHERE id = ?", (student_id,))
    conn.commit()
    conn.close()

    if cur.rowcount == 0:
        return jsonify({"error": "Student not found"}), 404
    return jsonify({"message": "Student deleted"})


if __name__ == "__main__":
    init_db()
    app.run(debug=True)