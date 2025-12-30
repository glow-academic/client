"""Handler for scenario_tool_title, document_tool_title, rubric_tool_title WebSocket events."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.websocket.openapi_helpers import register_client_endpoint
from app.main import get_internal_sio, get_pool, sio

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class ScenarioTitleToolPayload(BaseModel):
    """Request to create/update title from scenario generation tool."""

    trace_id: str
    title: str
    scenario_id: str | None = None


class DocumentTitleToolPayload(BaseModel):
    """Request to create/update title from document generation tool."""

    trace_id: str
    title: str
    document_id: str | None = None


class RubricTitleToolPayload(BaseModel):
    """Request to create/update title from rubric generation tool."""

    trace_id: str
    title: str
    rubric_id: str | None = None


class TitleToolCompletePayload(BaseModel):
    """Response indicating title tool completed successfully."""

    success: bool
    title: str
    trace_id: str
    message: str | None = None


class TitleToolErrorPayload(BaseModel):
    """Response indicating an error occurred in title tool."""

    success: bool
    message: str
    trace_id: str


async def scenario_title_tool_complete(
    payload: TitleToolCompletePayload, room: str
) -> None:
    logger.info(
        f"[scenario_tool_title_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, title={payload.title}"
    )
    await sio.emit(
        "scenarios_tools_title_complete", payload.model_dump(), room=room
    )
    logger.info(f"[scenario_tool_title_complete] Emitted to room={room}")


async def document_title_tool_complete(
    payload: TitleToolCompletePayload, room: str
) -> None:
    logger.info(
        f"[document_tool_title_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, title={payload.title}"
    )
    await sio.emit(
        "documents_tools_title_complete", payload.model_dump(), room=room
    )
    logger.info(f"[document_tool_title_complete] Emitted to room={room}")


async def rubric_title_tool_complete(
    payload: TitleToolCompletePayload, room: str
) -> None:
    logger.info(
        f"[rubric_tool_title_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, title={payload.title}"
    )
    await sio.emit(
        "rubrics_tools_title_complete", payload.model_dump(), room=room
    )
    logger.info(f"[rubric_tool_title_complete] Emitted to room={room}")


async def title_tool_error(payload: TitleToolErrorPayload, room: str) -> None:
    await sio.emit("scenarios_tools_title_error", payload.model_dump(), room=room)


async def _scenario_tool_title_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for scenario title creation/update."""
    logger.info(
        f"[scenario_tool_title] Handler received event: sid={sid}, "
        f"data={data}, trace_id={data.get('trace_id', 'unknown')}"
    )
    try:
        validated = ScenarioTitleToolPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in scenario_tool_title for {sid}: {e}")
        await title_tool_error(
            TitleToolErrorPayload(
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
        await title_tool_error(
            TitleToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
        return

    try:
        async with pool.acquire() as conn:
            scenario_id_uuid = (
                uuid.UUID(validated.scenario_id) if validated.scenario_id else None
            )

            if not scenario_id_uuid:
                await title_tool_error(
                    TitleToolErrorPayload(
                        success=False,
                        message="scenario_id is required",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Update scenario name
            sql = load_sql("app/sql/v3/scenario/update_scenario_name.sql")
            result = await conn.fetchrow(
                sql,
                str(scenario_id_uuid),
                validated.title,
            )

            if not result:
                await title_tool_error(
                    TitleToolErrorPayload(
                        success=False,
                        message="Failed to update scenario title",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            logger.info(
                f"✓ Updated scenario title: {validated.title} "
                f"(scenario_id={scenario_id_uuid}, trace_id={trace_id})"
            )

            await scenario_title_tool_complete(
                TitleToolCompletePayload(
                    success=True,
                    title=validated.title,
                    trace_id=trace_id,
                    message="Updated scenario title successfully",
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(
            f"Error in scenario_tool_title for {sid}: {str(e)}", exc_info=True
        )
        await title_tool_error(
            TitleToolErrorPayload(
                success=False,
                message=f"Error updating scenario title: {str(e)}",
                trace_id=trace_id,
            ),
            room=sid,
        )


async def _document_tool_title_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for document title creation/update."""
    logger.info(
        f"[document_tool_title] Handler received event: sid={sid}, "
        f"data={data}, trace_id={data.get('trace_id', 'unknown')}"
    )
    try:
        validated = DocumentTitleToolPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in document_tool_title for {sid}: {e}")
        await title_tool_error(
            TitleToolErrorPayload(
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
        await title_tool_error(
            TitleToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
        return

    try:
        async with pool.acquire() as conn:
            document_id_uuid = (
                uuid.UUID(validated.document_id) if validated.document_id else None
            )

            if not document_id_uuid:
                await title_tool_error(
                    TitleToolErrorPayload(
                        success=False,
                        message="document_id is required",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Update document name
            sql = load_sql("app/sql/v3/document/update_document_name.sql")
            result = await conn.fetchrow(
                sql,
                str(document_id_uuid),
                validated.title,
            )

            if not result:
                await title_tool_error(
                    TitleToolErrorPayload(
                        success=False,
                        message="Failed to update document title",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            logger.info(
                f"✓ Updated document title: {validated.title} "
                f"(document_id={document_id_uuid}, trace_id={trace_id})"
            )

            await document_title_tool_complete(
                TitleToolCompletePayload(
                    success=True,
                    title=validated.title,
                    trace_id=trace_id,
                    message="Updated document title successfully",
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(
            f"Error in document_tool_title for {sid}: {str(e)}", exc_info=True
        )
        await title_tool_error(
            TitleToolErrorPayload(
                success=False,
                message=f"Error updating document title: {str(e)}",
                trace_id=trace_id,
            ),
            room=sid,
        )


async def _rubric_tool_title_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for rubric title creation/update."""
    logger.info(
        f"[rubric_tool_title] Handler received event: sid={sid}, "
        f"data={data}, trace_id={data.get('trace_id', 'unknown')}"
    )
    try:
        validated = RubricTitleToolPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in rubric_tool_title for {sid}: {e}")
        await title_tool_error(
            TitleToolErrorPayload(
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
        await title_tool_error(
            TitleToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
        return

    try:
        async with pool.acquire() as conn:
            rubric_id_uuid = (
                uuid.UUID(validated.rubric_id) if validated.rubric_id else None
            )

            if not rubric_id_uuid:
                await title_tool_error(
                    TitleToolErrorPayload(
                        success=False,
                        message="rubric_id is required",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Update rubric name
            sql = load_sql("app/sql/v3/rubric/update_rubric_name.sql")
            result = await conn.fetchrow(
                sql,
                str(rubric_id_uuid),
                validated.title,
            )

            if not result:
                await title_tool_error(
                    TitleToolErrorPayload(
                        success=False,
                        message="Failed to update rubric title",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            logger.info(
                f"✓ Updated rubric title: {validated.title} "
                f"(rubric_id={rubric_id_uuid}, trace_id={trace_id})"
            )

            await rubric_title_tool_complete(
                TitleToolCompletePayload(
                    success=True,
                    title=validated.title,
                    trace_id=trace_id,
                    message="Updated rubric title successfully",
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(
            f"Error in rubric_tool_title for {sid}: {str(e)}", exc_info=True
        )
        await title_tool_error(
            TitleToolErrorPayload(
                success=False,
                message=f"Error updating rubric title: {str(e)}",
                trace_id=trace_id,
            ),
            room=sid,
        )


@internal_sio.on("scenario_tool_title")  # type: ignore
async def scenario_tool_title_internal(data: dict[str, Any]) -> None:
    """Handle scenario_tool_title event from internal bus (server-to-server)."""
    # Extract sid from payload if available, otherwise use a default
    sid = data.get("sid", "internal")
    await _scenario_tool_title_impl(sid, data)


@internal_sio.on("document_tool_title")  # type: ignore
async def document_tool_title_internal(data: dict[str, Any]) -> None:
    """Handle document_tool_title event from internal bus (server-to-server)."""
    sid = data.get("sid", "internal")
    await _document_tool_title_impl(sid, data)


@internal_sio.on("rubric_tool_title")  # type: ignore
async def rubric_tool_title_internal(data: dict[str, Any]) -> None:
    """Handle rubric_tool_title event from internal bus (server-to-server)."""
    sid = data.get("sid", "internal")
    await _rubric_tool_title_impl(sid, data)


# Register OpenAPI endpoints
register_client_endpoint(
    client_router,
    "POST",
    "/scenario_tool_title",
    _scenario_tool_title_impl,
    ScenarioTitleToolPayload,
    dict[str, bool],
    summary="Create/update scenario title",
    description="Handler for scenario_tool_title WebSocket event",
)

register_client_endpoint(
    client_router,
    "POST",
    "/document_tool_title",
    _document_tool_title_impl,
    DocumentTitleToolPayload,
    dict[str, bool],
    summary="Create/update document title",
    description="Handler for document_tool_title WebSocket event",
)

register_client_endpoint(
    client_router,
    "POST",
    "/rubric_tool_title",
    _rubric_tool_title_impl,
    RubricTitleToolPayload,
    dict[str, bool],
    summary="Create/update rubric title",
    description="Handler for rubric_tool_title WebSocket event",
)

