"""Departments login endpoint - returns list of active departments for login page."""

from typing import Annotated

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends
from pydantic import BaseModel


class DepartmentOption(BaseModel):
    """Department option for login page."""

    id: str
    title: str
    description: str


class DepartmentsLoginResponse(BaseModel):
    """Response with list of active departments."""

    departments: list[DepartmentOption]


router = APIRouter()


@router.get("/login", response_model=DepartmentsLoginResponse)
async def get_departments_for_login(
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DepartmentsLoginResponse:
    """Get list of active departments for login page."""
    sql_query = load_sql("sql/v3/departments/get_departments_for_login.sql")
    rows = await conn.fetch(sql_query)
    departments = [
        DepartmentOption(
            id=str(row["id"]),
            title=row["title"],
            description=row["description"]
        )
        for row in rows
    ]
    return DepartmentsLoginResponse(departments=departments)

