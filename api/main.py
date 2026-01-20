import os
import json
import pyodbc
from typing import List
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

# --- Config ---
SQL_SERVER = os.getenv("SQL_SERVER", "localhost")
SQL_PORT = os.getenv("SQL_PORT", "1433")
SQL_DATABASE = os.getenv("SQL_DATABASE")
SQL_USER = os.getenv("SQL_USER")
SQL_PASSWORD = os.getenv("SQL_PASSWORD")
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "").split(",") if o.strip()]

if not all([SQL_DATABASE, SQL_USER, SQL_PASSWORD]):
    raise RuntimeError("Missing required DB env vars. Check .env file.")

# --- FastAPI app ---
app = FastAPI(title="SolarFlow API (FastAPI + SQL Server)", version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],  # be permissive in dev if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- SQL connection helper ---
def get_conn():
    # For initial dev, keep Encrypt=no;TrustServerCertificate=yes.
    # In prod, use a trusted cert on SQL and set Encrypt=yes;TrustServerCertificate=no.
    conn_str = (
        "DRIVER={ODBC Driver 18 for SQL Server};"
        f"SERVER={SQL_SERVER},{SQL_PORT};"
        f"DATABASE={SQL_DATABASE};"
        f"UID={SQL_USER};PWD={SQL_PASSWORD};"
        "Encrypt=no;TrustServerCertificate=yes;"
        "Connection Timeout=15;"
    )
    return pyodbc.connect(conn_str)

@app.get("/health")
def health():
    # Shallow health: try DB connect
    try:
        with get_conn() as conn:
            return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/actrec")
def get_actrec(
    top: int = Query(50, ge=1, le=500, description="How many rows"),
    offset: int = Query(0, ge=0, description="Offset for pagination")
):
    """
    Returns rows from [databaseName].[dbo].[actrec], paged.
    NOTE: Replace the ORDER BY with a stable key for deterministic paging.
    """
    try:
        with get_conn() as conn:
            cursor = conn.cursor()
            # Replace ORDER BY with a real key if available, e.g., ORDER BY DocId DESC
            query = """
                SELECT *
                FROM [dbo].[actrec]
                ORDER BY (SELECT NULL)
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY;
            """
            cursor.execute(query, (offset, top))
            columns = [col[0] for col in cursor.description]
            rows = cursor.fetchall()
            data = [dict(zip(columns, row)) for row in rows]
            # Convert non-serializable types (e.g., Decimal, datetime) to str
            data = json.loads(json.dumps(data, default=str))
            return {"data": data, "count": len(data), "offset": offset, "top": top}
    except Exception as e:
        raise HTTPException(status_code=500, detail="DB query failed: " + str(e))

# Used to Test if FastAPI is working. 
# Install in order:
# 1) python -m pip install --upgrade pip setuptools wheel
# 2) python -m pip install fastapi "uvicorn[standard]" python-dotenv
# 3) python -m uvicorn main:app --host 0.0.0.0 --port 8000
# Uncomment below and navigate to http://localhost:8000/health

# from fastapi import FastAPI
# app = FastAPI()
# @app.get("/health") 
# def health(): 
#     return {"status": "ok"}
