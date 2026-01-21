
# api/routers/workorders.py
"""
Work Orders feature endpoints.

- GET /workorders: list work orders with optional search + paging
"""

import json
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any
from db import get_conn

router = APIRouter()

@router.get("/workorders")
def list_workorders(
    top: int = Query(20, ge=1, le=500, description="How many rows to return"),
    offset: int = Query(0, ge=0, description="Where to start (for paging)"),
    q: str | None = Query(None, description="Optional search text"),
):
    """
    Returns rows from [dbo].[WorkOrderLIST], selecting the requested columns.
    If a search term is provided (q), matches across several text-like fields.
    Results are ordered and paged (OFFSET/FETCH).
    """

    # ---- Build WHERE clause if `q` is provided (safe parameterization) ----
    where_sql = ""
    params: List[Any] = []
    if q:
        # We'll search across a few useful columns (case-insensitive LIKE).
        # ordnum is numeric, so we CAST it to text for searching.
        pattern = f"%{q}%"
        where_sql = """
            WHERE
                CAST(ordnum AS VARCHAR(50)) LIKE ?
                OR dscrpt LIKE ?
                OR clnnme LIKE ?
                OR shtcln LIKE ?
                OR addrs LIKE ?
                OR contact LIKE ?
                OR phone LIKE ?
                OR email LIKE ?
        """
        params.extend([pattern] * 8)

    # ---- Main SELECT (only the columns you listed) ----
    sql = f"""
        SELECT
            orddte,          -- date
            ordnum,          -- int
            dscrpt,          -- string
            recnum,          -- int
            clnnum,          -- int
            clnnme,          -- string
            shtcln,          -- string
            addrs,           -- string
            contact,         -- string
            phone,           -- string
            email            -- string
        FROM [dbo].[WorkOrderLIST]
        {where_sql}
        ORDER BY recnum DESC
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY;
    """

    # Paging params come last (after any search params)
    params.extend([offset, top])

    try:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(sql, params)

            cols = [c[0] for c in cur.description]
            rows = cur.fetchall()
            data = [dict(zip(cols, r)) for r in rows]

            # Convert non-JSON types (e.g., dates/decimals) to strings
            data = json.loads(json.dumps(data, default=str))

            return {
                "data": data,
                "count": len(data),
                "offset": offset,
                "top": top,
                "q": q,
            }
    except Exception as e:
        # Friendly error to the client without leaking stack traces
        raise HTTPException(status_code=500, detail=f"DB query failed: {e}")
