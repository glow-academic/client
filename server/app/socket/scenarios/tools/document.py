"""Handler for scenario_tool_document WebSocket event."""

import uuid
from typing import Any

from app.main import get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


class DocumentToolPayload(BaseModel):
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
    success: bool
    document_id: str
    parent_document_id: str
    trace_id: str
    message: str | None = None


class DocumentToolErrorPayload(BaseModel):
    success: bool
    message: str
    trace_id: str


async def document_tool_complete(payload: DocumentToolCompletePayload, room: str) -> None:
    await sio.emit("scenario_tool_document_complete", payload.model_dump(), room=room)


async def document_tool_error(payload: DocumentToolErrorPayload, room: str) -> None:
    await sio.emit("scenario_tool_document_error", payload.model_dump(), room=room)


@sio.event  # type: ignore
async def scenario_tool_document(sid: str, data: dict[str, Any]) -> None:
    """Handle dynamic document creation event from scenario generation tool."""
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
            scenario_id = uuid.UUID(validated.scenario_id) if validated.scenario_id else None

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

