# api/main.py
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from db import get_conn  # health check uses this


load_dotenv()

CORS_ORIGINS = [
    o.strip() for o in os.getenv("CORS_ALLOW_ORIGINS", "").split(",") if o.strip()
]

# --- FastAPI app ---
app = FastAPI(title="SolarFlow API (FastAPI + SQL Server)", version="0.1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],  # permissive in dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    try:
        with get_conn() as _:
            return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

#### Feature Routes
from routers.actrec import router as actrec_router  # your feature router
from routers.workorders import router as workorders_router

app.include_router(actrec_router)
app.include_router(workorders_router)


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
