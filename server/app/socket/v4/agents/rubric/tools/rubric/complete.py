"""Handler for rubric_standard_description_complete - finalizes standard_description tool calls and updates descriptions."""

import json
import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio
from app.sql.types import (
    IUpdateStandardDescriptionsV4Description,
    StandardGroupDescriptionsCompleteApiRequest,
    UpdateStandardDescriptionsSqlParams,
    UpdateStandardDescriptionsSqlRow,
)

internal_sio = get_internal_sio()

server_router = APIRouter()

SQL_PATH = "app/sql/v4/rubrics/update_standard_descriptions_complete.sql"


class RubricStandardDescriptionCompletePayload(BaseModel):
    """Rubric standard description tool complete event."""

    sid: str
    rubric_id: str | None = None
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    tool_name: str
    final_content: str
    arguments_raw: str


class RubricStandardDescriptionCompleteErrorPayload(BaseModel):
    """Error response for rubric standard description complete."""

    success: bool
    message: str


async def _rubric_standard_description_complete_impl(
    sid: str,
    data: RubricStandardDescriptionCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle rubric_standard_description_complete - parses arguments and updates descriptions."""
    try:
        if not data.rubric_id:
            await internal_sio.emit(
                "rubric_standard_description_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": "Missing rubric_id",
                },
            )
            return

        rubric_id_uuid = uuid.UUID(data.rubric_id)

        async with get_db_connection() as conn:
            # Parse tool arguments to extract descriptions
            try:
                final_args = json.loads(data.arguments_raw)
                descriptions_list = final_args.get("descriptions", [])
            except json.JSONDecodeError:
                # Try to parse from final_content if arguments_raw is invalid
                try:
                    final_args = json.loads(data.final_content)
                    descriptions_list = final_args.get("descriptions", [])
                except (json.JSONDecodeError, TypeError):
                    await internal_sio.emit(
                        "rubric_standard_description_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": "Failed to parse tool arguments",
                        },
                    )
                    return

            if not descriptions_list:
                await internal_sio.emit(
                    "rubric_standard_description_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Missing descriptions in tool arguments",
                    },
                )
                return

            # Convert descriptions to composite type objects
            description_objects = [
                IUpdateStandardDescriptionsV4Description(
                    standard_group_id=uuid.UUID(desc["standard_group_id"]),
                    standard_id=uuid.UUID(desc["standard_id"]),
                    description=desc["description"],
                )
                for desc in descriptions_list
            ]

            # Update standard descriptions via SQL
            params = UpdateStandardDescriptionsSqlParams(
                rubric_id=rubric_id_uuid,
                descriptions=description_objects,
                profile_id=profile_id,
                group_id=group_id,
            )
            result = cast(
                UpdateStandardDescriptionsSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or result.updated_count is None:
                await internal_sio.emit(
                    "rubric_standard_description_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "Failed to update standard descriptions",
                    },
                )
                return

            # Invalidate rubrics cache
            await invalidate_tags(["rubrics", f"rubric:{str(rubric_id_uuid)}"])

            # Emit completion to client
            await sio.emit(
                "rubrics_tools_standard_description_complete",
                StandardGroupDescriptionsCompleteApiRequest(
                    success=True,
                    rubric_id=str(rubric_id_uuid),
                    updated_count=result.updated_count,
                    message=f"Updated {result.updated_count} standard descriptions successfully",
                    descriptions=result.descriptions,  # From SQL result (composite types array)
                ).model_dump(),
                room=sid,
            )

    except Exception as e:
        await internal_sio.emit(
            "rubric_standard_description_error",
            {
                "sid": sid,
                "success": False,
                "message": f"Failed to finalize: {str(e)}",
            },
        )


@internal_sio.on("rubric_standard_description_complete")  # type: ignore
async def rubric_standard_description_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle rubric_standard_description_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=RubricStandardDescriptionCompletePayload,
        handler=_rubric_standard_description_complete_impl,  # type: ignore[arg-type]
        error_event_name="rubric_standard_description_error",
        error_response_type=RubricStandardDescriptionCompleteErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/rubric_standard_description_complete",
    RubricStandardDescriptionCompletePayload,
    "Rubric standard description tool completed successfully",
)
