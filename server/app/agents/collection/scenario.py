import logging
import uuid
from typing import Any

import asyncpg  # type: ignore
from agents import (Runner, ToolsToFinalOutputResult, function_tool,
                    gen_trace_id, trace)
from agents.items import TResponseInputItem
from app.agents.generic import GenericAgent
from app.db import get_db
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.document import format_document_info
from app.utils.personas import format_persona_info
from app.utils.scenario import format_parameter_item_info
from app.utils.sql_helper import load_sql
from fastapi import Depends
from pydantic import Field

logger = logging.getLogger(__name__)

# Global storage for scenario generation results
scenario_results: dict[str, Any] = {}
scenario_progress: dict[str, bool] = {}


def create_title_description_function(group_id: uuid.UUID | None) -> Any:
    """Create a function tool for setting scenario title and description."""

    async def set_title_and_description(
        title: str = Field(
            description="Short, descriptive title for the scenario (5-10 words)"
        ),
        scenario: str = Field(
            description="Scenario description (1-2 sentences) that subtly demonstrates the persona without naming it"
        ),
    ) -> str:
        """Set the title and description for the scenario.

        The title should be concise and descriptive (5-10 words).
        The scenario description must be exactly 1-2 sentences and should:
        - Subtly show the student's persona without stating it directly
        - Incorporate environmental parameters (crowdedness, intensity, time, deadline, location)
        - Focus on the course topic from the documents
        - Build a scene that shows, not tells

        Args:
            title: Short descriptive title
            scenario: 1-2 sentence scenario description

        Returns:
            Confirmation message
        """
        scenario_results["title"] = title
        scenario_results["description"] = scenario
        scenario_progress["title_description"] = True

        logger.info(f"✓ Set title: {title}")
        logger.info(f"✓ Set description: {scenario[:100]}...")
        return "Set title and description successfully"

    return function_tool(set_title_and_description)


def create_objectives_function(group_id: uuid.UUID | None) -> Any:
    """Create a function tool for setting scenario learning objectives."""

    async def set_objectives(
        objectives: list[str] = Field(
            description="List of 1-3 specific learning objectives that GTAs should achieve in this scenario"
        ),
    ) -> str:
        """Set the learning objectives for this scenario.

        Objectives should:
        - Be specific and measurable
        - Relate to the skills needed to handle this particular scenario
        - Focus on pedagogical skills, communication, or subject matter knowledge
        - Be achievable within a single chat interaction

        Examples:
        - "Demonstrate active listening by paraphrasing the student's concerns"
        - "Break down complex concepts into understandable chunks"
        - "Manage time effectively while addressing the student's emotional state"

        Args:
            objectives: List of 1-3 learning objectives (maximum 3)

        Returns:
            Confirmation message
        """
        # Limit to maximum 3 objectives
        objectives = objectives[:3]
        
        if len(objectives) < 1 or len(objectives) > 3:
            logger.warning(
                f"Objectives count ({len(objectives)}) outside recommended range of 1-3"
            )

        scenario_results["objectives"] = objectives
        scenario_progress["objectives"] = True

        logger.info(f"✓ Set {len(objectives)} objectives: {objectives}")
        return f"Set {len(objectives)} learning objectives successfully"

    return function_tool(set_objectives)


def create_scenario_tools(group_id: uuid.UUID | None, objectives_enabled: bool = True) -> list[Any]:
    """Create all scenario generation function tools."""
    tools = []

    # Add title and description tool
    tools.append(create_title_description_function(group_id))
    logger.info("Created title and description tool")

    # Add objectives tool only if enabled
    if objectives_enabled:
        tools.append(create_objectives_function(group_id))
        logger.info("Created objectives tool")
    else:
        logger.info("Objectives tool skipped (objectives_enabled=False)")

    logger.info(f"Total scenario tools created: {len(tools)}")
    return tools


