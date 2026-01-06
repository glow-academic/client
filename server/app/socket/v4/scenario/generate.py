"""Scenario page handler - handles randomization logic, then routes to artifacts/generate.py."""

import json
import uuid
from typing import Any, cast

import asyncpg  # type: ignore
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.sql.types import (
    GetDepartmentsForProfileSqlParams,
    GetDepartmentsForProfileSqlRow,
    GetRandomizationRangesSqlParams,
    GetRandomizationRangesSqlRow,
    GetScenarioDepartmentsSqlParams,
    GetScenarioDepartmentsSqlRow,
    RandomizeScenarioSqlParams,
    RandomizeScenarioSqlRow,
)
from fastapi import APIRouter
from pydantic import BaseModel
from utils.sql_helper import execute_sql_typed, load_sql

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class GenerateScenarioPayload(BaseModel):
    """Request to generate a scenario."""

    scenarioId: str | None = None
    departmentId: str
    scenarioAgentId: str
    personaIds: list[str] | None = None
    documentIds: list[str] | None = None
    fieldIds: list[str] | None = None
    profileId: str | None = None
    randomizeType: str | None = None  # "all", "persona", "document", "parameters", "parameter_{paramId}"
    skipGeneration: bool = False  # If True, only randomize, don't generate
    attemptId: str | None = None
    simulationId: str | None = None


