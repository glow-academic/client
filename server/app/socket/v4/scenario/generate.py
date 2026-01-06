"""Scenario page handler - handles randomization logic, then routes to artifacts/generate.py."""

import json
import uuid
from typing import Any

import asyncpg  # type: ignore
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from fastapi import APIRouter
from pydantic import BaseModel
from utils.sql_helper import execute_sql_typed, load_sql

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# Import randomization function from old agents
from app.socket.old.agents.scenario.generate import (
    _randomize_missing_scenario_values,
)


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
            # Step 1: Randomize missing values
            needs_persona = not persona_ids or len(persona_ids) == 0
            needs_documents = not document_ids or len(document_ids) == 0
            needs_fields = not field_ids or len(field_ids) == 0

            # Determine which values need randomization based on randomizeType
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
                    param_id_str = data.randomizeType.replace("parameter_", "")
                    try:
                        parameter_id_to_randomize = (
                            uuid.UUID(param_id_str) if param_id_str else None
                        )
                    except (ValueError, TypeError):
                        parameter_id_to_randomize = None
                else:  # "all" or None
                    parameter_id_to_randomize = None
            else:
                parameter_id_to_randomize = None

            randomized_selections = None
            if needs_persona or needs_documents or needs_fields:
                randomized_selections = await _randomize_missing_scenario_values(
                    conn=conn,
                    scenario_id=scenario_id_uuid,
                    profile_id=profile_id,
                    department_id=department_id,
                    existing_persona_ids=persona_ids if not needs_persona else None,
                    existing_document_ids=document_ids if not needs_documents else None,
                    existing_field_ids=field_ids if not needs_fields else None,
                    randomize_type=data.randomizeType,
                    parameter_id_to_randomize=parameter_id_to_randomize,
                )

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

