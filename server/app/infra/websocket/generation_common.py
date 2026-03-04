"""Shared generation helpers for artifact socket handlers."""

from __future__ import annotations

import uuid
from typing import Any

from app.infra.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.globals import get_internal_sio
from app.routes.v5.socket.types import GenerateErrorApiRequest
from app.utils.sql_helper import load_sql

internal_sio = get_internal_sio()

CREATE_RUN_SQL_PATH = "app/sql/queries/generate/start/get_generation_run_context_and_create_run_complete.sql"
TEXT_RUN_CONTEXT_SQL_PATH = (
    "app/sql/queries/generate/text/get_text_run_context_for_existing_run_complete.sql"
)


def _normalize_key(value: str | None) -> str:
    if not value:
        return ""
    return value.lower().replace("_", "").replace("-", "")


def pick_agent_id(
    result: Any,
    agent_type: str | None,
    resource_types: list[str] | None,
) -> uuid.UUID | None:
    """Select an agent ID from SQL result using agent_type/resource_types hints."""
    agent_fields: dict[str, uuid.UUID] = {}
    for attr in dir(result):
        if not attr.endswith("_agent_id"):
            continue
        value = getattr(result, attr, None)
        if not value:
            continue
        key = attr[: -len("_agent_id")]
        agent_fields[_normalize_key(key)] = value

    if not agent_fields:
        return None

    normalized_agent_type = _normalize_key(agent_type)
    aliases = {
        "name": "names",
        "description": "descriptions",
        "department": "departments",
        "flag": "flags",
        "field": "fields",
        "parameter": "parameters",
        "arg": "args",
        "output": "argsoutputs",
        "argsoutput": "argsoutputs",
    }
    if normalized_agent_type in aliases:
        normalized_agent_type = _normalize_key(aliases[normalized_agent_type])

    if normalized_agent_type in agent_fields:
        return agent_fields[normalized_agent_type]

    for resource_type in resource_types or []:
        normalized_resource = _normalize_key(resource_type)
        singular = (
            normalized_resource[:-1]
            if normalized_resource.endswith("s")
            else normalized_resource
        )
        for candidate in (normalized_resource, singular):
            if candidate in agent_fields:
                return agent_fields[candidate]

    for fallback in ("general", "basic", "content"):
        normalized_fallback = _normalize_key(fallback)
        if normalized_fallback in agent_fields:
            return agent_fields[normalized_fallback]

    return next(iter(agent_fields.values()))


def extract_group_id(result: Any) -> uuid.UUID | None:
    group_id = getattr(result, "group_id", None)
    return group_id if isinstance(group_id, uuid.UUID) else None


async def emit_generation_error(
    sid: str,
    artifact_type: str,
    message: str,
    resource_id: str | None = None,
    group_id: str | None = None,
    resource_type: str | None = None,
) -> None:
    await internal_sio.emit(
        "generate_call_error",
        GenerateErrorApiRequest(
            sid=sid,
            error_message=message,
            artifact_type=artifact_type,
            resource_id=resource_id,
            group_id=group_id,
            resource_type=resource_type or artifact_type,
        ),
    )


async def emit_generate_artifact(
    *,
    conn: Any,
    sid: str,
    artifact_type: str,
    resource_id: str | None,
    resource_types: list[str] | None,
    user_instructions: list[str] | None,
    profile_id: uuid.UUID,
    agent_id: uuid.UUID,
    group_id: uuid.UUID | None,
) -> None:
    """Create run + emit unified generate_artifact event."""
    create_run_sql = load_sql(CREATE_RUN_SQL_PATH)
    create_run_row = await conn.fetchrow(
        create_run_sql,
        agent_id,
        profile_id,
        None,
        None,
        group_id,
        None,
        user_instructions if user_instructions else None,
        None,
    )
    if not create_run_row:
        await emit_generation_error(
            sid=sid,
            artifact_type=artifact_type,
            message="Failed to create generation run",
            resource_id=resource_id,
            group_id=str(group_id) if group_id else None,
            resource_type=(resource_types or [artifact_type])[0],
        )
        return

    run_id = str(create_run_row["run_id"])
    run_group_id = create_run_row.get("group_id") or group_id

    run_context_sql = load_sql(TEXT_RUN_CONTEXT_SQL_PATH)
    run_context_row = await conn.fetchrow(
        run_context_sql,
        uuid.UUID(run_id),
        agent_id,
        None,
        run_group_id,
        None,
    )
    if not run_context_row:
        await emit_generation_error(
            sid=sid,
            artifact_type=artifact_type,
            message="Failed to load generation context",
            resource_id=resource_id,
            group_id=str(run_group_id) if run_group_id else None,
            resource_type=(resource_types or [artifact_type])[0],
        )
        return

    rendered_developer_messages = render_developer_instructions(
        templates=run_context_row.get("developer_instruction_templates"),
        jinja_context=run_context_row.get("context"),
    )
    messages: list[dict[str, Any]] = []
    if run_context_row.get("system_prompt"):
        messages.append({"role": "system", "content": run_context_row["system_prompt"]})
    for dev_msg in rendered_developer_messages:
        messages.append({"role": "developer", "content": dev_msg})
    for user_msg in user_instructions or []:
        messages.append({"role": "user", "content": user_msg})

    await internal_sio.emit(
        "generate_artifact",
        {
            "sid": sid,
            "artifact_type": artifact_type,
            "resource_type": (resource_types or [artifact_type])[0],
            "resource_types": resource_types or [artifact_type],
            "resource_id": resource_id,
            "run_id": run_id,
            "group_id": str(run_group_id) if run_group_id else None,
            "message_id": None,
            "messages": messages,
            "llm_config": {
                "model": run_context_row.get("model_name"),
                "api_key": run_context_row.get("api_key"),
                "base_url": run_context_row.get("base_url"),
                "temperature": run_context_row.get("temperature"),
                "reasoning": run_context_row.get("reasoning"),
                "provider": run_context_row.get("provider"),
                "voice": None,
                "quality": None,
                "length_seconds": None,
            },
            "tools": convert_tools_to_dict(run_context_row.get("tools")),
        },
    )
