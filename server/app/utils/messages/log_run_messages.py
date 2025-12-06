"""Utility function to log system and developer messages for AI model runs."""

import uuid
from typing import Any

import asyncpg
from agents.items import TResponseInputItem
from app.utils.sql_helper import load_sql


async def log_run_messages(
    conn: asyncpg.Connection,
    run_id: uuid.UUID,
    system_prompt: str | None,
    input_items: list[TResponseInputItem] | None = None,
    developer_message_contents: list[str] | None = None,
    assistant_output: str | None = None,
    department_id: uuid.UUID | None = None,
    chat_id: uuid.UUID | None = None,
) -> None:
    """
    Log system, developer, and assistant messages for a run.
    
    For non-simulation handlers (scenarios, documents, videos, etc.):
    - Links system message (from agent's system_prompt)
    - Links developer messages (from input_items with role="developer" or from developer_message_contents)
    - Creates assistant message (from assistant_output - the model's response)
    - Creates proper message_tree branching: System → Developer → Assistant (or System → Assistant if no developer)
    
    Note: This function does NOT log user messages as those are only relevant for simulation handlers.
    
    Args:
        conn: Database connection
        run_id: The run ID to link messages to
        system_prompt: The agent's system prompt (will be linked via link_system_developer_messages_to_run.sql)
        input_items: Optional list of input items, developer messages will be extracted from those with role="developer"
        developer_message_contents: Optional list of developer message content strings to link directly
        assistant_output: Optional assistant message content (the model's output/response)
        department_id: Optional department ID for system message linking
        chat_id: Optional chat ID (for scenario developer messages)
    """
    # Link system message (and scenario developer message if chat_id provided)
    # This handles system message linking and creates System → Developer branching
    if system_prompt or chat_id:
        sql_link_sys_dev = load_sql(
            "sql/v3/model_runs/link_system_developer_messages_to_run.sql"
        )
        await conn.fetchrow(
            sql_link_sys_dev,
            str(run_id),
            str(department_id) if department_id else None,
            str(chat_id) if chat_id else None,
        )
    
    # Link developer messages from input_items if provided
    developer_contents: list[str] = []
    if input_items:
        developer_messages = [
            item for item in input_items
            if item and isinstance(item, dict) and item.get("role") == "developer"
        ]
        for dev_msg in developer_messages:
            content = dev_msg.get("content", "")
            if isinstance(content, str):
                stripped = content.strip()  # type: ignore[attr-defined]
                if stripped:
                    developer_contents.append(stripped)
    
    # Add developer message contents passed directly
    if developer_message_contents:
        for content in developer_message_contents:
            if isinstance(content, str):
                stripped = content.strip()
                if stripped:
                    developer_contents.append(stripped)
    
    # Link each developer message to the run
    sql_link_dev = load_sql("sql/v3/simulations/link_developer_message_to_run.sql")
    developer_message_ids: list[uuid.UUID] = []
    for content in developer_contents:
        result = await conn.fetchrow(
            sql_link_dev,
            content,
            str(run_id),
        )
        if result and result.get("message_id"):
            developer_message_ids.append(uuid.UUID(result["message_id"]))
    
    # Create assistant message if output provided
    if assistant_output and assistant_output.strip():
        # Get the parent message ID (developer if exists, otherwise system)
        parent_message_id: uuid.UUID | None = None
        
        # Try to get developer message ID (use the last one if multiple)
        if developer_message_ids:
            parent_message_id = developer_message_ids[-1]
        else:
            # Get system message ID from the run
            sys_dev_result = await conn.fetchrow(
                load_sql("sql/v3/model_runs/link_system_developer_messages_to_run.sql"),
                str(run_id),
                str(department_id) if department_id else None,
                str(chat_id) if chat_id else None,
            )
            if sys_dev_result and sys_dev_result.get("system_message_id"):
                parent_message_id = uuid.UUID(sys_dev_result["system_message_id"])
        
        # Create assistant message with branch
        sql_create_assistant = load_sql("sql/v3/messages/create_assistant_message_with_branch.sql")
        await conn.fetchrow(
            sql_create_assistant,
            assistant_output.strip(),
            str(run_id),
            str(parent_message_id) if parent_message_id else None,
        )

