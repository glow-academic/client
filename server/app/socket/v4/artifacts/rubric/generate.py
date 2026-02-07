"""Rubric generation router - unified handler for all rubric resource types.

Uses the domain_ids-based API pattern:
1. Client sends domain_ids (which domains to generate)
2. Server looks up agent_ids and resource_types from get_rubric_websocket()
3. Server creates generation run and emits to generate_artifact handler
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.rubric.get import get_rubric_websocket
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.rubric.types import GenerateRubricPayload
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.utils.sql_helper import load_sql

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

CREATE_RUN_SQL_PATH = "app/sql/v4/queries/generate/start/get_generation_run_context_and_create_run_complete.sql"
TEXT_RUN_CONTEXT_SQL_PATH = "app/sql/v4/queries/generate/text/get_text_run_context_for_existing_run_complete.sql"

RUBRIC_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "departments",
    "flags",
    "points",
    "pass_points",
    "standard_groups",
    "standards",
]


def format_rubric_context(
    standard_groups: list[Any] | None,
    standards: list[Any] | None,
) -> str:
    """Format rubric context (standard groups and standards) for agent input."""
    standard_groups_text = "\n".join(
        [
            "  - "
            f"{getattr(g, 'name', '')} "
            f"(ID: {getattr(g, 'standard_group_id', '')}, "
            f"Points: {getattr(g, 'points', 0)}, "
            f"Description: {getattr(g, 'description', '') or 'N/A'})"
            for g in (standard_groups or [])
        ]
    )
    standards_text = "\n".join(
        [
            "  - "
            f"{getattr(s, 'name', '')} "
            f"(ID: {getattr(s, 'standard_id', '')}, "
            f"Points: {getattr(s, 'points', 0)}, "
            f"Group ID: {getattr(s, 'standard_group_id', '')})"
            for s in (standards or [])
        ]
    )
    rubric_context_text = f"""You are generating descriptions for a rubric grid. The rubric has the following structure:

Standard Groups:
{standard_groups_text if standard_groups_text else "  (none)"}

Standards:
{standards_text if standards_text else "  (none)"}

For each combination of standard group and standard, generate a clear, specific description (1-3 sentences) that describes what performance looks like at that level for that dimension. The description should be:
- Specific and observable (avoid vague terms)
- Aligned with the point value (higher points = better performance)
- Consistent with other descriptions in the same standard group
- Appropriate for educational rubrics

You must call the standard_description tool with an array of descriptions, where each description object contains:
- standard_group_id: The UUID string of the standard group
- standard_id: The UUID string of the standard
- description: The generated description text for this grid cell

