"""Handler for rubric_generate WebSocket event."""

import json
import uuid
from typing import Any, cast

from agents import Runner, function_tool, gen_trace_id, trace
from agents.items import TResponseInputItem
from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.infra.v3.agents.generic_agent import GenericAgent
from app.infra.v3.debug.debug_info import DebugContext
from app.main import get_internal_sio, get_pool, sio
from app.sql.types import (GetRubricRunContextAndCreateRunApiRequest,
                           GetRubricRunContextAndCreateRunSqlParams,
                           GetRubricRunContextAndCreateRunSqlRow,
                           IUpdateStandardDescriptionsV3Description,
                           UpdateStandardDescriptionsApiRequest)
from fastapi import APIRouter
from pydantic import BaseModel, Field, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/rubrics/get_rubric_run_context_and_create_run_complete.sql"


# Pydantic models for server-to-client events
class RubricGenerationProgressPayload(BaseModel):
    """Response indicating progress in rubric generation."""

    type: str  # "start", "tool_call", "complete"
    message: str | None = None
    tool_name: str | None = None
    trace_id: str | None = None


class RubricGenerationCompletePayload(BaseModel):
    """Response indicating rubric generation completed successfully."""

    success: bool
    message: str
    trace_id: str | None = None


class RubricGenerationErrorPayload(BaseModel):
    """Response indicating an error occurred in rubric generation."""

    success: bool
    message: str
    trace_id: str | None = None


# Pydantic model for client-to-server event
class GenerateRubricPayload(BaseModel):
    """Request to generate rubric descriptions using AI."""

    departmentId: str
    rubricAgentId: (
        str  # Required: UI filters and selects appropriate agent for rubric generation
    )
    profileId: str | None = None
    rubricId: str | None = None  # Optional rubric ID to link generated descriptions
    standardGroups: list[
        dict[str, Any]
    ]  # Array with id, name, description, points, passPoints
    standards: list[dict[str, Any]]  # Array with id, name, points, standardGroupId


# Emit helper functions
async def rubric_generation_progress(
    payload: RubricGenerationProgressPayload, room: str
) -> None:
    await sio.emit(
        "rubrics_generation_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def rubric_generation_complete(
    payload: RubricGenerationCompletePayload, room: str
) -> None:
    await sio.emit("rubrics_generation_complete", payload.model_dump(), room=room)


async def rubric_generation_error(
    payload: RubricGenerationErrorPayload, room: str
) -> None:
    await sio.emit("rubrics_generation_error", payload.model_dump(), room=room)


