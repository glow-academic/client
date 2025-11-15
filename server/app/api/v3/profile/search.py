"""Profile search endpoint - v3 API."""


from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.main import get_pool, server
from app.utils.sql_helper import load_sql

router = APIRouter()


class FindProfilesRequest(BaseModel):
    """Request to search profiles."""

    query: str
    limit: int = 10


class ProfileSearchResult(BaseModel):
    """Profile search result."""

    id: str
    first_name: str | None
    last_name: str | None
    alias: str | None
    role: str | None
    full_name: str
    score: int


@router.post("/search", response_model=list[ProfileSearchResult])
@server.tool()
async def find_profiles(
    request: FindProfilesRequest,
) -> list[ProfileSearchResult]:
    """
    🔎 Find profiles by name
    ------------------------
    Fuzzy first/last/alias search.

    Input
      • query - Name or alias to search for
      • limit - Max results (default: 10)

    Returns
      [
        {
          "id": str,           # Profile UUID
          "first_name": str | None,
          "last_name": str | None,
          "alias": str | None,
          "role": str | None,
          "full_name": str,    # "First Last" or alias or "Unknown"
          "score": int         # Heuristic match score
        },
        ...
      ]

    Quick-start
      ask:  "Find everyone named Jordan"
      call: await find_profiles("Jordan")

    See also 👉 profile_overview() for detailed profile data.
    """
    pool = get_pool()
    if not pool:
        raise HTTPException(
            status_code=500, detail="Database connection pool not available"
        )

    try:
        async with pool.acquire() as conn:
            sql = load_sql("sql/v3/profile/search.sql")
            rows = await conn.fetch(sql, request.query, request.limit)

            results = []
            for row in rows:
                first = row["first_name"]
                last = row["last_name"]
                alias = row["alias"]
                full_name = (
                    " ".join(x for x in (first, last) if x) or alias or "Unknown"
                )

                results.append(
                    ProfileSearchResult(
                        id=str(row["id"]),
                        first_name=first,
                        last_name=last,
                        alias=alias,
                        role=row["role"],
                        full_name=full_name,
                        score=int(row["score"]),
                    )
                )

            return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e