async def _generate_scenario_impl(
    sid: str, data: GenerateScenarioPayload, profile_id: uuid.UUID
) -> None:
    """Handle scenario generation - randomization then route to artifacts."""
    try:
        # Convert string IDs to UUIDs
        department_id = uuid.UUID(data.departmentId)
        persona_ids = (
            [uuid.UUID(p) for p in data.personaIds] if data.personaIds else None
        )
        document_ids = (
            [uuid.UUID(d) for d in data.documentIds] if data.documentIds else None
        )
        field_ids = [uuid.UUID(f) for f in data.fieldIds] if data.fieldIds else None
        scenario_id_uuid = uuid.UUID(data.scenarioId) if data.scenarioId else None

        # Filter out empty lists
        if document_ids and len(document_ids) == 0:
            document_ids = None

        async with get_db_connection() as conn:
            # Step 1: Randomize missing values using SQL function
            needs_persona = not persona_ids or len(persona_ids) == 0
            needs_documents = not document_ids or len(document_ids) == 0
            needs_fields = not field_ids or len(field_ids) == 0

            # Determine which values need randomization based on randomizeType
            randomize_type = data.randomizeType or "all"
            if data.randomizeType:
                if data.randomizeType == "persona":
                    needs_persona = True
                    needs_documents = False
                    needs_fields = False
                elif data.randomizeType == "document":
                    needs_persona = False
                    needs_documents = True
                    needs_fields = False
                elif data.randomizeType == "parameters":
                    needs_persona = False
                    needs_documents = False
                    needs_fields = True
                elif data.randomizeType.startswith("parameter_"):
                    needs_persona = False
                    needs_documents = False
                    needs_fields = True
                else:  # "all" or None
                    pass

            randomized_selections = None
            if needs_persona or needs_documents or needs_fields:
                # Get department IDs (from scenario, then profile, then use provided)
                department_ids_list: list[uuid.UUID] = []
                if department_id:
                    department_ids_list = [department_id]
                elif scenario_id_uuid:
                    # Try scenario departments first - fetch all rows
                    dept_params = GetScenarioDepartmentsSqlParams(
                        scenario_id=scenario_id_uuid
                    )
                    sql_get_depts = load_sql(
                        "app/sql/v4/scenario/get_scenario_departments_complete.sql"
                    )
                    dept_rows = await conn.fetch(sql_get_depts, scenario_id_uuid)
                    if dept_rows:
                        department_ids_list = [
                            uuid.UUID(str(row["department_id"]))
                            for row in dept_rows
                            if row.get("department_id")
                        ]
                
                if not department_ids_list and profile_id:
                    # Fallback to profile departments - fetch all rows
                    profile_dept_params = GetDepartmentsForProfileSqlParams(
                        profile_id=profile_id
                    )
                    sql_get_profile_depts = load_sql(
                        "app/sql/v4/profile/get_departments_for_profile_complete.sql"
                    )
                    profile_dept_rows = await conn.fetch(
                        sql_get_profile_depts, profile_id
                    )
                    if profile_dept_rows:
                        department_ids_list = [
                            uuid.UUID(str(row["id"]))
                            for row in profile_dept_rows
                            if row.get("id")
                        ]

                # Get randomization ranges
                persona_min = 1
                persona_max = 3
                document_min = 0
                document_max = 3
                parameter_selection_min = 0
                parameter_selection_max = 3
                field_ranges_json: dict[str, dict[str, int]] = {}

                if scenario_id_uuid:
                    ranges_params = GetRandomizationRangesSqlParams(
                        scenario_id=scenario_id_uuid
                    )
                    ranges_result = cast(
                        GetRandomizationRangesSqlRow,
                        await execute_sql_typed(
                            conn,
                            "app/sql/v4/scenario/get_randomization_ranges_complete.sql",
                            params=ranges_params,
                        ),
                    )
                    if ranges_result:
                        persona_min = ranges_result.persona_min or 1
                        persona_max = ranges_result.persona_max or 3
                        document_min = ranges_result.document_min or 0
                        document_max = ranges_result.document_max or 3
                        parameter_selection_min = ranges_result.parameter_min or 0
                        parameter_selection_max = ranges_result.parameter_max or 3
                        if ranges_result.field_ranges_json:
                            if isinstance(ranges_result.field_ranges_json, str):
                                try:
                                    field_ranges_json = json.loads(
                                        ranges_result.field_ranges_json
                                    )
                                except json.JSONDecodeError:
                                    field_ranges_json = {}
                            elif isinstance(ranges_result.field_ranges_json, dict):
                                field_ranges_json = ranges_result.field_ranges_json

                # Extract parameter_ids from field_ids if needed
                parameter_ids: list[uuid.UUID] = []
                if field_ids:
                    # Get parameter_ids from fields table directly
                    sql_get_params = """
                        SELECT DISTINCT parameter_id 
                        FROM fields 
                        WHERE id = ANY($1::uuid[]) AND parameter_id IS NOT NULL
                    """
                    param_rows = await conn.fetch(sql_get_params, [fid for fid in field_ids])
                    parameter_ids = [
                        uuid.UUID(str(row["parameter_id"]))
                        for row in param_rows
                        if row.get("parameter_id")
                    ]

                # Call SQL randomization function
                # SQL function handles NULL scenario_id, but type system requires UUID
                # Use dummy UUID if None - SQL function will handle it
                randomize_params = RandomizeScenarioSqlParams(
                    scenario_id=scenario_id_uuid if scenario_id_uuid else uuid.UUID(
                        "00000000-0000-0000-0000-000000000000"
                    ),
                    profile_id=profile_id,
                    randomize_type=randomize_type,
                    department_ids=department_ids_list,
                    persona_ids=persona_ids or [],
                    document_ids=document_ids or [],
                    parameter_ids=parameter_ids,
                    field_ids=field_ids or [],
                    persona_min=persona_min,
                    persona_max=persona_max,
                    document_min=document_min,
                    document_max=document_max,
                    parameter_selection_min=parameter_selection_min,
                    parameter_selection_max=parameter_selection_max,
                    field_ranges_json=field_ranges_json,
                )

                randomize_result = cast(
                    RandomizeScenarioSqlRow,
                    await execute_sql_typed(
                        conn,
                        "app/sql/v4/scenario/randomize_scenario_complete.sql",
                        params=randomize_params,
                    ),
                )

                # Map results back to expected format
                randomized_selections = {
                    "persona_ids": (
                        randomize_result.randomized_persona_ids
                        if randomize_result.randomized_persona_ids
                        else None
                    ),
                    "document_ids": (
                        randomize_result.randomized_document_ids
                        if randomize_result.randomized_document_ids
                        else None
                    ),
                    "field_ids": (
                        randomize_result.randomized_field_ids
                        if randomize_result.randomized_field_ids
                        else None
                    ),
                    "department_id": (
                        department_ids_list[0] if department_ids_list else None
                    ),
                }

                # Update values with randomized selections
                if randomized_selections.get("persona_ids") and needs_persona:
                    persona_ids = randomized_selections["persona_ids"]
                if randomized_selections.get("document_ids") and needs_documents:
                    document_ids = randomized_selections["document_ids"]
                if randomized_selections.get("field_ids") and needs_fields:
                    field_ids = randomized_selections["field_ids"]
                if randomized_selections.get("department_id"):
                    department_id = randomized_selections["department_id"]

                # Link randomized selections to scenario if scenarioId is provided
                if scenario_id_uuid:
                    # Link persona
                    if randomized_selections.get("persona_ids"):
                        sql = load_sql(
                            "app/sql/v4/scenario/insert_scenario_persona_link.sql"
                        )
                        for persona_id_val in randomized_selections["persona_ids"]:
                            await conn.execute(
                                sql, scenario_id_uuid, persona_id_val, True
                            )

                    # Link documents
                    if randomized_selections.get("document_ids"):
                        sql = load_sql(
                            "app/sql/v4/scenario/insert_scenario_document_link.sql"
                        )
                        for doc_id_val in randomized_selections["document_ids"]:
                            await conn.execute(sql, scenario_id_uuid, doc_id_val, True)

                    # Link parameters
                    if randomized_selections.get("field_ids"):
                        sql = load_sql(
                            "app/sql/v4/scenario/insert_scenario_parameter_link.sql"
                        )
                        for field_id_val in randomized_selections["field_ids"]:
                            await conn.execute(
                                sql, scenario_id_uuid, field_id_val, True
                            )

                    # Link department
                    if randomized_selections.get("department_id"):
                        sql = load_sql(
                            "app/sql/v4/scenario/insert_scenario_department_link.sql"
                        )
                        await conn.execute(
                            sql,
                            scenario_id_uuid,
                            randomized_selections["department_id"],
                            True,
                        )

                # Emit randomization complete event
                await sio.emit(
                    "scenario_randomize_complete",
                    {
                        "success": True,
                        "randomized_selections": {
                            "personaIds": (
                                [str(p) for p in randomized_selections["persona_ids"]]
                                if randomized_selections.get("persona_ids")
                                else None
                            ),
                            "documentIds": (
                                [str(d) for d in randomized_selections["document_ids"]]
                                if randomized_selections.get("document_ids")
                                else None
                            ),
                            "fieldIds": (
                                [str(f) for f in randomized_selections["field_ids"]]
                                if randomized_selections.get("field_ids")
                                else None
                            ),
                        },
                        "message": "Randomized missing scenario values",
                    },
                    room=sid,
                )

            # If skipGeneration is True, stop here after randomization
            if data.skipGeneration:
                return

            # Step 2: Route to generate_start (which will create run and route back to scenario_generate)
            scenario_agent_id = uuid.UUID(data.scenarioAgentId)
            resource_id = str(scenario_id_uuid) if scenario_id_uuid else str(uuid.uuid4())

            await internal_sio.emit(
                "generate_start",
                {
                    "sid": sid,
                    "agent_id": str(scenario_agent_id),
                    "resource_id": resource_id,
                    "resource_type": "scenario",
                    "group_id": None,  # Will be created by generate_start
                    "user_instructions": None,
                    "message_ids": None,
                    "developer_message_contents": None,
                },
            )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate scenario: {str(e)}",
                resource_id=data.scenarioId,
                group_id=None,
                resource_type="scenario",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def scenario_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle scenario_generate event (client-to-server)."""
    try:
        payload = GenerateScenarioPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    resource_id=data.get("scenarioId"),
                    group_id=None,
                    resource_type="scenario",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _generate_scenario_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                resource_id=data.get("scenarioId"),
                group_id=None,
                resource_type="scenario",
            ),
            sid=sid,
        )


@internal_sio.on("scenario_generate")  # type: ignore
async def scenario_generate_internal(data: dict[str, Any]) -> None:
    """Handle scenario_generate event from internal bus (server-to-server).
    
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
                error_message=f"Failed to route scenario generation: {str(e)}",
                resource_id=data.get("resource_id"),
                group_id=data.get("group_id"),
                resource_type="scenario",
            ),
            sid=sid,
        )

