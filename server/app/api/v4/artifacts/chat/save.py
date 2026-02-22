"""Chat save endpoint — populates chat_resolved_*_connection tables from generation.

Used by generation_complete to persist generated resources (personas, parameters, etc.)
onto the chat_resolved_entry created by prepare_training_start.
"""

import uuid
from typing import Any

import asyncpg  # type: ignore

from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

# Map resource_type → (connection_table, fk_column)
CHAT_RESOLVED_CONNECTION_MAP: dict[str, tuple[str, str]] = {
    "personas": ("chat_resolved_personas_connection", "personas_id"),
    "scenarios": ("chat_resolved_scenarios_connection", "scenarios_id"),
    "parameters": ("chat_resolved_parameters_connection", "parameters_id"),
    "fields": ("chat_resolved_fields_connection", "fields_id"),
    "departments": ("chat_resolved_departments_connection", "departments_id"),
    "documents": ("chat_resolved_documents_connection", "documents_id"),
    "parameter_fields": (
        "chat_resolved_parameter_fields_connection",
        "parameter_fields_id",
    ),
    "questions": ("chat_resolved_questions_connection", "questions_id"),
    "options": ("chat_resolved_options_connection", "options_id"),
    "videos": ("chat_resolved_videos_connection", "videos_id"),
    "images": ("chat_resolved_images_connection", "images_id"),
    "templates": ("chat_resolved_templates_connection", "templates_id"),
    "problem_statements": (
        "chat_resolved_problem_statements_connection",
        "problem_statements_id",
    ),
    "objectives": ("chat_resolved_objectives_connection", "objectives_id"),
}


async def save_chat_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID,
    resource_actions: dict[str, Any],
) -> uuid.UUID | None:
    """Save generated chat resources onto the chat_resolved_entry.

    The group_id here is the generation group_id. The chat_resolved_id should
    already exist (created by prepare_training_start). We extract it from
    the resource_actions or use the group_id as fallback.

    For each resource_type in resource_actions, inserts a connection row
    into chat_resolved_*_connection.

    Returns the chat_resolved_id on success.
    """
    # The chat_resolved_id may be passed as a special key in resource_actions
    chat_resolved_id_str = resource_actions.pop("_chat_resolved_id", None)
    if not chat_resolved_id_str:
        # Fallback: check if it was passed separately
        logger.warning("save_chat_internal: no _chat_resolved_id in resource_actions")
        return None

    chat_resolved_id = uuid.UUID(str(chat_resolved_id_str))

    try:
        for resource_type, action in resource_actions.items():
            if resource_type not in CHAT_RESOLVED_CONNECTION_MAP:
                continue

            table_name, fk_column = CHAT_RESOLVED_CONNECTION_MAP[resource_type]
            resource_id = (
                action.get("resource_id") if isinstance(action, dict) else None
            )
            if not resource_id:
                continue

            rid = uuid.UUID(str(resource_id))
            await conn.execute(
                f"""
                INSERT INTO {table_name} (
                    chat_resolved_id, {fk_column}, created_at, active, generated, mcp
                )
                VALUES ($1, $2, NOW(), true, true, false)
                ON CONFLICT (chat_resolved_id, {fk_column}) DO UPDATE
                    SET active = true, generated = true, updated_at = NOW()
                """,
                chat_resolved_id,
                rid,
            )

        await invalidate_tags(["chat", "training", "attempt"])

        return chat_resolved_id

    except Exception as e:
        logger.exception(f"Failed to save chat resources: {e}")
        return None
