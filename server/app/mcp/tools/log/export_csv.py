# export_csv.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import asyncpg  # type: ignore
from app.services.export_service import ExportService


async def export_csv(conn: asyncpg.Connection, sql: str) -> str:
    """Export query results as CSV download (SELECT only, 1000-row limit)."""
    service = ExportService(conn)
    return await service.export_to_csv(sql, max_rows=1000)
