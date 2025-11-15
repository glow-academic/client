"""Scenario generate AI endpoint - v3 API following DHH principles."""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from agents import (FunctionToolResult, RunContextWrapper, Runner,
                    ToolsToFinalOutputResult, gen_trace_id, trace)
from agents.items import TResponseInputItem
from app.main import get_db, scenario_progress, scenario_results
from app.utils.agents.generic_agent import GenericAgent
from app.utils.agents.tools.create_scenario_tools import create_scenario_tools
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.document.format_document_info import format_document_info
from app.utils.error.handle_route_error import handle_route_error
from app.utils.personas import format_persona_info
from app.utils.scenario import format_parameter_item_info
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel


# Inline request/response schemas
class GenerateScenarioAIRequest(BaseModel):
    """Request to generate AI scenario content."""

    departmentId: str
    personaIds: list[str] | None = None
    documentIds: list[str] | None = None
    parameterItemIds: list[str] | None = None
    profileId: str | None = None
    userInstructions: str | None = None
    objectivesEnabled: bool = True


class GenerateScenarioAIResponse(BaseModel):
    """Response from AI scenario generation."""

    success: bool
    message: str
    title: str
    description: str
    objectives: list[str]


router = APIRouter()


@router.post("/generate-ai", response_model=GenerateScenarioAIResponse)
async def generate_scenario_ai(
    request: GenerateScenarioAIRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GenerateScenarioAIResponse:
    """Generate AI scenario content (title, description, objectives)."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Convert string IDs to UUIDs
        department_id = uuid.UUID(request.departmentId)
        persona_ids = (
            [uuid.UUID(p) for p in request.personaIds] if request.personaIds else None
        )
        # For AI agent, use first persona if multiple provided (agent expects single persona_id)
        persona_id = persona_ids[0] if persona_ids and len(persona_ids) > 0 else None
        document_ids = (
            [uuid.UUID(d) for d in request.documentIds] if request.documentIds else None
        )
        parameter_item_ids = (
            [uuid.UUID(p) for p in request.parameterItemIds]
            if request.parameterItemIds
            else None
        )
        profile_id = uuid.UUID(request.profileId) if request.profileId else None

        # Filter out empty lists
        if document_ids and len(document_ids) == 0:
            document_ids = None

        # Generate scenario content (inlined run_scenario_agent)
        # Clear previous results
        scenario_results.clear()
        scenario_progress.clear()

        # Get all context data in a single optimized query using SQL file
        doc_ids_str = [str(d) for d in document_ids] if document_ids else []
        param_ids_str = (
            [str(p) for p in parameter_item_ids] if parameter_item_ids else []
        )

        sql = load_sql("sql/v3/agents/get_scenario_run_context.sql")
        context_row = await conn.fetchrow(
            sql,
            str(department_id),
            str(persona_id) if persona_id else None,
            doc_ids_str,
            param_ids_str,
        )

        if not context_row:
            raise ValueError(
                f"No scenario agent configured for department {department_id}"
            )

        # Parse JSON arrays
        documents = (
            json.loads(context_row["documents"])
            if isinstance(context_row["documents"], str)
            else context_row["documents"]
        )
        parameter_items = (
            json.loads(context_row["parameter_items"])
            if isinstance(context_row["parameter_items"], str)
            else context_row["parameter_items"]
        )

        context = {
            "agent_id": context_row["agent_id"],
            "agent_name": context_row["agent_name"],
            "system_prompt": context_row["system_prompt"],
            "temperature": float(context_row["temperature"])
            if context_row["temperature"] is not None
            else 0.0,
            "reasoning": context_row["reasoning"],
            "model_id": context_row["model_id"],
            "model_name": context_row["model_name"],
            "custom_model": context_row["custom_model"],
            "provider_id": context_row["provider_id"],
            "provider_name": context_row["provider_name"],
            "base_url": context_row["base_url"],
            "api_key": context_row["api_key"],
            "persona": {
                "id": context_row["persona_id"],
                "name": context_row["persona_name"],
                "description": context_row["persona_description"],
            }
            if context_row["persona_id"]
            else None,
            "documents": documents,
            "parameter_items": parameter_items,
            "default_guest_profile_id": context_row["guest_profile_id"],
            "req_per_day": context_row["req_per_day"],
            "runs_today_count": context_row["runs_today_count"],
            "earliest_run_created_at": context_row["earliest_run_created_at"],
        }

        # Format persona info if persona was provided
        if persona_id is None or context["persona"] is None:
            persona_info = None
            show_images = False
        else:
            persona_info = format_persona_info(context["persona"])
            show_images = False

        # Format document info if documents were provided
        if not document_ids or len(document_ids) == 0:
            document_info = None
        else:
            document_info = format_document_info(context["documents"], show_images)

        # Format parameter item info if parameter items were provided
        if not parameter_item_ids or len(parameter_item_ids) == 0:
            parameter_item_info = None
        else:
            parameter_item_info = format_parameter_item_info(context["parameter_items"])

        # Create scenario generation tools
        group_id = None
        objectives_enabled = request.objectivesEnabled
        scenario_tools = create_scenario_tools(
            group_id, objectives_enabled=objectives_enabled
        )
        scenario_tools.append(debug_info_tool)

        # Create tool use behavior to check when all required tools are called
        def tool_use_behavior(
            tool_context: RunContextWrapper[Any],
            tool_results: list[FunctionToolResult],
        ) -> ToolsToFinalOutputResult:
            required_tools = ["title_description"]
            if objectives_enabled:
                required_tools.append("objectives")

            completed_required = all(
                scenario_progress.get(tool, False) for tool in required_tools
            )

            return ToolsToFinalOutputResult(is_final_output=completed_required)

        scenario_agent_generic = GenericAgent(
            agent_name=context["agent_name"],
            system_prompt=context["system_prompt"],
            temperature=context["temperature"],
            model_name=context["model_name"],
            model_provider=context["provider_name"],
            base_url=context["base_url"],
            api_key=context["api_key"],
            reasoning=context["reasoning"],
            tools=scenario_tools,
            parallel_tool_calls=False,
            tool_use_behavior=tool_use_behavior,
            custom_model=context["custom_model"],
        )

        agent_instance = scenario_agent_generic.agent()

        input_items: list[TResponseInputItem | None] = [
            persona_info,
            document_info,
            parameter_item_info,
        ]

        # Add user instructions as first input item if provided
        if request.userInstructions and request.userInstructions.strip():
            user_instructions_item: TResponseInputItem = {
                "role": "user",
                "content": f"User instructions for scenario generation: {request.userInstructions.strip()}",
            }
            input_items.insert(0, user_instructions_item)

        clean_input_items = [item for item in input_items if item is not None]

        # Generate a trace id for the scenario
        scenario_trace_id = gen_trace_id()

        # Use default guest profile from context if no profile_id provided
        final_profile_id = (
            profile_id if profile_id else context["default_guest_profile_id"]
        )

        # Check rate limit
        profile_id_uuid = final_profile_id if final_profile_id else None
        if not profile_id_uuid:
            raise ValueError("Profile not found. Please contact support.")

        req_per_day = context["req_per_day"]
        runs_today_count = context["runs_today_count"]

        if req_per_day is not None and runs_today_count >= req_per_day:
            from datetime import timedelta
            from zoneinfo import ZoneInfo

            earliest_run_created_at = context["earliest_run_created_at"]
            if earliest_run_created_at:
                next_allowed_utc = earliest_run_created_at + timedelta(days=1)
                eastern_tz = ZoneInfo("America/New_York")
                next_allowed_et = next_allowed_utc.astimezone(eastern_tz)
                error_message = (
                    f"Daily request limit of {req_per_day} reached. "
                    f"Next request allowed after {next_allowed_et.strftime('%I:%M %p %Z')} on "
                    f"{next_allowed_et.strftime('%B %d, %Y')}."
                )
            else:
                error_message = f"Daily request limit of {req_per_day} reached. Please try again tomorrow."
            raise ValueError(error_message)

        # Create model run with all junction records using SQL file
        sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
        model_run_row = await conn.fetchrow(
            sql_create_run,
            str(department_id),
            context["model_id"],
            context["agent_id"],
            "agent",
            final_profile_id,
        )
        model_run_id = uuid.UUID(model_run_row["model_run_id"])

        with trace(
            "Scenario Agent",
            group_id=str(group_id) if group_id else None,
            trace_id=scenario_trace_id,
        ):
            result = await Runner.run(
                agent_instance,
                input=clean_input_items,
                context=DebugContext(conn=conn, model_run_id=model_run_id),
            )

        # Extract results from the global storage
        scenario_result = scenario_results

        usage = result.context_wrapper.usage

        # Update model run with token usage using SQL file
        sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
        await conn.execute(
            sql_update_tokens,
            str(model_run_id),
            usage.input_tokens,
            usage.output_tokens,
        )

        # Get result values
        title = scenario_result.get("title", "")
        description = scenario_result.get("description", "")
        objectives = scenario_result.get("objectives", []) if objectives_enabled else []

        # Limit objectives to maximum 3
        limited_objectives = objectives[:3] if objectives else []

        return GenerateScenarioAIResponse(
            success=True,
            message="Scenario generated successfully",
            title=title,
            description=description,
            objectives=limited_objectives,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="generate_scenario_ai",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
