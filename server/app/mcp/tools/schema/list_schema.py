# list_schema.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

import asyncpg  # type: ignore


async def list_schema(conn: asyncpg.Connection) -> str:
    """Lists all tables and columns in the public schema."""
    sql = """
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
    """
    
    rows = await conn.fetch(sql)
    return "\n".join(f"{row['table_name']}.{row['column_name']} {row['data_type']}" for row in rows)
