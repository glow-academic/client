"""Helpers for resolving tools and recording call arg values."""

from uuid import UUID

import asyncpg  # type: ignore

from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached


class ToolArgInfo:
    """Single arg definition from a tool's args_ids."""

    def __init__(self, args_id: UUID, name: str, field_type: str) -> None:
        self.args_id = args_id
        self.name = name
        self.field_type = field_type


class ToolInfo:
    """Resolved tool with its args."""

    def __init__(self, tool_id: UUID, args: list[ToolArgInfo]) -> None:
        self.tool_id = tool_id
        self.args = args


async def resolve_tool(
    conn: asyncpg.Connection,
    operation: str,
    target: str,
    *,
    scope: str = "entries",
) -> ToolInfo | None:
    """Resolve tool_id + args by operation and target.

    Looks up tools_resource by operation + target across the appropriate
    scope column (entries, resources, or artifacts).

    Args:
        operation: Tool operation (e.g. "create", "link")
        target: Target type (e.g. "attempts", "names", "agent")
        scope: Which column to match — "entries", "resources", or "artifacts"
    """
    cache_key = f"tool_info:{scope}:{operation}:{target}"
    cached = await get_cached(cache_key)
    if cached:
        return cached

    if scope not in ("entries", "resources", "artifacts"):
        return None

    row = await conn.fetchrow(
        f"""
        SELECT id, args_ids
        FROM tools_resource
        WHERE operation = $1
          AND $2 = ANY({scope})
          AND active = true
        LIMIT 1
        """,
        operation,
        target,
    )
    if not row:
        return None

    tool_id = row["id"]
    args_ids = row["args_ids"] or []

    args: list[ToolArgInfo] = []
    if args_ids:
        arg_rows = await conn.fetch(
            """
            SELECT id, name, field_type
            FROM args_resource
            WHERE id = ANY($1::uuid[])
              AND active = true
            """,
            args_ids,
        )
        args = [
            ToolArgInfo(
                args_id=r["id"],
                name=r["name"],
                field_type=r["field_type"],
            )
            for r in arg_rows
        ]

    tool_info = ToolInfo(tool_id=tool_id, args=args)
    await set_cached(cache_key, tool_info, ttl=3600)
    return tool_info


# Backwards-compatible alias for existing entry callers
async def resolve_tool_for_entry(
    conn: asyncpg.Connection,
    operation: str,
    entry_type: str,
) -> ToolInfo | None:
    """Resolve tool for an entry type. Delegates to resolve_tool."""
    return await resolve_tool(conn, operation, entry_type, scope="entries")


async def record_call_args(
    conn: asyncpg.Connection,
    call_id: UUID,
    tool_info: ToolInfo,
    request_dict: dict,
    mcp: bool = False,
) -> None:
    """Record arg values for a call.

    For each arg in the tool's definition, inserts:
    - calls_args_entry (the value)
    - calls_args_args_connection (link to args_resource)
    """
    for arg in tool_info.args:
        if arg.name not in request_dict:
            continue

        value = request_dict[arg.name]
        if value is None:
            continue

        str_val = str(value) if arg.field_type == "string" else None
        num_val = float(value) if arg.field_type == "number" else None
        bool_val = bool(value) if arg.field_type == "boolean" else None

        row_id = await conn.fetchval(
            """
            INSERT INTO calls_args_entry
                (call_id, string_value, number_value, boolean_value, mcp)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
            """,
            call_id,
            str_val,
            num_val,
            bool_val,
            mcp,
        )

        await conn.execute(
            """
            INSERT INTO calls_args_args_connection
                (calls_args_entry_id, args_id)
            VALUES ($1, $2)
            """,
            row_id,
            arg.args_id,
        )
