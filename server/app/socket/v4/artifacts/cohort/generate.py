"""Cohort generation router - unified handler for cohort resource types."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.cohort.get import get_cohort_websocket
from app.api.v4.artifacts.cohort.types import GetCohortWebsocketResponse
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.generation.resource_utils import normalize_resources_for_sql
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.cohort.types import GenerateCohortPayload
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.utils.sql_helper import load_sql

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

CREATE_RUN_SQL_PATH = "app/sql/v4/queries/generate/start/get_generation_run_context_and_create_run_complete.sql"
TEXT_RUN_CONTEXT_SQL_PATH = "app/sql/v4/queries/generate/text/get_text_run_context_for_existing_run_complete.sql"

COHORT_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "flags",
    "departments",
    "simulations",
    "simulation_positions",
]


def _build_cohort_jinja_context(response: GetCohortWebsocketResponse) -> dict[str, Any]:
    context: dict[str, Any] = (
        response.resources.model_dump() if response.resources else {}
    )
    context["views"] = {
        "draft_cohort": (
            response.views.draft_cohort.model_dump(mode="json")
            if response.views and response.views.draft_cohort
            else {}
        )
    }
    return context


async def _cohort_generate_impl(
    sid: str, data: GenerateCohortPayload, profile_id: uuid.UUID
) -> None:
    try:
        if not data.resource_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="resource_types must be provided",
                    artifact_type="cohort",
                    group_id=None,
                    resource_type="cohort",
                ),
                sid=sid,
            )
            return

        if not data.draft_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Draft ID is required for cohort generation",
                    artifact_type="cohort",
                    group_id=None,
                    resource_type="cohort",
                ),
                sid=sid,
            )
            return

        requested_resource_types = data.resource_types
        invalid_types = [
            rt for rt in requested_resource_types if rt not in COHORT_RESOURCE_TYPES
        ]
        if invalid_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    artifact_type="cohort",
                    group_id=None,
                    resource_type="cohort",
                    resource_types=requested_resource_types,
                ),
                sid=sid,
            )
            return

        result = await get_cohort_websocket(
            profile_id=profile_id,
            cohort_id=data.cohort_id,
            draft_id=data.draft_id,
        )

        resource_agent_ids = result.resource_agent_ids or {}
        agent_id: uuid.UUID | None = None
        for rt in requested_resource_types:
            aid = resource_agent_ids.get(rt)
            if aid is not None:
                agent_id = aid
                break

        if agent_id is None:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent found for the requested resource types",
                    artifact_type="cohort",
                    group_id=str(result.group_id) if result.group_id else None,
                    resource_type="cohort",
                    resource_types=requested_resource_types,
                ),
                sid=sid,
            )
            return

        cohort_jinja_context = _build_cohort_jinja_context(result)

        resources: list[dict[str, Any]] = []

        def add_resource_ids(
            resource_type: str, items: list[Any] | None, id_attr: str
        ) -> None:
            if items and resource_type in requested_resource_types:
                ids = []
                for item in items:
                    item_id = (
                        item.get(id_attr)
                        if isinstance(item, dict)
                        else getattr(item, id_attr, None)
                    )
                    if item_id:
                        ids.append(str(item_id))
                if ids:
                    resources.append(
                        {"resource_type": resource_type, "resource_ids": ids}
                    )

        resources_bucket = result.resources
        if resources_bucket:
            add_resource_ids("names", resources_bucket.names, "id")
            add_resource_ids("descriptions", resources_bucket.descriptions, "id")
            add_resource_ids("flags", resources_bucket.flags, "id")
            add_resource_ids(
                "departments", resources_bucket.departments, "department_id"
            )
            add_resource_ids(
                "simulations", resources_bucket.simulations, "simulation_id"
            )
            if (
                resources_bucket.simulation_positions
                and "simulation_positions" in requested_resource_types
            ):
                simulation_position_ids = []
                for pos in resources_bucket.simulation_positions:
                    simulation_id = (
                        pos.get("simulation_id")
                        if isinstance(pos, dict)
                        else getattr(pos, "simulation_id", None)
                    )
                    if simulation_id:
                        simulation_position_ids.append(str(simulation_id))
                if simulation_position_ids:
                    resources.append(
                        {
                            "resource_type": "simulation_positions",
                            "resource_ids": simulation_position_ids,
                        }
                    )

        group_id: uuid.UUID | None = result.group_id
        resources_sql = normalize_resources_for_sql(resources)

        async with get_db_connection() as conn:
            create_run_sql = load_sql(CREATE_RUN_SQL_PATH)
            create_run_row = await conn.fetchrow(
                create_run_sql,
                agent_id,
                profile_id,
                None,
                None,
                group_id,
                None,
                data.user_instructions if data.user_instructions else None,
                resources_sql,
            )

            if not create_run_row:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to create generation run",
                        artifact_type="cohort",
                        group_id=str(group_id) if group_id else None,
                        resource_type="cohort",
                        resource_types=requested_resource_types,
                    ),
                    sid=sid,
                )
                return

            run_id = str(create_run_row["run_id"])
            group_id = (
                create_run_row["group_id"] if create_run_row["group_id"] else group_id
            )
            trace_id = create_run_row.get("trace_id")
            message_ids = create_run_row.get("message_ids")

            run_context_sql = load_sql(TEXT_RUN_CONTEXT_SQL_PATH)
            run_context_row = await conn.fetchrow(
                run_context_sql,
                uuid.UUID(run_id),
                agent_id,
                message_ids,
                group_id,
                resources_sql,
            )

            if not run_context_row:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to load generation context",
                        artifact_type="cohort",
                        group_id=str(group_id) if group_id else None,
                        resource_type="cohort",
                        resource_types=requested_resource_types,
                    ),
                    sid=sid,
                )
                return

            rendered_developer_messages = render_developer_instructions(
                templates=run_context_row.get("developer_instruction_templates"),
                jinja_context=run_context_row.get("context") or cohort_jinja_context,
            )

            messages: list[dict[str, Any]] = []
            if run_context_row.get("system_prompt"):
                messages.append(
                    {"role": "system", "content": run_context_row["system_prompt"]}
                )
            for dev_msg in rendered_developer_messages:
                messages.append({"role": "developer", "content": dev_msg})
            for user_msg in data.user_instructions or []:
                messages.append({"role": "user", "content": user_msg})

            resource_type = (
                requested_resource_types[0] if requested_resource_types else "cohort"
            )

            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "cohort",
                    "resource_type": resource_type,
                    "run_id": run_id,
                    "group_id": str(group_id) if group_id else None,
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
                    "metadata": {"trace_id": trace_id},
                    "eval_mode": False,
                },
            )

    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate cohort resources: {str(e)}",
                artifact_type="cohort",
                group_id=None,
                resource_type="cohort",
                resource_types=data.resource_types
                if data and data.resource_types
                else None,
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def cohort_generate(sid: str, data: dict[str, Any]) -> None:
    try:
        payload = GenerateCohortPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="cohort",
                    group_id=None,
                    resource_type="cohort",
                    resource_types=payload.resource_types if payload else None,
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _cohort_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="cohort",
                group_id=None,
                resource_type="cohort",
                resource_types=None,
            ),
            sid=sid,
        )


@internal_sio.on("cohort_generate")  # type: ignore
async def cohort_generate_internal(data: dict[str, Any]) -> None:
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="cohort",
                    group_id=None,
                    resource_type="cohort",
                    resource_types=data.get("resource_types") or [],
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GenerateCohortPayload(**data)
        await _cohort_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="cohort",
                group_id=None,
                resource_type="cohort",
                resource_types=None,
            ),
            sid=sid,
        )
