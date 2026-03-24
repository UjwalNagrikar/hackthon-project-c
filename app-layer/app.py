from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR.parent / "static"
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


def ensure_column_exists(conn, table_name, column_name, column_def):
    cols = conn.execute(f"PRAGMA table_info({table_name})").fetchall()
    col_names = [col["name"] for col in cols]
    if column_name not in col_names:
        conn.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_def}")
        conn.commit()


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
        added_by TEXT,
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
        username TEXT UNIQUE,
        role TEXT,
        department TEXT,
        email TEXT,
        status TEXT DEFAULT 'Active',
        last_login TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)

    conn.commit()

    ensure_column_exists(conn, "students", "added_by", "TEXT")

    conn.close()


@app.route("/", methods=["GET"])
def home():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return send_from_directory(STATIC_DIR, "index.html")
    return jsonify({"message": "Backend running", "status": "ok"}), 200


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "db_path": str(DB_PATH)
    }), 200


@app.route("/api/students", methods=["GET"])
def get_students():
    conn = get_db()
    rows = conn.execute("""
        SELECT id, prn, name, email, phone, branch, year, division, cgpa,
               backlogs, ssc, hsc, status, skills, address, added_by, created_at
        FROM students
        ORDER BY id DESC
    """).fetchall()
    conn.close()
    return jsonify(rows_to_dicts(rows)), 200


@app.route("/api/students/<int:student_id>", methods=["GET"])
def get_student(student_id):
    conn = get_db()
    row = conn.execute("""
        SELECT id, prn, name, email, phone, branch, year, division, cgpa,
               backlogs, ssc, hsc, status, skills, address, added_by, created_at
        FROM students
        WHERE id = ?
    """, (student_id,)).fetchone()
    conn.close()

    if not row:
        return jsonify({"error": "Student not found"}), 404

    return jsonify(dict(row)), 200


@app.route("/api/students", methods=["POST"])
def create_student():
    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body is required"}), 400

    if not data.get("prn") or not data.get("name"):
        return jsonify({"error": "prn and name are required"}), 400

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO students
            (prn, name, email, phone, branch, year, division, cgpa, backlogs,
             ssc, hsc, status, skills, address, added_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            data.get("address"),
            data.get("added_by", "Admin")
        ))
        conn.commit()
        new_id = cur.lastrowid

        created = conn.execute("""
            SELECT id, prn, name, email, phone, branch, year, division, cgpa,
                   backlogs, ssc, hsc, status, skills, address, added_by, created_at
            FROM students
            WHERE id = ?
        """, (new_id,)).fetchone()

        conn.close()
        return jsonify({
            "message": "Student created successfully",
            "student": dict(created)
        }), 201

    except sqlite3.IntegrityError:
        return jsonify({"error": "PRN already exists"}), 409


@app.route("/api/students/<int:student_id>", methods=["PUT"])
def update_student(student_id):
    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body is required"}), 400

    conn = get_db()
    existing = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()

    if not existing:
        conn.close()
        return jsonify({"error": "Student not found"}), 404

    try:
        conn.execute("""
            UPDATE students
            SET prn = ?, name = ?, email = ?, phone = ?, branch = ?, year = ?,
                division = ?, cgpa = ?, backlogs = ?, ssc = ?, hsc = ?, status = ?,
                skills = ?, address = ?, added_by = ?
            WHERE id = ?
        """, (
            data.get("prn", existing["prn"]),
            data.get("name", existing["name"]),
            data.get("email", existing["email"]),
            data.get("phone", existing["phone"]),
            data.get("branch", existing["branch"]),
            data.get("year", existing["year"]),
            data.get("division", existing["division"]),
            data.get("cgpa", existing["cgpa"]),
            data.get("backlogs", existing["backlogs"]),
            data.get("ssc", existing["ssc"]),
            data.get("hsc", existing["hsc"]),
            data.get("status", existing["status"]),
            data.get("skills", existing["skills"]),
            data.get("address", existing["address"]),
            data.get("added_by", existing["added_by"]),
            student_id
        ))
        conn.commit()

        updated = conn.execute("""
            SELECT id, prn, name, email, phone, branch, year, division, cgpa,
                   backlogs, ssc, hsc, status, skills, address, added_by, created_at
            FROM students
            WHERE id = ?
        """, (student_id,)).fetchone()

        conn.close()
        return jsonify({
            "message": "Student updated successfully",
            "student": dict(updated)
        }), 200

    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "PRN already exists"}), 409


