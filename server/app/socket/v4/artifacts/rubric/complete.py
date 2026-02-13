"""Rubric completion handler - listens to internal completion events, fetches full resources, and emits typed events."""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.points.get import get_points_internal
from app.api.v4.resources.standard_groups.get import get_standard_groups_internal
from app.api.v4.resources.standards.get import get_standards_internal
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.rubric.types import RubricGenerationCompleteEvent
from app.sql.types import (
    GetRubricToolCallResultsSqlParams,
    GetRubricToolCallResultsSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH = "app/sql/v4/queries/rubric/get_rubric_tool_call_results_complete.sql"

client_router = APIRouter()
server_router = APIRouter()


@internal_sio.on("generate_call_complete")  # type: ignore
@internal_sio.on("rubric_end")  # type: ignore
async def handle_rubric_complete(data: dict[str, Any]) -> None:
    """Handle rubric completion events - fetch full resources and emit typed events."""
    if data.get("artifact_type") != "rubric":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    completion_type = data.get("event_type") or data.get("type", "")
    resource_id = data.get("resource_id")
    run_id = data.get("run_id")
    resource_type = data.get("resource_type")
    group_id = data.get("group_id")

    try:
        if completion_type in ("tool_call_complete", "tool_result"):
            tool_name = data.get("tool_name", "")

            if tool_name == "standard_description" and run_id:
                async with get_db_connection() as conn:
                    params = GetRubricToolCallResultsSqlParams(run_id=uuid.UUID(run_id))
                    result = cast(
                        GetRubricToolCallResultsSqlRow,
                        await execute_sql_typed(conn, SQL_PATH, params=params),
                    )

                    if result and result.descriptions:
                        descriptions_list = []
                        if isinstance(result.descriptions, list):
                            descriptions_list = result.descriptions
                        elif (
                            isinstance(result.descriptions, dict)
                            and "descriptions" in result.descriptions
                        ):
                            descriptions_list = result.descriptions["descriptions"]

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
                # Other tool types - fetch full resource via _internal()
                tool_result = data.get("result") or {}
                tool_results = data.get("tool_results") or []
                if not tool_result and tool_results:
                    tool_result = tool_results[0]

                resource_id_str = tool_result.get("resource_id")
                if not resource_id_str:
                    tool_success = tool_result.get("success", True)
                    if not tool_success:
                        return
                    await sio.emit(
                        "rubric_generation_error",
                        {
                            "artifact_type": "rubric",
                            "resource_type": resource_type,
                            "group_id": group_id,
                            "success": False,
                            "message": f"Missing resource_id for {resource_type} tool result",
                        },
                        room=sid,
                    )
                    return

                rid = uuid.UUID(resource_id_str)

                event = RubricGenerationCompleteEvent(
                    artifact_type="rubric",
                    group_id=group_id,
                    resource_type=resource_type,
                    run_id=run_id,
                    success=True,
                    message=f"{resource_type} generation completed successfully",
                )

                try:
                    async with get_db_connection() as conn:
                        if resource_type == "names":
                            items = await get_names_internal(conn, [rid])
                            event.name_resource = items[0] if items else None
                        elif resource_type == "descriptions":
                            items = await get_descriptions_internal(conn, [rid])
                            event.description_resource = items[0] if items else None
                        elif resource_type == "flags":
                            items = await get_flags_internal(conn, [rid])
                            event.flag_resource = items[0] if items else None
                        elif resource_type == "departments":
                            items = await get_departments_internal(conn, [rid])
                            event.department_resources = items if items else None
                        elif resource_type == "points":
                            items = await get_points_internal(conn, [rid])
                            event.points_resource = items[0] if items else None
                        elif resource_type == "pass_points":
                            items = await get_points_internal(conn, [rid])
                            event.pass_points_resource = items[0] if items else None
                        elif resource_type == "standard_groups":
                            items = await get_standard_groups_internal(conn, [rid])
                            event.standard_group_resources = items if items else None
                        elif resource_type == "standards":
                            items = await get_standards_internal(conn, [rid])
                            event.standard_resources = items if items else None
                except Exception as e:
                    await sio.emit(
                        "rubric_generation_error",
                        {
                            "artifact_type": "rubric",
                            "resource_type": resource_type,
                            "group_id": group_id,
                            "success": False,
                            "message": str(e),
                        },
                        room=sid,
                    )
                    return

                await sio.emit(
                    "rubric_generation_complete",
                    event.model_dump(mode="json"),
                    room=sid,
                )

        else:
            return

    except Exception as e:
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
    request: RubricGenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: rubric generation complete."""
    return {"ok": True}
