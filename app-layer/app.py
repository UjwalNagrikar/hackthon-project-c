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


# ─────────────────────────────────────────────
#  STATIC / HEALTH
# ─────────────────────────────────────────────

@app.route("/", methods=["GET"])
def home():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return send_from_directory(STATIC_DIR, "index.html")
    return jsonify({"message": "Backend running", "status": "ok"}), 200


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "db_path": str(DB_PATH)}), 200


# ─────────────────────────────────────────────
#  MODULE 2 – STUDENTS
# ─────────────────────────────────────────────

@app.route("/api/students", methods=["GET"])
def get_students():
    conn = get_db()
    rows = conn.execute("""
        SELECT id, prn, name, email, phone, branch, year, division, cgpa,
               backlogs, ssc, hsc, status, skills, address, added_by, created_at
        FROM students ORDER BY id DESC
    """).fetchall()
    conn.close()
    return jsonify(rows_to_dicts(rows)), 200


@app.route("/api/students/<int:student_id>", methods=["GET"])
def get_student(student_id):
    conn = get_db()
    row = conn.execute("""
        SELECT id, prn, name, email, phone, branch, year, division, cgpa,
               backlogs, ssc, hsc, status, skills, address, added_by, created_at
        FROM students WHERE id = ?
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
            data.get("prn"), data.get("name"), data.get("email"),
            data.get("phone"), data.get("branch"), data.get("year"),
            data.get("division"), data.get("cgpa"), data.get("backlogs", 0),
            data.get("ssc"), data.get("hsc"), data.get("status", "Seeking"),
            data.get("skills"), data.get("address"), data.get("added_by", "Admin")
        ))
        conn.commit()
        new_id = cur.lastrowid
        created = conn.execute("""
            SELECT id, prn, name, email, phone, branch, year, division, cgpa,
                   backlogs, ssc, hsc, status, skills, address, added_by, created_at
            FROM students WHERE id = ?
        """, (new_id,)).fetchone()
        conn.close()
        return jsonify({"message": "Student created successfully", "student": dict(created)}), 201
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
            SET prn=?, name=?, email=?, phone=?, branch=?, year=?,
                division=?, cgpa=?, backlogs=?, ssc=?, hsc=?, status=?,
                skills=?, address=?, added_by=?
            WHERE id = ?
        """, (
            data.get("prn", existing["prn"]), data.get("name", existing["name"]),
            data.get("email", existing["email"]), data.get("phone", existing["phone"]),
            data.get("branch", existing["branch"]), data.get("year", existing["year"]),
            data.get("division", existing["division"]), data.get("cgpa", existing["cgpa"]),
            data.get("backlogs", existing["backlogs"]), data.get("ssc", existing["ssc"]),
            data.get("hsc", existing["hsc"]), data.get("status", existing["status"]),
            data.get("skills", existing["skills"]), data.get("address", existing["address"]),
            data.get("added_by", existing["added_by"]), student_id
        ))
        conn.commit()
        updated = conn.execute("""
            SELECT id, prn, name, email, phone, branch, year, division, cgpa,
                   backlogs, ssc, hsc, status, skills, address, added_by, created_at
            FROM students WHERE id = ?
        """, (student_id,)).fetchone()
        conn.close()
        return jsonify({"message": "Student updated successfully", "student": dict(updated)}), 200
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


# ─────────────────────────────────────────────
#  MODULE 3 – COMPANIES
# ─────────────────────────────────────────────

@app.route("/api/companies", methods=["GET"])
def get_companies():
    conn = get_db()
    rows = conn.execute("""
        SELECT id, name, sector, location, contact_person, email, phone,
               min_cgpa, openings, status, about, roles, created_at
        FROM companies ORDER BY id DESC
    """).fetchall()
    conn.close()
    return jsonify(rows_to_dicts(rows)), 200


