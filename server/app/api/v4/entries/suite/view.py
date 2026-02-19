"""View wrapper for benchmark bundle (suite) entries."""

from uuid import UUID

import asyncpg
from pydantic import BaseModel, Field

from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/benchmark/bundle/get_suite_view_complete.sql"


class GetSuiteViewResponse(BaseModel):
    """Thin MV-backed view response for a single benchmark bundle."""

    profile_has_access: bool = False
    suite_entry_id: UUID | None = None
    benchmark_id: UUID | None = None
    department_ids: list[UUID] = Field(default_factory=list)
    model_ids: list[UUID] = Field(default_factory=list)
    prompt_ids: list[UUID] = Field(default_factory=list)
    instruction_ids: list[UUID] = Field(default_factory=list)
    voice_ids: list[UUID] = Field(default_factory=list)
    temperature_level_ids: list[UUID] = Field(default_factory=list)
    reasoning_level_ids: list[UUID] = Field(default_factory=list)
    tool_ids: list[UUID] = Field(default_factory=list)
    key_ids: list[UUID] = Field(default_factory=list)
    flag_ids: list[UUID] = Field(default_factory=list)
    name_ids: list[UUID] = Field(default_factory=list)
    description_ids: list[UUID] = Field(default_factory=list)


async def get_suite_view_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    suite_entry_id: UUID,
) -> GetSuiteViewResponse:
    """Thin MV-backed bundle scope lookup used by benchmark artifacts."""
    from app.sql.types import GetSuiteViewSqlParams

    params = GetSuiteViewSqlParams(
        profile_id_filter=profile_id,
        suite_entry_id_filter=suite_entry_id,
    )
    row = await execute_sql_typed(conn, SQL_PATH, params=params)

    if not row:
        return GetSuiteViewResponse()

    return GetSuiteViewResponse(
        profile_has_access=row.profile_has_access or False,
        suite_entry_id=row.suite_entry_id,
        benchmark_id=row.benchmark_id,
        department_ids=list(row.department_ids or []),
        model_ids=list(row.model_ids or []),
        prompt_ids=list(row.prompt_ids or []),
        instruction_ids=list(row.instruction_ids or []),
        voice_ids=list(row.voice_ids or []),
        temperature_level_ids=list(row.temperature_level_ids or []),
        reasoning_level_ids=list(row.reasoning_level_ids or []),
        tool_ids=list(row.tool_ids or []),
        key_ids=list(row.key_ids or []),
        flag_ids=list(row.flag_ids or []),
        name_ids=list(row.name_ids or []),
        description_ids=list(row.description_ids or []),
    )