async def run_scenario_agent(
    department_id: uuid.UUID,
    persona_id: uuid.UUID | None = None,
    document_ids: list[uuid.UUID] | None = None,
    parameter_item_ids: list[uuid.UUID] | None = None,
    group_id: uuid.UUID | None = None,
    conn: asyncpg.Connection = Depends(get_db),
    profile_id: uuid.UUID | None = None,
    sio_instance: Any = None,
    user_instructions: str | None = None,
    objectives_enabled: bool = True,
) -> tuple[str, str, list[str], str]:
    """
    This function is used to run the scenario agent.

    Args:
        department_id: The ID of the department
        persona_id: The ID of the persona
        document_ids: The IDs of the documents
        parameter_item_ids: The IDs of the parameter items
        group_id: The ID of the group
        conn: The database connection (asyncpg.Connection)
        profile_id: The ID of the profile (optional)
        sio_instance: Optional Socket.IO instance for progress events
        user_instructions: Optional user instructions for scenario generation
    Returns:
        A tuple of (title, description, objectives, trace_id).
    """
    try:
        # Clear previous results
        global scenario_results, scenario_progress
        scenario_results.clear()
        scenario_progress.clear()

        # Get all context data in a single optimized query using SQL file
        # Convert None to empty arrays for proper SQL handling
        doc_ids = [str(d) for d in document_ids] if document_ids else []
        param_ids = [str(p) for p in parameter_item_ids] if parameter_item_ids else []
        
        sql = load_sql("sql/v3/agents/get_scenario_run_context.sql")
        context_row = await conn.fetchrow(
            sql,
            str(department_id),
            str(persona_id) if persona_id else None,
            doc_ids,
            param_ids,
        )
        
        if not context_row:
            raise ValueError(f"No scenario agent configured for department {department_id}")
        
        # Parse JSON arrays
        import json
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
            "temperature": float(context_row["temperature"]) if context_row["temperature"] is not None else 0.0,
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
            } if context_row["persona_id"] else None,
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
            # Note: image_input_active moved to simulation level
            # For scenario generation, default to False
            show_images = False

        # Format document info if documents were provided
        if document_ids is None or len(document_ids) == 0:
            document_info = None
        else:
            document_info = format_document_info(context["documents"], show_images)

        # Format parameter item info if parameter items were provided
        if parameter_item_ids is None or len(parameter_item_ids) == 0:
            parameter_item_info = None
        else:
            parameter_item_info = format_parameter_item_info(context["parameter_items"])

        # Create scenario generation tools
        scenario_tools = create_scenario_tools(group_id, objectives_enabled=objectives_enabled)
        # Add debug_info tool from utils
        scenario_tools.append(debug_info_tool)
        logger.info(
            f"Created {len(scenario_tools)} scenario tools (including debug_info)"
        )

        # Create tool use behavior to check when all required tools are called
        def tool_use_behavior(
            context: Any, tool_results: list[Any]
        ) -> ToolsToFinalOutputResult:
            # Required tools: title_description and optionally objectives (debug_info is optional)
            required_tools = ["title_description"]
            if objectives_enabled:
                required_tools.append("objectives")

            # Check if all required tools have been called
            completed_required = all(
                scenario_progress.get(tool, False) for tool in required_tools
            )

            logger.info(
                f"Tool use check: required={required_tools}, completed={completed_required}, progress={scenario_progress}"
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
        if user_instructions and user_instructions.strip():
            user_instructions_item: TResponseInputItem = {
                "role": "user",
                "content": f"User instructions for scenario generation: {user_instructions.strip()}",
            }
            input_items.insert(0, user_instructions_item)
            logger.info(f"Added user instructions: {user_instructions[:100]}...")
        
        clean_input_items = [item for item in input_items if item is not None]
        # logger.info(f"Input items: {clean_input_items}")

        # generate a trace id for the scenario
        trace_id = gen_trace_id()

        # Use default guest profile from context if no profile_id provided
        final_profile_id = (
            profile_id if profile_id else context["default_guest_profile_id"]
        )

        # Check rate limit (already included in context query - uses default guest profile)
        profile_id_uuid = final_profile_id if final_profile_id else None
        if not profile_id_uuid:
            raise ValueError("Profile not found. Please contact support.")
        
        # Use rate limit from context (for default guest profile)
        # Note: If a specific profile_id is provided, we'd need a separate check, but typically scenario generation uses guest profile
        req_per_day = context["req_per_day"]
        runs_today_count = context["runs_today_count"]
        
        if req_per_day is not None and runs_today_count >= req_per_day:
            # Rate limit exceeded - format error message
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

        with trace("Scenario Agent", group_id=str(group_id), trace_id=trace_id):
            result = await Runner.run(
                agent_instance,
                input=clean_input_items,
                context=DebugContext(conn=conn, model_run_id=model_run_id),
            )

        # Extract results from the global storage
        scenario_result = scenario_results

        # Debug info is automatically handled by debug_info_tool via DebugContext
        # No need for manual debug info storage

        logger.info("Scenario generation completed successfully")
        logger.info(f"Title: {scenario_result.get('title', 'N/A')}")
        logger.info(
            f"Description: {scenario_result.get('description', 'N/A')[:100]}..."
        )
        # Return empty objectives if disabled, otherwise get from results
        objectives = [] if not objectives_enabled else scenario_result.get('objectives', [])
        logger.info(f"Objectives: {objectives}")

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
        # Objectives already set above based on objectives_enabled flag

        return title, description, objectives, trace_id

    except Exception as e:
        logger.error(f"Error in run_scenario_agent: {str(e)}", exc_info=True)
        raise