async def _rubric_generate_impl(sid: str, data: GenerateRubricPayload) -> None:
    """Handle rubric generation requests via WebSocket."""
    trace_id = gen_trace_id()

    try:
        logger.info(f"Received rubric_generate request from {sid} with data: {data}")

        # Convert string IDs to UUIDs
        department_id = uuid.UUID(data.departmentId)
        rubric_agent_id = uuid.UUID(data.rubricAgentId)
        profile_id = uuid.UUID(data.profileId) if data.profileId else None
        rubric_id = uuid.UUID(data.rubricId) if data.rubricId else None

        # Get connection pool
        pool = get_pool()
        if not pool:
            await rubric_generation_error(
                RubricGenerationErrorPayload(
                    success=False,
                    message="Database connection pool not available",
                    trace_id=trace_id,
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Emit start event
            await rubric_generation_progress(
                RubricGenerationProgressPayload(
                    type="start",
                    message="Starting rubric generation",
                    trace_id=trace_id,
                ),
                room=sid,
            )

            # Get all context data AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            if not profile_id:
                await rubric_generation_error(
                    RubricGenerationErrorPayload(
                        success=False,
                        message="Profile ID is required",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            try:
                # Use execute_sql_typed() - auto-detects function
                params = GetRubricRunContextAndCreateRunSqlParams(
                    department_id=department_id,
                    profile_id=profile_id,
                    rubric_agent_id=rubric_agent_id,
                )
                result = cast(
                    GetRubricRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                # Check if it's a rate limit error from SQL (PostgreSQL exception)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    # Extract the user-friendly message (everything after "RATE_LIMIT_EXCEEDED: ")
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await rubric_generation_error(
                        RubricGenerationErrorPayload(
                            success=False,
                            message=user_msg,
                            trace_id=trace_id,
                        ),
                        room=sid,
                    )
                    return
                # Log other errors
                logger.error(
                    f"Failed to get context and create run for {sid}: {str(e)}",
                    exc_info=True,
                )
                await rubric_generation_error(
                    RubricGenerationErrorPayload(
                        success=False,
                        message=f"Failed to initialize rubric generation: {str(e)}",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            if not result or not result.run_id:
                await rubric_generation_error(
                    RubricGenerationErrorPayload(
                        success=False,
                        message=f"No rubric agent configured for department {data.departmentId}",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Build context dict from strongly typed result
            context = {
                "agent_id": result.agent_id,
                "agent_name": result.agent_name,
                "system_prompt": result.system_prompt or "",
                "temperature": float(result.temperature) if result.temperature is not None else 0.0,
                "reasoning": result.reasoning,
                "model_id": result.model_id,
                "model_name": result.model_name,
                "provider": result.provider or "",
                "base_url": result.base_url or "",
                "api_key": result.api_key,
                "profile_id": result.profile_id,
            }

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)

            # Build rubric structure context for the agent
            rubric_context = {
                "standard_groups": data.standardGroups,
                "standards": data.standards,
            }

            # Create rubric generation tool
            async def generate_standard_group_descriptions(
                descriptions: list[dict[str, Any]] = Field(
                    description="Array of descriptions for each grid cell. Each item should have standard_group_id, standard_id, and description fields."
                ),
            ) -> str:
                """Generate descriptions for rubric grid cells.

                For each combination of standard group and standard, generate a clear,
                specific description that describes what performance looks like at that
                level for that dimension.

                Args:
                    descriptions: Array of objects with:
                        - standard_group_id: UUID string of the standard group
                        - standard_id: UUID string of the standard
                        - description: Generated description text for this grid cell

                Returns:
                    Confirmation message
                """
                # Emit to internal bus for description updates
                # ✅ Use target event's ApiRequest type for type-safe event chaining
                # Convert descriptions to composite type objects
                descriptions_list = [
                    IUpdateStandardDescriptionsV3Description(
                        standard_group_id=uuid.UUID(desc["standard_group_id"]) if isinstance(desc["standard_group_id"], str) else desc["standard_group_id"],
                        standard_id=uuid.UUID(desc["standard_id"]) if isinstance(desc["standard_id"], str) else desc["standard_id"],
                        description=desc["description"]
                    )
                    for desc in descriptions
                ]
                
                # Only emit if rubric_id is provided (required for UpdateStandardDescriptionsApiRequest)
                if rubric_id:
                    payload = UpdateStandardDescriptionsApiRequest(
                        rubric_id=rubric_id,
                        descriptions=descriptions_list,
                    )
                    
                    # Emit with strongly typed payload (serialize for socket.io)
                    await internal_sio.emit(
                        "rubric_tool_standard_group_descriptions",
                        {
                            "sid": sid,
                            "profile_id": str(profile_id),
                            "trace_id": trace_id,
                            **payload.model_dump(mode='json'),  # UUIDs → strings for socket.io
                        },
                    )
                else:
                    logger.warning(
                        f"[generate_rubric] Skipping standard group descriptions update - no rubric_id provided (trace_id={trace_id})"
                    )

                logger.info(
                    f"[generate_rubric] Emitted standard group descriptions to internal bus: "
                    f"rubric_id={rubric_id}, descriptions_count={len(descriptions)}"
                )
                return f"Generated {len(descriptions)} standard group descriptions successfully"

            rubric_tools = [function_tool(generate_standard_group_descriptions)]

            # Build rubric agent with tools
            rubric_agent = GenericAgent(
                agent_name=context["agent_name"],
                system_prompt=context["system_prompt"],
                temperature=context["temperature"],
                model_name=context["model_name"],
                provider=context["provider"],
                base_url=context["base_url"],
                api_key=context["api_key"],
                reasoning=context["reasoning"],
                tools=rubric_tools,
                parallel_tool_calls=False,
            )

            # Format rubric context for agent input
            rubric_context_text = f"""You are generating descriptions for a rubric grid. The rubric has the following structure:

Standard Groups:
{json.dumps([{"id": g.get("id"), "name": g.get("name"), "description": g.get("description", ""), "points": g.get("points")} for g in data.standardGroups], indent=2)}

Standards:
{json.dumps([{"id": s.get("id"), "name": s.get("name"), "points": s.get("points"), "standardGroupId": s.get("standardGroupId")} for s in data.standards], indent=2)}

For each combination of standard group and standard, generate a clear, specific description (1-3 sentences) that describes what performance looks like at that level for that dimension. The description should be:
- Specific and observable (avoid vague terms)
- Aligned with the point value (higher points = better performance)
- Consistent with other descriptions in the same standard group
- Appropriate for educational rubrics

You must call the generate_standard_group_descriptions tool with an array of descriptions, where each description object contains:
- standard_group_id: The UUID string of the standard group
- standard_id: The UUID string of the standard
- description: The generated description text for this grid cell

Generate descriptions for ALL combinations of standard groups and standards."""

            # Construct input items for the agent
            input_items: list[TResponseInputItem] = [
                {
                    "role": "user",
                    "content": rubric_context_text,
                }
            ]

            # Rate limit validation and run creation are now handled in SQL
            # (get_rubric_run_context_and_create_run_complete.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully

            # Run rubric generation with tracing
            with trace(
                "Rubric Agent",
                trace_id=trace_id,
                group_id=None,
            ):
                run_result = await Runner.run(
                    rubric_agent.agent(),
                    input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Emit async pricing event (non-blocking)
            # This handles token updates and message logging in background
            usage = run_result.context_wrapper.usage
            assistant_output = getattr(run_result, "final_output", None) or ""
            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "rubric",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": context["system_prompt"],
                    "inputItems": input_items,  # Serialized TResponseInputItem list
                    "assistantOutput": assistant_output,
                    "departmentId": str(department_id),
                },
            )

            # Emit completion event
            # Note: Individual tool completion events are emitted separately by tool handlers
            await rubric_generation_complete(
                RubricGenerationCompletePayload(
                    success=True,
                    message="Rubric generation completed successfully",
                    trace_id=trace_id,
                ),
                room=sid,
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="rubrics.generated",
                    template="{{ actor.name }} generated rubric descriptions",
                    context={
                        "department_id": str(department_id),
                        "rubric_id": str(rubric_id) if rubric_id else None,
                    },
                    endpoint="/socket/v3/rubrics/generate",
                    error=False,
                )
            except Exception as log_error:
                logger.warning(f"Error logging rubric generation activity: {log_error}")

    except Exception as e:
        logger.error(f"Error in rubric_generate for {sid}: {str(e)}", exc_info=True)
        await rubric_generation_error(
            RubricGenerationErrorPayload(
                success=False, message=str(e), trace_id=trace_id
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="rubrics.generated",
                template="{{ actor.name }} failed to generate rubric descriptions",
                context={"error": str(e)},
                endpoint="/socket/v3/rubrics/generate",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging rubric generation error activity: {log_error}"
            )


@sio.event  # type: ignore
async def rubric_generate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = GenerateRubricPayload(**data)
        await _rubric_generate_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in rubric_generate for {sid}: {e}")
        await rubric_generation_error(
            RubricGenerationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}", trace_id=None
            ),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="rubrics.generated",
                template="{{ actor.name }} failed to generate rubric descriptions (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v3/rubrics/generate",
                error=True,
            )
        except Exception as log_error:
            logger.warning(
                f"Error logging rubric generation validation error activity: {log_error}"
            )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/generate", response_model=dict[str, bool])
async def rubric_generate_api(request: GenerateRubricPayload) -> dict[str, bool]:
    """Client-to-server event: Generate rubric descriptions using AI."""
    return {"success": True}


@server_router.post("/generation_progress", response_model=dict[str, bool])
async def rubric_generation_progress_api(
    request: RubricGenerationProgressPayload,
) -> dict[str, bool]:
    """Server-to-client event: Progress update for rubric generation."""
    return {"success": True}


@server_router.post("/generation_complete", response_model=dict[str, bool])
async def rubric_generation_complete_api(
    request: RubricGenerationCompletePayload,
) -> dict[str, bool]:
    """Server-to-client event: Rubric generation completed successfully."""
    return {"success": True}


@server_router.post("/generation_error", response_model=dict[str, bool])
async def rubric_generation_error_api(
    request: RubricGenerationErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred during rubric generation."""
    return {"success": True}
