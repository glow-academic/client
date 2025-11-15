"""Schema list endpoint - v3 API."""

from typing import Annotated

import asyncpg  # type: ignore
from app.main import get_pool
from app.main import server
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, HTTPException

router = APIRouter()


@router.get("/list")
@server.tool()
async def list_schema() -> str:
    """
    Database schema overview
    Lists all tables and columns in the public schema.

    Quick-start
      ask:  "What tables are in the DB?"
      call: list_schema()
    """
    pool = get_pool()
    if not pool:
        raise HTTPException(status_code=500, detail="Database connection pool not available")

    try:
        async with pool.acquire() as conn:
            sql = load_sql("sql/v3/schema/list.sql")
            rows = await conn.fetch(sql)

            return "\n".join(
                f"{row['table_name']}.{row['column_name']} {row['data_type']}"
                for row in rows
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving schema: {str(e)}")

