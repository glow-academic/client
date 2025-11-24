"""Video search endpoint - v3 API."""


from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.main import get_pool, server
from app.utils.sql_helper import load_sql

router = APIRouter()


class FindVideosRequest(BaseModel):
    """Request to search videos."""

    query: str
    limit: int = 200
    department_ids: list[str] | None = None


class VideoSearchResult(BaseModel):
    """Video search result."""

    id: str
    name: str | None
    description: str | None
    length_seconds: int
    department_ids: list[str] | None
    score: int


@router.post("/search", response_model=list[VideoSearchResult])
async def find_videos(
    request: FindVideosRequest,
) -> list[VideoSearchResult]:
    """
    🔎 Find videos by name/description
    -----------------------------------
    Fuzzy, case-insensitive search on video name and description.
    Supports optional department filtering.

    Input
        • query - Video name or description to search for
        • limit - Max results (default: 200)
        • department_ids - Optional list of department IDs to filter by

    Returns
        [
            {
                "id": str,                    # Video UUID
                "name": str | None,           # Video name/title
                "description": str | None,    # Video description
                "length_seconds": int,         # Video length in seconds
                "department_ids": list[str] | None,  # Department IDs (if any)
                "score": int                  # Heuristic match score
            },
            ...
        ]
    """
    pool = get_pool()
    if not pool:
        raise HTTPException(
            status_code=500, detail="Database connection pool not available"
        )

    try:
        async with pool.acquire() as conn:
            sql = load_sql("sql/v3/videos/search.sql")
            # Convert department_ids to array format for SQL
            dept_ids_array = request.department_ids if request.department_ids else None
            rows = await conn.fetch(sql, request.query, request.limit, dept_ids_array)

            results = []
            for row in rows:
                dept_ids = None
                if row.get("department_ids"):
                    dept_ids = [str(d) for d in row["department_ids"]]

                results.append(
                    VideoSearchResult(
                        id=str(row["id"]),
                        name=row["name"],
                        description=row["description"],
                        length_seconds=int(row["length_seconds"]),
                        department_ids=dept_ids,
                        score=int(row["score"]),
                    )
                )

            return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e

