"""Utility function to log regeneration messages (user + assistant) for AI model runs."""

import uuid
from typing import Any

import asyncpg

from app.utils.sql_helper import load_sql


async def log_regeneration_messages(
    conn: asyncpg.Connection,
    run_id: uuid.UUID,
    previous_run_id: uuid.UUID,
    user_instructions: str,
    assistant_output: str,
    department_id: uuid.UUID | None = None,
) -> None:
    """
    Log regeneration messages for a run by reusing existing system/developer messages.
    
    For regeneration flows:
    - Reuses existing system/developer messages from previous_run_id (they're already linked via message_runs)
    - Creates new user message with regeneration instructions
    - Creates new assistant message with model output
    - Creates proper message_tree branching: previous_latest_message → User → Assistant
    
    Args:
        conn: Database connection
        run_id: The new run ID to link messages to
        previous_run_id: The previous run ID to get existing messages from
        user_instructions: The user's regeneration instructions
        assistant_output: The model's output/response
        department_id: Optional department ID (for linking system messages if needed)
    """
    # Get latest message from previous run (assistant if exists, otherwise developer/system)
    sql_get_latest = """
        SELECT m.id as latest_message_id
        FROM messages m
        JOIN message_runs mr ON mr.message_id = m.id
        WHERE mr.run_id = $1::uuid
        AND NOT EXISTS (
            SELECT 1 FROM message_tree mt 
            WHERE mt.parent_id = m.id AND mt.active = true
        )
        ORDER BY m.created_at DESC
        LIMIT 1
    """
    latest_row = await conn.fetchrow(sql_get_latest, str(previous_run_id))
    
    if not latest_row or not latest_row.get("latest_message_id"):
        # Fallback: get any system/developer message from previous run
        sql_fallback = """
            SELECT m.id as latest_message_id
            FROM messages m
            JOIN message_runs mr ON mr.message_id = m.id
            WHERE mr.run_id = $1::uuid
            AND m.role IN ('system', 'developer')
            ORDER BY m.created_at ASC
            LIMIT 1
        """
        latest_row = await conn.fetchrow(sql_fallback, str(previous_run_id))
    
    parent_message_id: uuid.UUID | None = None
    if latest_row and latest_row.get("latest_message_id"):
        parent_message_id = uuid.UUID(latest_row["latest_message_id"])
    
    # Link existing system/developer messages to new run (reuse them)
    # They're already shared via deduplication, just need to link via message_runs
    sql_link_existing = """
        INSERT INTO message_runs (message_id, run_id, created_at, updated_at)
        SELECT DISTINCT mr.message_id, $1::uuid, NOW(), NOW()
        FROM message_runs mr
        WHERE mr.run_id = $2::uuid
        AND EXISTS (
            SELECT 1 FROM messages m 
            WHERE m.id = mr.message_id 
            AND m.role IN ('system', 'developer')
        )
        ON CONFLICT (message_id, run_id) 
        DO UPDATE SET updated_at = NOW()
    """
    await conn.execute(sql_link_existing, str(run_id), str(previous_run_id))
    
    # Create user message with branch from latest message
    user_message_id: uuid.UUID | None = None
    if user_instructions and user_instructions.strip():
        sql_create_user = load_sql("sql/v3/messages/create_user_message_with_branch.sql")
        user_result = await conn.fetchrow(
            sql_create_user,
            user_instructions.strip(),
            str(run_id),
            str(parent_message_id) if parent_message_id else None,
        )
        
        if user_result and user_result.get("id"):
            user_message_id = uuid.UUID(user_result["id"])
    
    # Create assistant message with branch from user message (if exists) or latest message
    if assistant_output and assistant_output.strip():
        # Use user message as parent if it exists, otherwise use the latest message from previous run
        assistant_parent_id = user_message_id if user_message_id else parent_message_id
        
        sql_create_assistant = load_sql(
            "sql/v3/messages/create_assistant_message_with_branch.sql"
        )
        await conn.fetchrow(
            sql_create_assistant,
            assistant_output.strip(),
            str(run_id),
            str(assistant_parent_id) if assistant_parent_id else None,
        )

