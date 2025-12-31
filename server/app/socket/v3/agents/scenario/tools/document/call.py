"""Handler for scenario_tool_document WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.sql_helper import load_sql

from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class DocumentToolPayload(BaseModel):
    """Request to create document from scenario generation tool."""

    trace_id: str
    parent_scenario_id: str
    file_path: str
    mime_type: str
    file_size: int
    child_name: str
    child_description: str
    classify_agent_id: str
    document_agent_id: str
    scenario_id: str | None = None


class DocumentToolCompletePayload(BaseModel):
    """Response indicating document tool completed successfully."""

    success: bool
    scenario_id: str
    parent_scenario_id: str
    trace_id: str
    message: str | None = None


class DocumentToolErrorPayload(BaseModel):
    """Response indicating an error occurred in document tool."""

    success: bool
    message: str
    trace_id: str


async def document_tool_complete(
    payload: DocumentToolCompletePayload, room: str
) -> None:
    await sio.emit("scenarios_tools_document_complete", payload.model_dump(), room=room)
async def document_tool_error(payload: DocumentToolErrorPayload, room: str) -> None:
    await sio.emit("scenarios_tools_document_error", payload.model_dump(), room=room)


async def _scenario_tool_document_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for dynamic document creation."""
    try:
        validated = DocumentToolPayload(**data)
    except ValidationError as e:
        await document_tool_error(
            DocumentToolErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                trace_id=data.get("trace_id", "unknown"),
            ),
            room=sid,
        )
        return

    trace_id = validated.trace_id

    try:
        async with get_db_connection() as conn:
            parent_scenario_id = uuid.UUID(validated.parent_scenario_id)
            classify_agent_id = uuid.UUID(validated.classify_agent_id)
            document_agent_id = uuid.UUID(validated.document_agent_id)
            scenario_id = (
                uuid.UUID(validated.scenario_id) if validated.scenario_id else None
            )

            # Load SQL query at top (DHH style - one SQL file per websocket event)
            sql = load_sql(
                "app/sql/v3/documents/complete_document_creation_complete.sql"
            )

            result = await conn.fetchrow(
                sql,
                str(parent_scenario_id),
                validated.file_path,
                validated.mime_type,
                validated.file_size,
                validated.child_name,
                validated.child_description,
                str(classify_agent_id),
                str(document_agent_id),
                str(scenario_id) if scenario_id else None,
            )

            if not result:
                raise ValueError("Failed to create document and links")

            child_scenario_id = result["child_scenario_id"]
            upload_id = result["upload_id"]


            await document_tool_complete(
                DocumentToolCompletePayload(
                    success=True,
                    scenario_id=str(child_scenario_id),
                    parent_scenario_id=str(parent_scenario_id),
                    trace_id=trace_id,
                    message="Dynamic document created successfully",
                ),
                room=sid,
            )

    except RuntimeError:
        await document_tool_error(
            DocumentToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
    except Exception as e:
        await document_tool_error(
            DocumentToolErrorPayload(success=False, message=str(e), trace_id=trace_id),
            room=sid,
        )


@sio.event  # type: ignore
async def scenario_tool_document(sid: str, data: dict[str, Any]) -> None:
    """Handle dynamic document creation event from scenario generation tool (client-to-server)."""
    await _scenario_tool_document_impl(sid, data)


@internal_sio.on("scenario_tool_document")
async def scenario_tool_document_internal(data: dict[str, Any]) -> None:
    """Handle dynamic document creation event from internal bus (server-to-server)."""
    sid = data.get("sid")
    if not sid:
        return
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _scenario_tool_document_impl(sid, payload)


# FastAPI endpoints for OpenAPI documentation
@client_router.post("/document", response_model=dict[str, bool])
async def scenario_tool_document_api(request: DocumentToolPayload) -> dict[str, bool]:
    """Client-to-server event: Create a dynamic document from scenario generation tool."""
    return {"success": True}


@server_router.post("/document_complete", response_model=dict[str, bool])
async def document_tool_complete_api(
    request: DocumentToolCompletePayload,
) -> dict[str, bool]:
    """Server-to-client event: Document tool completed successfully."""
    return {"success": True}


@server_router.post("/document_error", response_model=dict[str, bool])
async def document_tool_error_api(request: DocumentToolErrorPayload) -> dict[str, bool]:
    """Server-to-client event: Error occurred in document tool."""
    return {"success": True}
