"""Rubric completion handler - listens to internal completion events, fetches tool results, and emits to clients."""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.sql.types import (
    GetRubricToolCallResultsSqlParams,
    GetRubricToolCallResultsSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/queries/rubric/get_rubric_tool_call_results_complete.sql"


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("rubric_end")  # type: ignore
async def handle_rubric_complete(data: dict[str, Any]) -> None:
    """Handle rubric_end internal event - fetch tool results and emit to client."""
    if data.get("artifact_type") != "rubric":
        return

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    completion_type = data.get("event_type") or data.get("type", "run_complete")
    resource_id = data.get("resource_id")
    run_id = data.get("run_id")
    resource_type = data.get("resource_type")
    group_id = data.get("group_id")

    try:
        if completion_type == "tool_call_complete":
            # Handle tool call completion - fetch results from DB
            tool_name = data.get("tool_name", "")

            if tool_name == "standard_description" and run_id:
                # Fetch tool call results from database
                async with get_db_connection() as conn:
                    params = GetRubricToolCallResultsSqlParams(run_id=uuid.UUID(run_id))
                    result = cast(
                        GetRubricToolCallResultsSqlRow,
                        await execute_sql_typed(conn, SQL_PATH, params=params),
                    )

                    if result and result.descriptions:
                        # Extract descriptions array from JSONB
                        descriptions_list = []
                        if isinstance(result.descriptions, list):
                            descriptions_list = result.descriptions
                        elif (
                            isinstance(result.descriptions, dict)
                            and "descriptions" in result.descriptions
                        ):
                            descriptions_list = result.descriptions["descriptions"]

                        # Format descriptions for client
                        formatted_descriptions = []
                        for desc in descriptions_list:
                            if isinstance(desc, dict):
                                formatted_descriptions.append(
                                    {
                                        "standard_group_id": str(
                                            desc.get("standard_group_id", "")
                                        ),
                                        "standard_id": str(desc.get("standard_id", "")),
                                        "description": str(desc.get("description", "")),
                                    }
                                )

                        # Emit tool call completion event to client
                        await sio.emit(
                            "artifact_tool_call_complete",
                            {
                                "resource_type": "rubric",
                                "resource_id": resource_id,
                                "run_id": run_id,
                                "tool_name": tool_name,
                                "tool_type": data.get("tool_type"),
                                "tool_call_id": data.get("tool_call_id"),
                                "call_id": data.get("call_id"),
                                "descriptions": formatted_descriptions,
                                "updated_count": len(formatted_descriptions),
                                "success": True,
                                "message": f"Generated {len(formatted_descriptions)} description(s)",
                                "trace_id": data.get("trace_id"),
                            },
                            room=sid,
                        )
                    else:
                        # No results found
                        await sio.emit(
                            "artifact_tool_call_complete",
                            {
                                "resource_type": "rubric",
                                "resource_id": resource_id,
                                "run_id": run_id,
                                "tool_name": tool_name,
                                "descriptions": [],
                                "updated_count": 0,
                                "success": False,
                                "message": "No descriptions found in tool call results",
                                "trace_id": data.get("trace_id"),
                            },
                            room=sid,
                        )
            else:
                # Other tool types - emit generic completion
                await sio.emit(
                    "artifact_tool_call_complete",
                    {
                        "resource_type": "rubric",
                        "resource_id": resource_id,
                        "run_id": run_id,
                        "tool_name": tool_name,
                        "tool_type": data.get("tool_type"),
                        "tool_call_id": data.get("tool_call_id"),
                        "call_id": data.get("call_id"),
                        "success": True,
                        "message": f"Tool {tool_name} completed",
                        "trace_id": data.get("trace_id"),
                    },
                    room=sid,
                )

        elif completion_type in ("run_complete", "tool_result"):
            # Handle run completion - emit generation complete
            complete_payload = {
                "artifact_type": "rubric",
                "group_id": group_id,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "run_id": run_id,
                "success": True,
                "message": "Rubric generation completed successfully",
                "trace_id": data.get("trace_id"),
            }
            if resource_type == "names" and resource_id:
                complete_payload["name_id"] = resource_id
            elif resource_type == "descriptions" and resource_id:
                complete_payload["description_id"] = resource_id
            elif resource_type == "flags" and resource_id:
                complete_payload["active_flag_id"] = resource_id
            elif resource_type == "departments" and resource_id:
                complete_payload["department_ids"] = [resource_id]
            elif resource_type == "standards" and resource_id:
                complete_payload["standard_ids"] = [resource_id]
            elif resource_type == "standard_groups" and resource_id:
                complete_payload["standard_group_ids"] = [resource_id]
            elif resource_type == "points" and resource_id:
                complete_payload["total_points_id"] = resource_id

            await sio.emit("rubric_generation_complete", complete_payload, room=sid)
            await sio.emit(
                "artifact_generation_complete",
                complete_payload,
                room=sid,
            )

    except Exception as e:
        # Emit error to client
        await sio.emit(
            "artifact_generation_error",
            {
                "artifact_type": "rubric",
                "resource_type": "rubric",
                "resource_id": resource_id,
                "group_id": data.get("group_id"),
                "success": False,
                "message": f"Failed to handle rubric completion: {str(e)}",
                "trace_id": data.get("trace_id"),
            },
            room=sid,
        )


@server_router.post("/rubric_generation_complete")
async def rubric_generation_complete_api(
    request: dict[str, Any],
) -> dict[str, bool]:
    """Server-to-client event: rubric generation complete."""
    _ = request
    return {"ok": True}
