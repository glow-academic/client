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
    emails: list[str] | None  # List of all active emails
    primary_email: str | None  # Primary email (first in emails array if exists)
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
    Fuzzy first/last/email search.

    Input
      • query - Name or email to search for
      • limit - Max results (default: 10)

    Returns
      [
        {
          "id": str,           # Profile UUID
          "first_name": str | None,
          "last_name": str | None,
          "email": str | None,
          "role": str | None,
          "full_name": str,    # "First Last" or email or "Unknown"
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
                emails = row.get("emails") or []
                primary_email = row.get("primary_email")
                # Use primary email or first email for full_name fallback
                email_display = primary_email or (emails[0] if emails else None)
                full_name = (
                    " ".join(x for x in (first, last) if x)
                    or email_display
                    or "Unknown"
                )

                results.append(
                    ProfileSearchResult(
                        id=str(row["id"]),
                        first_name=first,
                        last_name=last,
                        emails=emails if isinstance(emails, list) else None,
                        primary_email=primary_email,
                        role=row["role"],
                        full_name=full_name,
                        score=int(row["score"]),
                    )
                )

            return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}") from e