@app.route("/api/students/<int:student_id>", methods=["DELETE"])
def delete_student(student_id):
    conn = get_db()
    existing = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()

    if not existing:
        conn.close()
        return jsonify({"error": "Student not found"}), 404

    conn.execute("DELETE FROM students WHERE id = ?", (student_id,))
    conn.commit()
    conn.close()

    return jsonify({"message": "Student deleted successfully"}), 200


@app.route("/api/companies", methods=["GET"])
def get_companies():
    conn = get_db()
    rows = conn.execute("""
        SELECT id, name, sector, location, contact_person, email, phone,
               min_cgpa, openings, status, about, roles, created_at
        FROM companies
        ORDER BY id DESC
    """).fetchall()
    conn.close()
    return jsonify(rows_to_dicts(rows)), 200


@app.route("/api/companies", methods=["POST"])
def create_company():
    data = request.get_json()

    if not data or not data.get("name"):
        return jsonify({"error": "Company name is required"}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO companies
        (name, sector, location, contact_person, email, phone, min_cgpa, openings, status, about, roles)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("name"),
        data.get("sector"),
        data.get("location"),
        data.get("contact_person"),
        data.get("email"),
        data.get("phone"),
        data.get("min_cgpa"),
        data.get("openings", 0),
        data.get("status", "Active"),
        data.get("about"),
        data.get("roles")
    ))
    conn.commit()
    new_id = cur.lastrowid

    created = conn.execute("""
        SELECT id, name, sector, location, contact_person, email, phone,
               min_cgpa, openings, status, about, roles, created_at
        FROM companies
        WHERE id = ?
    """, (new_id,)).fetchone()

    conn.close()

    return jsonify({
        "message": "Company created successfully",
        "company": dict(created)
    }), 201


@app.route("/api/placements", methods=["GET"])
def get_placements():
    conn = get_db()
    rows = conn.execute("""
        SELECT id, student_id, company_id, role, ctc, placement_type,
               offer_date, joining_date, location, remarks, created_at
        FROM placements
        ORDER BY id DESC
    """).fetchall()
    conn.close()
    return jsonify(rows_to_dicts(rows)), 200


@app.route("/api/internships", methods=["GET"])
def get_internships():
    conn = get_db()
    rows = conn.execute("""
        SELECT id, student_id, company_id, role, stipend, start_date,
               end_date, mode, status, remarks, created_at
        FROM internships
        ORDER BY id DESC
    """).fetchall()
    conn.close()
    return jsonify(rows_to_dicts(rows)), 200


@app.route("/api/users", methods=["GET"])
def get_users():
    conn = get_db()
    rows = conn.execute("""
        SELECT id, name, username, role, department, email, status,
               last_login, created_at
        FROM users
        ORDER BY id DESC
    """).fetchall()
    conn.close()
    return jsonify(rows_to_dicts(rows)), 200


@app.route("/api/stats", methods=["GET"])
def get_stats():
    conn = get_db()

    total_students = conn.execute("SELECT COUNT(*) AS count FROM students").fetchone()["count"]
    total_companies = conn.execute("SELECT COUNT(*) AS count FROM companies").fetchone()["count"]
    total_placements = conn.execute("SELECT COUNT(*) AS count FROM placements").fetchone()["count"]
    total_internships = conn.execute("SELECT COUNT(*) AS count FROM internships").fetchone()["count"]

    conn.close()

    return jsonify({
        "total_students": total_students,
        "total_companies": total_companies,
        "total_placements": total_placements,
        "total_internships": total_internships
    }), 200


# KEEP STATIC FILE ROUTE LAST
@app.route("/<path:filename>", methods=["GET"])
def serve_static(filename):
    file_path = STATIC_DIR / filename
    if file_path.exists():
        return send_from_directory(STATIC_DIR, filename)
    return jsonify({"error": "File not found"}), 404


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)