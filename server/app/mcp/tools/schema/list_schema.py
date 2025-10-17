# list_schema.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import asyncpg  # type: ignore
from app.services.schema_service import SchemaService


async def list_schema(conn: asyncpg.Connection) -> str:
    """Lists all tables and columns in the public schema."""
    service = SchemaService(conn)
    return await service.list_schema_columns()