@app.route("/api/companies/<int:company_id>", methods=["GET"])
def get_company(company_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Company not found"}), 404
    return jsonify(dict(row)), 200


@app.route("/api/companies", methods=["POST"])
def create_company():
    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"error": "Company name is required"}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO companies
        (name, sector, location, contact_person, email, phone,
         min_cgpa, openings, status, about, roles)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("name"), data.get("sector"), data.get("location"),
        data.get("contact_person"), data.get("email"), data.get("phone"),
        data.get("min_cgpa"), data.get("openings", 0),
        data.get("status", "Active"), data.get("about"), data.get("roles")
    ))
    conn.commit()
    new_id = cur.lastrowid
    created = conn.execute("SELECT * FROM companies WHERE id = ?", (new_id,)).fetchone()
    conn.close()
    return jsonify({"message": "Company created successfully", "company": dict(created)}), 201


@app.route("/api/companies/<int:company_id>", methods=["PUT"])
def update_company(company_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    conn = get_db()
    existing = conn.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Company not found"}), 404
    conn.execute("""
        UPDATE companies
        SET name=?, sector=?, location=?, contact_person=?, email=?, phone=?,
            min_cgpa=?, openings=?, status=?, about=?, roles=?
        WHERE id = ?
    """, (
        data.get("name", existing["name"]), data.get("sector", existing["sector"]),
        data.get("location", existing["location"]),
        data.get("contact_person", existing["contact_person"]),
        data.get("email", existing["email"]), data.get("phone", existing["phone"]),
        data.get("min_cgpa", existing["min_cgpa"]),
        data.get("openings", existing["openings"]),
        data.get("status", existing["status"]), data.get("about", existing["about"]),
        data.get("roles", existing["roles"]), company_id
    ))
    conn.commit()
    updated = conn.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    conn.close()
    return jsonify({"message": "Company updated successfully", "company": dict(updated)}), 200


@app.route("/api/companies/<int:company_id>", methods=["DELETE"])
def delete_company(company_id):
    conn = get_db()
    existing = conn.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Company not found"}), 404
    conn.execute("DELETE FROM companies WHERE id = ?", (company_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Company deleted successfully"}), 200


# ─────────────────────────────────────────────
#  MODULE 4 – INTERNSHIPS
# ─────────────────────────────────────────────

@app.route("/api/internships", methods=["GET"])
def get_internships():
    conn = get_db()
    rows = conn.execute("""
        SELECT i.id, i.student_id, i.company_id, i.role, i.stipend,
               i.start_date, i.end_date, i.mode, i.status, i.remarks, i.created_at,
               s.name AS student_name, s.prn AS student_prn,
               c.name AS company_name
        FROM internships i
        JOIN students s ON i.student_id = s.id
        JOIN companies c ON i.company_id = c.id
        ORDER BY i.id DESC
    """).fetchall()
    conn.close()
    return jsonify(rows_to_dicts(rows)), 200


@app.route("/api/internships/<int:intern_id>", methods=["GET"])
def get_internship(intern_id):
    conn = get_db()
    row = conn.execute("""
        SELECT i.*, s.name AS student_name, c.name AS company_name
        FROM internships i
        JOIN students s ON i.student_id = s.id
        JOIN companies c ON i.company_id = c.id
        WHERE i.id = ?
    """, (intern_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Internship not found"}), 404
    return jsonify(dict(row)), 200


@app.route("/api/internships", methods=["POST"])
def create_internship():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    if not data.get("student_id") or not data.get("company_id") or not data.get("role"):
        return jsonify({"error": "student_id, company_id and role are required"}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO internships
        (student_id, company_id, role, stipend, start_date, end_date, mode, status, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("student_id"), data.get("company_id"), data.get("role"),
        data.get("stipend"), data.get("start_date"), data.get("end_date"),
        data.get("mode", "In-Office"), data.get("status", "Ongoing"),
        data.get("remarks")
    ))
    conn.commit()
    new_id = cur.lastrowid
    created = conn.execute("""
        SELECT i.*, s.name AS student_name, c.name AS company_name
        FROM internships i
        JOIN students s ON i.student_id = s.id
        JOIN companies c ON i.company_id = c.id
        WHERE i.id = ?
    """, (new_id,)).fetchone()
    conn.close()
    return jsonify({"message": "Internship created successfully", "internship": dict(created)}), 201


@app.route("/api/internships/<int:intern_id>", methods=["PUT"])
def update_internship(intern_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    conn = get_db()
    existing = conn.execute("SELECT * FROM internships WHERE id = ?", (intern_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Internship not found"}), 404
    conn.execute("""
        UPDATE internships
        SET student_id=?, company_id=?, role=?, stipend=?, start_date=?,
            end_date=?, mode=?, status=?, remarks=?
        WHERE id = ?
    """, (
        data.get("student_id", existing["student_id"]),
        data.get("company_id", existing["company_id"]),
        data.get("role", existing["role"]),
        data.get("stipend", existing["stipend"]),
        data.get("start_date", existing["start_date"]),
        data.get("end_date", existing["end_date"]),
        data.get("mode", existing["mode"]),
        data.get("status", existing["status"]),
        data.get("remarks", existing["remarks"]),
        intern_id
    ))
    conn.commit()
    updated = conn.execute("""
        SELECT i.*, s.name AS student_name, c.name AS company_name
        FROM internships i
        JOIN students s ON i.student_id = s.id
        JOIN companies c ON i.company_id = c.id
        WHERE i.id = ?
    """, (intern_id,)).fetchone()
    conn.close()
    return jsonify({"message": "Internship updated successfully", "internship": dict(updated)}), 200


@app.route("/api/internships/<int:intern_id>", methods=["DELETE"])
def delete_internship(intern_id):
    conn = get_db()
    existing = conn.execute("SELECT * FROM internships WHERE id = ?", (intern_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Internship not found"}), 404
    conn.execute("DELETE FROM internships WHERE id = ?", (intern_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Internship deleted successfully"}), 200


# ─────────────────────────────────────────────
#  MODULE 5 – PLACEMENTS
# ─────────────────────────────────────────────

@app.route("/api/placements", methods=["GET"])
def get_placements():
    conn = get_db()
    rows = conn.execute("""
        SELECT p.id, p.student_id, p.company_id, p.role, p.ctc,
               p.placement_type, p.offer_date, p.joining_date, p.location,
               p.remarks, p.created_at,
               s.name AS student_name, s.prn AS student_prn,
               c.name AS company_name
        FROM placements p
        JOIN students s ON p.student_id = s.id
        JOIN companies c ON p.company_id = c.id
        ORDER BY p.id DESC
    """).fetchall()
    conn.close()
    return jsonify(rows_to_dicts(rows)), 200


@app.route("/api/placements/<int:placement_id>", methods=["GET"])
def get_placement(placement_id):
    conn = get_db()
    row = conn.execute("""
        SELECT p.*, s.name AS student_name, c.name AS company_name
        FROM placements p
        JOIN students s ON p.student_id = s.id
        JOIN companies c ON p.company_id = c.id
        WHERE p.id = ?
    """, (placement_id,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Placement not found"}), 404
    return jsonify(dict(row)), 200


@app.route("/api/placements", methods=["POST"])
def create_placement():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    if not data.get("student_id") or not data.get("company_id") or not data.get("role") or data.get("ctc") is None:
        return jsonify({"error": "student_id, company_id, role and ctc are required"}), 400
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO placements
        (student_id, company_id, role, ctc, placement_type,
         offer_date, joining_date, location, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        data.get("student_id"), data.get("company_id"), data.get("role"),
        data.get("ctc"), data.get("placement_type", "On-Campus"),
        data.get("offer_date"), data.get("joining_date"),
        data.get("location"), data.get("remarks")
    ))
    # Auto-update student status to Placed
    conn.execute("UPDATE students SET status='Placed' WHERE id=?", (data.get("student_id"),))
    conn.commit()
    new_id = cur.lastrowid
    created = conn.execute("""
        SELECT p.*, s.name AS student_name, c.name AS company_name
        FROM placements p
        JOIN students s ON p.student_id = s.id
        JOIN companies c ON p.company_id = c.id
        WHERE p.id = ?
    """, (new_id,)).fetchone()
    conn.close()
    return jsonify({"message": "Placement created successfully", "placement": dict(created)}), 201


@app.route("/api/placements/<int:placement_id>", methods=["PUT"])
def update_placement(placement_id):
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    conn = get_db()
    existing = conn.execute("SELECT * FROM placements WHERE id = ?", (placement_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Placement not found"}), 404
    conn.execute("""
        UPDATE placements
        SET student_id=?, company_id=?, role=?, ctc=?, placement_type=?,
            offer_date=?, joining_date=?, location=?, remarks=?
        WHERE id = ?
    """, (
        data.get("student_id", existing["student_id"]),
        data.get("company_id", existing["company_id"]),
        data.get("role", existing["role"]),
        data.get("ctc", existing["ctc"]),
        data.get("placement_type", existing["placement_type"]),
        data.get("offer_date", existing["offer_date"]),
        data.get("joining_date", existing["joining_date"]),
        data.get("location", existing["location"]),
        data.get("remarks", existing["remarks"]),
        placement_id
    ))
    conn.commit()
    updated = conn.execute("""
        SELECT p.*, s.name AS student_name, c.name AS company_name
        FROM placements p
        JOIN students s ON p.student_id = s.id
        JOIN companies c ON p.company_id = c.id
        WHERE p.id = ?
    """, (placement_id,)).fetchone()
    conn.close()
    return jsonify({"message": "Placement updated successfully", "placement": dict(updated)}), 200


@app.route("/api/placements/<int:placement_id>", methods=["DELETE"])
def delete_placement(placement_id):
    conn = get_db()
    existing = conn.execute("SELECT * FROM placements WHERE id = ?", (placement_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Placement not found"}), 404
    conn.execute("DELETE FROM placements WHERE id = ?", (placement_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Placement deleted successfully"}), 200


# ─────────────────────────────────────────────
#  MODULE 1 – ADMIN / USERS
# ─────────────────────────────────────────────

@app.route("/api/users", methods=["GET"])
def get_users():
    conn = get_db()
    rows = conn.execute("""
        SELECT id, name, username, role, department, email, status, last_login, created_at
        FROM users ORDER BY id DESC
    """).fetchall()
    conn.close()
    return jsonify(rows_to_dicts(rows)), 200


@app.route("/api/users", methods=["POST"])
def create_user():
    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"error": "Name is required"}), 400
    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO users (name, username, role, department, email, status)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            data.get("name"), data.get("username"), data.get("role", "Faculty"),
            data.get("department"), data.get("email"), data.get("status", "Active")
        ))
        conn.commit()
        new_id = cur.lastrowid
        created = conn.execute("SELECT * FROM users WHERE id = ?", (new_id,)).fetchone()
        conn.close()
        return jsonify({"message": "User created successfully", "user": dict(created)}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "Username already exists"}), 409


@app.route("/api/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    conn = get_db()
    existing = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "User not found"}), 404
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    return jsonify({"message": "User deleted successfully"}), 200


# ─────────────────────────────────────────────
#  MODULE 6 – SEARCH (cross-entity)
# ─────────────────────────────────────────────

@app.route("/api/search", methods=["GET"])
def global_search():
    q = request.args.get("q", "").strip()
    entity = request.args.get("type", "")  # students | companies | internships | placements
    if not q:
        return jsonify({"students": [], "companies": [], "internships": [], "placements": []}), 200

    like = f"%{q}%"
    conn = get_db()
    result = {}

    if not entity or entity == "students":
        rows = conn.execute("""
            SELECT id, prn, name, email, branch, year, division, cgpa, status, skills
            FROM students
            WHERE name LIKE ? OR prn LIKE ? OR email LIKE ? OR branch LIKE ?
                  OR skills LIKE ? OR status LIKE ?
            ORDER BY id DESC LIMIT 50
        """, (like, like, like, like, like, like)).fetchall()
        result["students"] = rows_to_dicts(rows)

    if not entity or entity == "companies":
        rows = conn.execute("""
            SELECT id, name, sector, location, contact_person, email, openings, status
            FROM companies
            WHERE name LIKE ? OR sector LIKE ? OR location LIKE ? OR roles LIKE ?
            ORDER BY id DESC LIMIT 50
        """, (like, like, like, like)).fetchall()
        result["companies"] = rows_to_dicts(rows)

    if not entity or entity == "internships":
        rows = conn.execute("""
            SELECT i.id, i.role, i.stipend, i.start_date, i.end_date, i.status,
                   s.name AS student_name, s.prn, c.name AS company_name
            FROM internships i
            JOIN students s ON i.student_id = s.id
            JOIN companies c ON i.company_id = c.id
            WHERE s.name LIKE ? OR c.name LIKE ? OR i.role LIKE ? OR i.status LIKE ?
            ORDER BY i.id DESC LIMIT 50
        """, (like, like, like, like)).fetchall()
        result["internships"] = rows_to_dicts(rows)

    if not entity or entity == "placements":
        rows = conn.execute("""
            SELECT p.id, p.role, p.ctc, p.placement_type, p.offer_date, p.joining_date,
                   s.name AS student_name, s.prn, c.name AS company_name
            FROM placements p
            JOIN students s ON p.student_id = s.id
            JOIN companies c ON p.company_id = c.id
            WHERE s.name LIKE ? OR c.name LIKE ? OR p.role LIKE ? OR p.placement_type LIKE ?
            ORDER BY p.id DESC LIMIT 50
        """, (like, like, like, like)).fetchall()
        result["placements"] = rows_to_dicts(rows)

    conn.close()
    return jsonify(result), 200


# ─────────────────────────────────────────────
#  MODULE 7 – REPORTS
# ─────────────────────────────────────────────

@app.route("/api/reports/overview", methods=["GET"])
def report_overview():
    conn = get_db()

    total_students = conn.execute("SELECT COUNT(*) AS c FROM students").fetchone()["c"]
    total_companies = conn.execute("SELECT COUNT(*) AS c FROM companies").fetchone()["c"]
    total_placements = conn.execute("SELECT COUNT(*) AS c FROM placements").fetchone()["c"]
    total_internships = conn.execute("SELECT COUNT(*) AS c FROM internships").fetchone()["c"]
    placed_count = conn.execute("SELECT COUNT(*) AS c FROM students WHERE status='Placed'").fetchone()["c"]
    seeking_count = conn.execute("SELECT COUNT(*) AS c FROM students WHERE status='Seeking'").fetchone()["c"]
    interning_count = conn.execute("SELECT COUNT(*) AS c FROM students WHERE status='Interning'").fetchone()["c"]

    avg_ctc = conn.execute("SELECT AVG(ctc) AS a FROM placements").fetchone()["a"] or 0
    max_ctc = conn.execute("SELECT MAX(ctc) AS m FROM placements").fetchone()["m"] or 0
    min_ctc = conn.execute("SELECT MIN(ctc) AS m FROM placements WHERE ctc > 0").fetchone()["m"] or 0

    branch_stats = conn.execute("""
        SELECT branch,
               COUNT(*) AS total,
               SUM(CASE WHEN status='Placed' THEN 1 ELSE 0 END) AS placed
        FROM students GROUP BY branch
    """).fetchall()

    monthly = conn.execute("""
        SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS count
        FROM placements
        GROUP BY month ORDER BY month DESC LIMIT 12
    """).fetchall()

    sector_hiring = conn.execute("""
        SELECT c.sector, COUNT(p.id) AS hires
        FROM placements p JOIN companies c ON p.company_id = c.id
        GROUP BY c.sector ORDER BY hires DESC
    """).fetchall()

    top_companies = conn.execute("""
        SELECT c.name, COUNT(p.id) AS hires, MAX(p.ctc) AS max_ctc
        FROM placements p JOIN companies c ON p.company_id = c.id
        GROUP BY c.id ORDER BY hires DESC LIMIT 10
    """).fetchall()

    package_dist = conn.execute("""
        SELECT
          SUM(CASE WHEN ctc < 4 THEN 1 ELSE 0 END) AS below_4,
          SUM(CASE WHEN ctc >= 4 AND ctc < 7 THEN 1 ELSE 0 END) AS range_4_7,
          SUM(CASE WHEN ctc >= 7 AND ctc < 12 THEN 1 ELSE 0 END) AS range_7_12,
          SUM(CASE WHEN ctc >= 12 THEN 1 ELSE 0 END) AS above_12
        FROM placements
    """).fetchone()

    conn.close()
    return jsonify({
        "totals": {
            "students": total_students,
            "companies": total_companies,
            "placements": total_placements,
            "internships": total_internships,
            "placed": placed_count,
            "seeking": seeking_count,
            "interning": interning_count
        },
        "ctc": {
            "avg": round(avg_ctc, 2),
            "max": round(max_ctc, 2),
            "min": round(min_ctc, 2)
        },
        "placement_rate": round((placed_count / total_students * 100), 1) if total_students else 0,
        "branch_stats": rows_to_dicts(branch_stats),
        "monthly_placements": rows_to_dicts(monthly),
        "sector_hiring": rows_to_dicts(sector_hiring),
        "top_companies": rows_to_dicts(top_companies),
        "package_distribution": dict(package_dist) if package_dist else {}
    }), 200


@app.route("/api/reports/students", methods=["GET"])
def report_students():
    conn = get_db()
    rows = conn.execute("""
        SELECT id, prn, name, email, phone, branch, year, division,
               cgpa, backlogs, ssc, hsc, status, skills, added_by, created_at
        FROM students ORDER BY branch, name
    """).fetchall()
    conn.close()
    return jsonify(rows_to_dicts(rows)), 200


@app.route("/api/reports/placements", methods=["GET"])
def report_placements():
    conn = get_db()
    rows = conn.execute("""
        SELECT p.id, s.prn, s.name AS student_name, s.branch, c.name AS company_name,
               p.role, p.ctc, p.placement_type, p.offer_date, p.joining_date, p.location
        FROM placements p
        JOIN students s ON p.student_id = s.id
        JOIN companies c ON p.company_id = c.id
        ORDER BY p.ctc DESC
    """).fetchall()
    conn.close()
    return jsonify(rows_to_dicts(rows)), 200


# ─────────────────────────────────────────────
#  MODULE 8 – ADMIN DASHBOARD STATS
# ─────────────────────────────────────────────

@app.route("/api/stats", methods=["GET"])
def get_stats():
    conn = get_db()
    total_students = conn.execute("SELECT COUNT(*) AS c FROM students").fetchone()["c"]
    total_companies = conn.execute("SELECT COUNT(*) AS c FROM companies").fetchone()["c"]
    total_placements = conn.execute("SELECT COUNT(*) AS c FROM placements").fetchone()["c"]
    total_internships = conn.execute("SELECT COUNT(*) AS c FROM internships").fetchone()["c"]
    conn.close()
    return jsonify({
        "total_students": total_students,
        "total_companies": total_companies,
        "total_placements": total_placements,
        "total_internships": total_internships
    }), 200


# ─────────────────────────────────────────────
#  DATA MANAGEMENT (backup / clear / sample)
# ─────────────────────────────────────────────

@app.route("/api/data/backup", methods=["GET"])
def backup_data():
    conn = get_db()
    data = {
        "students": rows_to_dicts(conn.execute("SELECT * FROM students").fetchall()),
        "companies": rows_to_dicts(conn.execute("SELECT * FROM companies").fetchall()),
        "internships": rows_to_dicts(conn.execute("SELECT * FROM internships").fetchall()),
        "placements": rows_to_dicts(conn.execute("SELECT * FROM placements").fetchall()),
        "users": rows_to_dicts(conn.execute("SELECT * FROM users").fetchall()),
    }
    conn.close()
    return jsonify(data), 200


@app.route("/api/data/clear", methods=["DELETE"])
def clear_data():
    conn = get_db()
    conn.execute("DELETE FROM placements")
    conn.execute("DELETE FROM internships")
    conn.execute("DELETE FROM students")
    conn.execute("DELETE FROM companies")
    conn.execute("DELETE FROM users")
    conn.commit()
    conn.close()
    return jsonify({"message": "All data cleared successfully"}), 200


@app.route("/api/data/sample", methods=["POST"])
def load_sample_data():
    conn = get_db()
    cur = conn.cursor()

    # Sample companies
    companies = [
        ("TCS", "IT / Software", "Mumbai", "HR Team", "hr@tcs.com", "022-67789999", 6.0, 50, "Active", "Leading IT company", "Software Engineer, Analyst"),
        ("Infosys", "IT / Software", "Pune", "Talent Acquisition", "careers@infosys.com", "020-22222222", 6.5, 30, "Active", "Global IT leader", "Systems Engineer, Developer"),
        ("Wipro", "IT / Software", "Bangalore", "HR Dept", "hr@wipro.com", "080-33333333", 6.0, 25, "Active", "IT multinational", "Project Engineer"),
        ("Cognizant", "IT / Software", "Chennai", "Recruitment", "recruit@cognizant.com", "044-44444444", 6.5, 20, "Active", "Technology company", "Programmer Analyst"),
        ("Deloitte", "Consulting", "Mumbai", "Talent Team", "talent@deloitte.com", "022-55555555", 7.0, 15, "Active", "Consulting giant", "Business Analyst, Consultant"),
        ("HDFC Bank", "Banking / Finance", "Mumbai", "HR", "hr@hdfc.com", "022-66666666", 6.0, 10, "Active", "Leading private bank", "Banking Officer"),
    ]
    company_ids = []
    for c in companies:
        try:
            cur.execute("""
                INSERT INTO companies (name,sector,location,contact_person,email,phone,min_cgpa,openings,status,about,roles)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)
            """, c)
            company_ids.append(cur.lastrowid)
        except sqlite3.IntegrityError:
            existing = conn.execute("SELECT id FROM companies WHERE name=?", (c[0],)).fetchone()
            if existing:
                company_ids.append(existing["id"])

    # Sample students
    students = [
        ("BCCA2024001", "Aarav Sharma", "aarav@email.com", "9876543210", "BCCA", "Final Year", "A", 8.5, 0, 88.0, 82.0, "Placed", "Python, Django, SQL", "Nagpur", "Admin"),
        ("BCCA2024002", "Priya Patel", "priya@email.com", "9876543211", "BCCA", "Final Year", "A", 7.8, 0, 85.0, 79.0, "Placed", "Java, Spring, MySQL", "Pune", "Admin"),
        ("BCCA2024003", "Rahul Verma", "rahul@email.com", "9876543212", "BCCA", "Final Year", "B", 7.2, 1, 75.0, 70.0, "Seeking", "React, Node.js, MongoDB", "Mumbai", "Admin"),
        ("BCCA2024004", "Sneha Gupta", "sneha@email.com", "9876543213", "BCCA", "Final Year", "B", 8.9, 0, 92.0, 88.0, "Placed", "Data Science, Python, ML", "Delhi", "Admin"),
        ("BCCA2024005", "Arjun Singh", "arjun@email.com", "9876543214", "BCCA", "Final Year", "A", 6.5, 2, 68.0, 65.0, "Seeking", "C++, Java", "Nagpur", "Admin"),
        ("CSE2024001", "Nisha Desai", "nisha@email.com", "9876543215", "Computer Science", "Final Year", "A", 9.1, 0, 95.0, 91.0, "Placed", "AI, TensorFlow, Python", "Bangalore", "Admin"),
        ("CSE2024002", "Karan Mehta", "karan@email.com", "9876543216", "Computer Science", "Final Year", "B", 7.5, 0, 80.0, 76.0, "Interning", "DevOps, Docker, AWS", "Chennai", "Admin"),
        ("IT2024001", "Pooja Joshi", "pooja@email.com", "9876543217", "Information Technology", "Final Year", "A", 8.0, 0, 83.0, 78.0, "Seeking", "PHP, Laravel, Vue.js", "Hyderabad", "Admin"),
        ("MBA2024001", "Vikram Rao", "vikram@email.com", "9876543218", "MBA", "Final Year", "A", 7.9, 0, 77.0, 74.0, "Placed", "Finance, Excel, SAP", "Mumbai", "Admin"),
        ("MECH2024001", "Anjali Kumar", "anjali@email.com", "9876543219", "Mechanical", "Final Year", "A", 7.3, 1, 72.0, 68.0, "Seeking", "AutoCAD, SolidWorks", "Nagpur", "Admin"),
    ]
    student_ids = []
    for s in students:
        try:
            cur.execute("""
                INSERT INTO students (prn,name,email,phone,branch,year,division,cgpa,backlogs,ssc,hsc,status,skills,address,added_by)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """, s)
            student_ids.append(cur.lastrowid)
        except sqlite3.IntegrityError:
            existing = conn.execute("SELECT id FROM students WHERE prn=?", (s[0],)).fetchone()
            if existing:
                student_ids.append(existing["id"])

    # Sample placements (only if we have students and companies)
    if len(student_ids) >= 4 and len(company_ids) >= 4:
        placements = [
            (student_ids[0], company_ids[0], "Software Engineer", 6.5, "On-Campus", "2024-10-01", "2025-01-15", "Mumbai"),
            (student_ids[1], company_ids[1], "Systems Engineer", 4.5, "On-Campus", "2024-10-15", "2025-01-20", "Pune"),
            (student_ids[3], company_ids[3], "Programmer Analyst", 5.0, "On-Campus", "2024-11-01", "2025-02-01", "Chennai"),
            (student_ids[5], company_ids[4], "Business Analyst", 9.0, "On-Campus", "2024-09-15", "2025-01-10", "Mumbai"),
            (student_ids[8], company_ids[5], "Banking Officer", 7.5, "On-Campus", "2024-10-20", "2025-02-15", "Mumbai"),
        ]
        for p in placements:
            try:
                cur.execute("""
                    INSERT INTO placements (student_id,company_id,role,ctc,placement_type,offer_date,joining_date,location)
                    VALUES (?,?,?,?,?,?,?,?)
                """, p)
            except Exception:
                pass

    # Sample internships
    if len(student_ids) >= 3 and len(company_ids) >= 2:
        internships = [
            (student_ids[2], company_ids[1], "React Developer Intern", 15000, "2024-06-01", "2024-11-30", "Remote", "Completed"),
            (student_ids[6], company_ids[2], "DevOps Intern", 18000, "2024-07-01", "2024-12-31", "In-Office", "Ongoing"),
            (student_ids[7], company_ids[0], "PHP Developer Intern", 12000, "2024-08-01", "2025-01-31", "Hybrid", "Ongoing"),
        ]
        for i in internships:
            try:
                cur.execute("""
                    INSERT INTO internships (student_id,company_id,role,stipend,start_date,end_date,mode,status)
                    VALUES (?,?,?,?,?,?,?,?)
                """, i)
            except Exception:
                pass

    # Sample users
    users_data = [
        ("Admin User", "admin", "Admin", "Placement Cell", "admin@raisoni.net", "Active"),
        ("Dr. Priya Sharma", "psharma", "Placement Officer", "Computer Science", "psharma@raisoni.net", "Active"),
        ("Prof. Rahul Joshi", "rjoshi", "Faculty", "Information Technology", "rjoshi@raisoni.net", "Active"),
    ]
    for u in users_data:
        try:
            cur.execute("""
                INSERT INTO users (name, username, role, department, email, status)
                VALUES (?, ?, ?, ?, ?, ?)
            """, u)
        except sqlite3.IntegrityError:
            pass

    conn.commit()
    conn.close()
    return jsonify({"message": "Sample data loaded successfully"}), 200


# ─────────────────────────────────────────────
#  STATIC FILE ROUTE (keep last)
# ─────────────────────────────────────────────

@app.route("/<path:filename>", methods=["GET"])
def serve_static(filename):
    file_path = STATIC_DIR / filename
    if file_path.exists():
        return send_from_directory(STATIC_DIR, filename)
    return jsonify({"error": "File not found"}), 404


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=False)