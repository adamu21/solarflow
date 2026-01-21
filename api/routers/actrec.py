import json
from fastapi import FastAPI, APIRouter, HTTPException, Query
from db import get_conn

router = APIRouter()

@router.get("/actrec")
def get_actrec(
    top: int = Query(200, ge=1, le=500, description="How many rows to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination")
):
    """
    Returns rows from [dbo].[actrec], selecting only the specified columns.
    Uses OFFSET/FETCH with 2 parameter markers (?) for (offset, top).
    """
    try:
        with get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """
                SELECT _idnum, recnum, jobnme, shtnme, addrs1
                FROM [dbo].[actrec]
                ORDER BY recnum DESC
                OFFSET ? ROWS FETCH NEXT ? ROWS ONLY;
                """,
                (offset, top),
            )
            cols = [c[0] for c in cur.description]
            rows = cur.fetchall()
            data = [dict(zip(cols, r)) for r in rows]
            # serialize decimals/datetimes if needed
            data = json.loads(json.dumps(data, default=str))
            return {"data": data, "count": len(data), "offset": offset, "top": top}
    except Exception as e:
        # This returns 500 with a friendly message to the client
        raise HTTPException(status_code=500, detail=f"DB query failed: {e}")
