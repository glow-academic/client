"""View wrapper for audits list entries."""

from datetime import datetime
from uuid import UUID

import asyncpg
from pydantic import BaseModel, Field

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/audit/list/get_audit_list_view_complete.sql"


class AuditViewItem(BaseModel):
    """Single item from the audits list view."""

    audit_id: UUID
    session_id: UUID | None = None
    audit_created_at: datetime | None = None
    message: str | None = None
    endpoint: str | None = None
    error: bool = False


class GetAuditListViewResponse(BaseModel):
    """Response containing audits list data."""

    items: list[AuditViewItem] = Field(default_factory=list)
    total_count: int = Field(default=0)


async def get_audit_list_view_internal(
    conn: asyncpg.Connection,
    session_id_filter: UUID | None = None,
    session_ids: list[UUID] | None = None,
    error_filter: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_order: str = "desc",
    page_limit: int = 50,
    page_offset: int = 0,
    bypass_cache: bool = False,
) -> GetAuditListViewResponse:
    """Internal function for fetching audits data from MV."""
    from app.sql.types import GetAuditListViewSqlParams

    cache_key_val = cache_key(
        "views/audit/list/get",
        {
            "session_id_filter": str(session_id_filter) if session_id_filter else None,
            "session_ids": [str(s) for s in session_ids] if session_ids else None,
            "error_filter": error_filter,
            "date_from": date_from.isoformat() if date_from else None,
            "date_to": date_to.isoformat() if date_to else None,
            "sort_order": sort_order,
            "page_limit": page_limit,
            "page_offset": page_offset,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return GetAuditListViewResponse.model_validate(cached)

    params = GetAuditListViewSqlParams(
        session_id_filter=session_id_filter,
        session_ids=session_ids,
        error_filter=error_filter,
        date_from=date_from or datetime.min,
        date_to=date_to or datetime.max,
        sort_order_field=sort_order,
        page_limit_val=page_limit,
        page_offset_val=page_offset,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[AuditViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                AuditViewItem(
                    audit_id=item.audit_id,
                    session_id=item.session_id,
                    audit_created_at=item.audit_created_at,
                    message=item.message,
                    endpoint=item.endpoint,
                    error=item.error or False,
                )
            )

    response = GetAuditListViewResponse(
        items=items,
        total_count=result.total_count or 0 if result else 0,
    )

    await set_cached(
        cache_key_val,
        response.model_dump(mode="json"),
        ttl=60,
        tags=["views", "audit", "list"],
    )

    return response
