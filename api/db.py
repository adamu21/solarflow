import os
from dotenv import load_dotenv
import pyodbc

load_dotenv()

# --- Config ---
SQL_SERVER = os.getenv("SQL_SERVER", "localhost")
SQL_PORT = os.getenv("SQL_PORT", "1433")
SQL_DATABASE = os.getenv("SQL_DATABASE")
SQL_USER = os.getenv("SQL_USER")
SQL_PASSWORD = os.getenv("SQL_PASSWORD")


if not all([SQL_DATABASE, SQL_USER, SQL_PASSWORD]):
    raise RuntimeError("Missing required DB env vars. Check .env file.")

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