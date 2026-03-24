# IPTS Backend - Flask API

This is the backend API for the Internship & Placement Tracking System (IPTS).

## Prerequisites

- Docker
- Docker Compose

## Quick Start

1. **Build and run the application:**
   ```bash
   docker-compose up --build
   ```

2. **Run in background:**
   ```bash
   docker-compose up -d --build
   ```

3. **Stop the application:**
   ```bash
   docker-compose down
   ```

## API Endpoints

The API will be available at `http://localhost:5000`

### Health Check
- `GET /` - API health check

### Students
- `GET /api/students` - Get all students
- `POST /api/students` - Create new student
- `GET /api/students/<id>` - Get student by ID
- `PUT /api/students/<id>` - Update student
- `DELETE /api/students/<id>` - Delete student

### Companies
- `GET /api/companies` - Get all companies
- `POST /api/companies` - Create new company
- `GET /api/companies/<id>` - Get company by ID
- `PUT /api/companies/<id>` - Update company
- `DELETE /api/companies/<id>` - Delete company

### Internships
- `GET /api/internships` - Get all internships
- `POST /api/internships` - Create new internship
- `PUT /api/internships/<id>` - Update internship
- `DELETE /api/internships/<id>` - Delete internship

### Placements
- `GET /api/placements` - Get all placements
- `POST /api/placements` - Create new placement
- `PUT /api/placements/<id>` - Update placement
- `DELETE /api/placements/<id>` - Delete placement

### Dashboard & Reports
- `GET /api/dashboard` - Dashboard statistics
- `GET /api/reports/students` - Student report
- `GET /api/reports/placements` - Placement report

## Database

The SQLite database is stored in the `data/` directory and persists between container restarts.

## Development

For development without Docker:

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the application:
   ```bash
   python app.py
   ```

## Environment Variables

- `FLASK_APP`: Flask application entry point (default: app.py)
- `FLASK_ENV`: Environment (development/production)
- `DB_DIR`: Database directory path (default: ./data)

## Volumes

- `./data:/app/data` - Database persistence
- `../static:/app/static:ro` - Static files (read-only)