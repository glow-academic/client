"""Rubric page handler - handles standard group formatting logic, then routes to artifacts/generate.py."""

import uuid
from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class GenerateRubricPayload(BaseModel):
    """Request to generate a rubric."""

    rubric_id: str
    rubric_agent_id: str
    department_id: str
    standard_groups: list[dict[str, Any]] | None = None
    standards: list[dict[str, Any]] | None = None


def format_rubric_context(
    standard_groups: list[dict[str, Any]] | None,
    standards: list[dict[str, Any]] | None,
) -> str:
    """Format rubric context (standard groups and standards) for agent input."""
    # Format standard groups manually (no JSONB)
    standard_groups_text = "\n".join(
        [
            f"  - {g.get('name', '')} (ID: {g.get('id', '')}, Points: {g.get('points', 0)}, Description: {g.get('description') or 'N/A'})"
            for g in (standard_groups or [])
        ]
    )
    # Format standards manually (no JSONB)
    standards_text = "\n".join(
        [
            f"  - {s.get('name', '')} (ID: {s.get('id', '')}, Points: {s.get('points', 0)}, Group ID: {s.get('standard_group_id', '')})"
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
    """Handle rubric generation - format context then route to generate_start."""
    try:
        # Step 1: Format rubric context (standard groups and standards)
        rubric_context_text = format_rubric_context(
            data.standard_groups, data.standards
        )

        # Step 2: Route to generate_start (which will create run and route back to rubric_generate)
        # The developer message will include the formatted rubric context
        developer_message_contents = [rubric_context_text]

        await internal_sio.emit(
            "generate_start",
            {
                "sid": sid,
                "agent_id": data.rubric_agent_id,
                "resource_id": data.rubric_id,
                "resource_type": "rubric",
                "group_id": None,  # Will be created by generate_start
                "user_instructions": None,
                "message_ids": None,
                "developer_message_contents": developer_message_contents,
            },
        )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
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
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_error",
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
            "generate_error",
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
    """Handle rubric_generate event from internal bus (server-to-server).
    
    This is called by generate_start after run creation. It receives run_id
    and routes directly to artifacts/generate.py.
    """
    try:
        # This is called from generate_start with run_id already created
        # Just route to artifacts/generate.py
        await internal_sio.emit("generate_artifact", data)
    except Exception as e:
        sid = data.get("sid", "")
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to route rubric generation: {str(e)}",
                resource_id=data.get("resource_id"),
                group_id=data.get("group_id"),
                resource_type="rubric",
            ),
            sid=sid,
        )

