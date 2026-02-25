"""Chat save endpoint — populates attempt_chat_*_connection tables from generation.

Used by generation_complete to persist generated resources (personas, parameters, etc.)
onto the attempt_chat_entry created by prepare_training_start.
"""

import uuid
from typing import Any

import asyncpg  # type: ignore

from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

# Map resource_type → (connection_table, fk_column)
ATTEMPT_CHAT_CONNECTION_MAP: dict[str, tuple[str, str]] = {
    "personas": ("attempt_chat_personas_connection", "personas_id"),
    "scenarios": ("attempt_chat_scenarios_connection", "scenarios_id"),
    "parameters": ("attempt_chat_parameters_connection", "parameters_id"),
    "fields": ("attempt_chat_fields_connection", "fields_id"),
    "departments": ("attempt_chat_departments_connection", "departments_id"),
    "documents": ("attempt_chat_documents_connection", "documents_id"),
    "parameter_fields": (
        "attempt_chat_parameter_fields_connection",
        "parameter_fields_id",
    ),
    "questions": ("attempt_chat_questions_connection", "questions_id"),
    "options": ("attempt_chat_options_connection", "options_id"),
    "videos": ("attempt_chat_videos_connection", "videos_id"),
    "images": ("attempt_chat_images_connection", "images_id"),
    "templates": ("attempt_chat_templates_connection", "templates_id"),
    "problem_statements": (
        "attempt_chat_problem_statements_connection",
        "problem_statements_id",
    ),
    "objectives": ("attempt_chat_objectives_connection", "objectives_id"),
}


async def save_chat_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID,
    resource_actions: dict[str, Any],
) -> uuid.UUID | None:
    """Save generated chat resources onto the attempt_chat_entry.

    The group_id here is the generation group_id. The attempt_chat_id should
    already exist (created by prepare_training_start). We extract it from
    the resource_actions or use the group_id as fallback.

    For each resource_type in resource_actions, inserts a connection row
    into attempt_chat_*_connection.

    Returns the attempt_chat_id on success.
    """
    # The attempt_chat_id may be passed as a special key in resource_actions
    attempt_chat_id_str = resource_actions.pop("_attempt_chat_id", None)
    if not attempt_chat_id_str:
        # Fallback: check if it was passed separately
        logger.warning("save_chat_internal: no _attempt_chat_id in resource_actions")
        return None

    attempt_chat_id = uuid.UUID(str(attempt_chat_id_str))

    try:
        for resource_type, action in resource_actions.items():
            if resource_type not in ATTEMPT_CHAT_CONNECTION_MAP:
                continue

            table_name, fk_column = ATTEMPT_CHAT_CONNECTION_MAP[resource_type]
            resource_id = (
                action.get("resource_id") if isinstance(action, dict) else None
            )
            if not resource_id:
                continue

            rid = uuid.UUID(str(resource_id))
            await conn.execute(
                f"""
                INSERT INTO {table_name} (
                    attempt_chat_id, {fk_column}, created_at, active, generated, mcp
                )
                VALUES ($1, $2, NOW(), true, true, false)
                ON CONFLICT (attempt_chat_id, {fk_column}) DO UPDATE
                    SET active = true, generated = true, updated_at = NOW()
                """,
                attempt_chat_id,
                rid,
            )

        await invalidate_tags(["chat", "training", "attempt"])

        return attempt_chat_id

    except Exception as e:
        logger.exception(f"Failed to save chat resources: {e}")
        return None