Generate descriptions for ALL combinations of standard groups and standards."""
    return rubric_context_text


async def _generate_rubric_impl(
    sid: str, data: GenerateRubricPayload, profile_id: uuid.UUID
) -> None:
    """Handle rubric generation using domain_ids-based pattern."""
    try:
        if not data.domain_ids:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="domain_ids must be provided",
                    artifact_type="rubric",
                    group_id=None,
                    resource_type="rubric",
                ),
                sid=sid,
            )
            return

        # Step 1: Fetch rubric data via websocket function for domain/agent mappings
        result = await get_rubric_websocket(
            profile_id=profile_id,
            rubric_id=data.rubric_id,
            draft_id=data.draft_id,
        )

        # Build domain_id -> agent_id mapping from result.domains
        domain_to_agent: dict[uuid.UUID, uuid.UUID | None] = {}
        if result.domains:
            for domain in result.domains:
                domain_to_agent[domain.domain_id] = domain.agent_id

        # Build domain_id -> resource_type mapping from result
        domain_to_resource: dict[uuid.UUID | None, str] = {
            result.name_domain_id: "names",
            result.description_domain_id: "descriptions",
            result.flag_domain_id: "flags",
            result.departments_domain_id: "departments",
            result.points_domain_id: "points",
            result.pass_points_domain_id: "pass_points",
            result.standard_groups_domain_id: "standard_groups",
            result.standards_domain_id: "standards",
        }
        domain_to_resource.pop(None, None)

        # Derive resource_types from domain_ids
        resource_types: list[str] = []
        for did in data.domain_ids:
            if did in domain_to_resource:
                resource_types.append(domain_to_resource[did])

        if not resource_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No valid domain_ids provided",
                    artifact_type="rubric",
                    group_id=None,
                    resource_type="rubric",
                ),
                sid=sid,
            )
            return

        invalid_types = [rt for rt in resource_types if rt not in RUBRIC_RESOURCE_TYPES]
        if invalid_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    artifact_type="rubric",
                    group_id=None,
                    resource_type="rubric",
                ),
                sid=sid,
            )
            return

        # Get agent_id from the first valid domain_id
        agent_id: uuid.UUID | None = None
        for did in data.domain_ids:
            if did in domain_to_agent and domain_to_agent[did] is not None:
                agent_id = domain_to_agent[did]
                break

        if not agent_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent configured for rubric generation",
                    artifact_type="rubric",
                    group_id=str(result.group_id) if result.group_id else None,
                    resource_type="rubric",
                ),
                sid=sid,
            )
            return

        # Build rubric context for standard descriptions if needed
        rubric_context_text: str | None = None
        if "standards" in resource_types or "standard_groups" in resource_types:
            resources_bucket = result.resources.resources if result.resources else None
            if resources_bucket:
                rubric_context_text = format_rubric_context(
                    resources_bucket.standard_groups,
                    resources_bucket.standards,
                )

        async with get_db_connection() as conn:
            create_run_sql = load_sql(CREATE_RUN_SQL_PATH)
            create_run_row = await conn.fetchrow(
                create_run_sql,
                agent_id,
                profile_id,
                None,
                None,
                result.group_id,
                None,
                data.user_instructions if data.user_instructions else None,
                None,
            )

            if not create_run_row:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to create generation run",
                        resource_id=data.rubric_id,
                        group_id=str(result.group_id) if result.group_id else None,
                        resource_type="rubric",
                    ),
                    sid=sid,
                )
                return

            run_id = str(create_run_row["run_id"])
            group_id = create_run_row["group_id"] or result.group_id
            trace_id = create_run_row.get("trace_id")

            run_context_sql = load_sql(TEXT_RUN_CONTEXT_SQL_PATH)
            run_context_row = await conn.fetchrow(
                run_context_sql,
                uuid.UUID(run_id),
                agent_id,
                None,
                group_id,
                None,
            )

        if not run_context_row:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Failed to load generation context",
                    resource_id=data.rubric_id,
                    group_id=str(group_id) if group_id else None,
                    resource_type="rubric",
                ),
                sid=sid,
            )
            return

        rendered_developer_messages = render_developer_instructions(
            templates=run_context_row.get("developer_instruction_templates"),
            jinja_context=run_context_row.get("context"),
        )

        messages: list[dict[str, Any]] = []
        if run_context_row.get("system_prompt"):
            messages.append(
                {"role": "system", "content": run_context_row["system_prompt"]}
            )
        for dev_msg in rendered_developer_messages:
            messages.append({"role": "developer", "content": dev_msg})
        if rubric_context_text:
            messages.append({"role": "user", "content": rubric_context_text})
        for user_msg in data.user_instructions or []:
            messages.append({"role": "user", "content": user_msg})

        await internal_sio.emit(
            "generate_artifact",
            {
                "sid": sid,
                "artifact_type": "rubric",
                "resource_type": resource_types[0] if resource_types else "rubric",
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
                error_message=f"Failed to generate rubric: {str(e)}",
                resource_id=data.rubric_id,
                group_id=None,
                resource_type="rubric",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def rubric_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle rubric_generate event (client-to-server)."""
    try:
        payload = GenerateRubricPayload(**data)
        try:
            profile_id_str = await find_profile_by_socket(sid)
        except Exception as lookup_error:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Profile lookup failed: {str(lookup_error)}. Please reconnect.",
                    resource_id=data.get("rubric_id"),
                    group_id=None,
                    resource_type="rubric",
                ),
                sid=sid,
            )
            return

        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    resource_id=data.get("rubric_id"),
                    group_id=None,
                    resource_type="rubric",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _generate_rubric_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                resource_id=data.get("rubric_id"),
                group_id=None,
                resource_type="rubric",
            ),
            sid=sid,
        )


@internal_sio.on("rubric_generate")  # type: ignore
async def rubric_generate_internal(data: dict[str, Any]) -> None:
    """Handle rubric_generate event from internal bus (server-to-server)."""
    try:
        await internal_sio.emit("generate_artifact", data)
    except Exception as e:
        sid = data.get("sid", "")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to route rubric generation: {str(e)}",
                resource_id=data.get("resource_id"),
                group_id=data.get("group_id"),
                resource_type="rubric",
            ),
            sid=sid,
        )
