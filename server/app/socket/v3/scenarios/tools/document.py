"""Handler for scenario_tool_document WebSocket event."""

import uuid
from typing import Any

from app.main import get_internal_sio, get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class DocumentToolPayload(BaseModel):
    """Request to create document from scenario generation tool."""

    trace_id: str
    parent_document_id: str
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
    document_id: str
    parent_document_id: str
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
    logger.info(
        f"[scenario_tool_document_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, "
        f"document_id={payload.document_id}, parent_document_id={payload.parent_document_id}"
    )
    await sio.emit("scenarios_tools_document_complete", payload.model_dump(), room=room)
    logger.info(f"[scenario_tool_document_complete] Emitted to room={room}")


async def document_tool_error(payload: DocumentToolErrorPayload, room: str) -> None:
    await sio.emit("scenarios_tools_document_error", payload.model_dump(), room=room)


async def _scenario_tool_document_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for dynamic document creation."""
    logger.info(
        f"[scenario_tool_document] Handler received event: sid={sid}, "
        f"data={data}, trace_id={data.get('trace_id', 'unknown')}"
    )
    try:
        validated = DocumentToolPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in scenario_tool_document for {sid}: {e}")
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
    pool = get_pool()

    if not pool:
        await document_tool_error(
            DocumentToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
        return

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with pool.acquire() as conn:
            parent_document_id = uuid.UUID(validated.parent_document_id)
            classify_agent_id = uuid.UUID(validated.classify_agent_id)
            document_agent_id = uuid.UUID(validated.document_agent_id)
            scenario_id = (
                uuid.UUID(validated.scenario_id) if validated.scenario_id else None
            )

            # Load SQL query at top (DHH style - one SQL file per websocket event)
            sql = load_sql("sql/v3/documents/complete_document_creation_complete.sql")

            sql_query = sql
            sql_params = (
                str(parent_document_id),
                validated.file_path,
                validated.mime_type,
                validated.file_size,
                validated.child_name,
                validated.child_description,
                str(classify_agent_id),
                str(document_agent_id),
                str(scenario_id) if scenario_id else None,
            )

            result = await conn.fetchrow(sql, *sql_params)

            if not result:
                raise ValueError("Failed to create document and links")

            child_document_id = result["child_document_id"]
            upload_id = result["upload_id"]

            logger.info(
                f"✓ Created dynamic document {child_document_id} from parent {parent_document_id} "
                f"(scenario_id={validated.scenario_id}, trace_id={trace_id}, upload_id={upload_id})"
            )

            await document_tool_complete(
                DocumentToolCompletePayload(
                    success=True,
                    document_id=str(child_document_id),
                    parent_document_id=str(parent_document_id),
                    trace_id=trace_id,
                    message="Dynamic document created successfully",
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(
            f"Error in scenario_tool_document for {sid}: {str(e)}",
            exc_info=True,
        )
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
        logger.error("[scenario_tool_document_internal] Missing 'sid' in payload")
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
async def document_tool_complete_api(request: DocumentToolCompletePayload) -> dict[str, bool]:
    """Server-to-client event: Document tool completed successfully."""
    return {"success": True}


@server_router.post("/document_error", response_model=dict[str, bool])
async def document_tool_error_api(request: DocumentToolErrorPayload) -> dict[str, bool]:
    """Server-to-client event: Error occurred in document tool."""
    return {"success": True}
