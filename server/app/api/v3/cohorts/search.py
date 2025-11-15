"""Cohort search endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_pool
from app.main import server
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class FindCohortsRequest(BaseModel):
    """Request to search cohorts."""

    query: str
    limit: int = 10


class CohortSearchResult(BaseModel):
    """Cohort search result."""

    id: str
    title: str
    active: bool
    description: str | None
    profile_count: int
    score: int


@router.post("/search", response_model=list[CohortSearchResult])
@server.tool()
async def find_cohorts(
    request: FindCohortsRequest,
) -> list[CohortSearchResult]:
    """
    🔎 Find cohorts by title/description
    ------------------------------------
    Fuzzy, case-insensitive search on cohort title and description.

    Input
        • query - Cohort title or description to search for
        • limit - Max results (default: 10)

    Returns
        [
            {
                "id": "...",
                "title": "...",
                "active": <bool>,
                "description": "...",
                "profile_count": <int>,
                "score": <int>
            },
            ...
        ]

    Quick-start
        ask:  "Find all Fall 2025 cohorts"
        call: await find_cohorts("Fall 2025")

    See also 👉 cohort_overview() for detailed cohort data.
    """
    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database connection pool not available")

    try:
        async with pool.acquire() as conn:
            sql = load_sql("sql/v3/cohorts/search.sql")
            rows = await conn.fetch(sql, request.query, request.limit)

            results = []
            for row in rows:
                results.append(
                    CohortSearchResult(
                        id=str(row["id"]),
                        title=row["title"],
                        active=row["active"],
                        description=row["description"],
                        profile_count=int(row["profile_count"]),
                        score=int(row["score"]),
                    )
                )

            return results
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Search error: {str(e)}"
        )

