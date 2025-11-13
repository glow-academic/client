"""Persona search endpoint - v3 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.db import get_db
from app.mcp import server
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter()


class FindPersonasRequest(BaseModel):
    """Request to search personas."""

    query: str
    limit: int = 10


class PersonaSearchResult(BaseModel):
    """Persona search result."""

    id: str
    name: str
    description: str | None
    score: int


@router.post("/search", response_model=list[PersonaSearchResult])
@server.tool()
async def find_personas(
    request: FindPersonasRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> list[PersonaSearchResult]:
    """
    🔎 Find personas by name
    ------------------------
    Performs a case-insensitive, fuzzy search on persona names.

    Input
        • query - Name of the persona to search for
        • limit - Max results (default: 10)

    Returns
        [ { "id": "...", "name": "...", "description": "...", "score": ... }, ... ]
        or [ { "error": "Database error: ..." } ] on failure

    Quick-start
        ask:  "Find the aggressive persona"
        call: await find_personas("Aggressive")

    See also 👉 persona_overview() for detailed persona data.
    """
    try:
        sql = load_sql("sql/v3/personas/search.sql")
        rows = await conn.fetch(sql, request.query, request.limit)

        results = []
        for row in rows:
            results.append(
                PersonaSearchResult(
                    id=str(row["id"]),
                    name=row["name"],
                    description=row["description"],
                    score=int(row["score"]),
                )
            )

        return results
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Search error: {str(e)}"
        )

