"""Chat CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.chat.types import CreateChatResponse


async def create_chat(
    conn: asyncpg.Connection,
    session_id: UUID,
    scenario_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    position: int = 0,
    mcp: bool = False,
) -> CreateChatResponse:
    """Create a chat entry with optional connection tables."""
    chat_id = await conn.fetchval(
        """
        INSERT INTO chat_entry (session_id, "position", mcp, generated)
        VALUES ($1, $2, $3, true)
        RETURNING id
        """,
        session_id,
        position,
        mcp,
    )

    if chat_id is None:
        raise ValueError("Failed to create chat entry")

    for scenario_id in scenario_ids or []:
        await conn.execute(
            """
            INSERT INTO chat_scenarios_connection (chat_id, scenarios_id, generated)
            VALUES ($1, $2, true)
            """,
            chat_id,
            scenario_id,
        )

    for department_id in department_ids or []:
        await conn.execute(
            """
            INSERT INTO chat_departments_connection (chat_id, departments_id, generated)
            VALUES ($1, $2, true)
            """,
            chat_id,
            department_id,
        )

    return CreateChatResponse(id=chat_id)
