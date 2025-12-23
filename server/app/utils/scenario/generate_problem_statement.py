"""Helper function to generate scenario problem statement using scenario agent."""

import json
import uuid
from typing import Any

from agents import (
    FunctionToolResult,
    RunContextWrapper,
    Runner,
    ToolsToFinalOutputResult,
    gen_trace_id,
    trace,
)
from agents.items import TResponseInputItem

from app.main import get_scenario_storage
from app.utils.agents.generic_agent import GenericAgent
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.document.format_document_info import format_document_info
from app.utils.logging.db_logger import get_logger
from app.utils.scenario.image_generation import (
    get_image_generation_results,
    set_image_generation_context,
)
from app.utils.sql_helper import load_sql
from app.utils.storage.request_storage import build_storage_key
from app.utils.tools.build_pydantic_fields import build_function_signature_string
from agents import Tool, function_tool
from pydantic import Field

logger = get_logger(__name__)


async def generate_scenario_problem_statement(
    conn: Any,
    department_id: uuid.UUID,
    agent_id: uuid.UUID,  # Required: agent_id for scenario generation
    persona_id: uuid.UUID | None,
    document_ids: list[uuid.UUID] | None,
    parameter_item_ids: list[uuid.UUID] | None,
    profile_id: uuid.UUID | None,
    objectives_enabled: bool = True,
    images_enabled: bool = False,  # Disabled by default for API endpoints
    group_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    """Generate scenario problem statement using scenario agent.

    Args:
        conn: Database connection
        department_id: Department UUID
        agent_id: Agent UUID (required - UI filters and selects appropriate agent)
        persona_id: Optional persona UUID
        document_ids: Optional list of document UUIDs
        parameter_item_ids: Optional list of parameter item UUIDs
        profile_id: Optional profile UUID for rate limiting
        objectives_enabled: Whether to generate objectives
        group_id: Optional group ID for tracing (defaults to new UUID)

    Returns:
        dict with keys: title (str), description (str), objectives (list[str])
    """
    logger.info(
        f"Generating scenario problem statement with "
        f"department_id={department_id}, agent_id={agent_id}, persona_id={persona_id}, "
        f"document_ids={document_ids}, parameter_item_ids={parameter_item_ids}"
    )

    # Clear previous results (now handled by storage with keys)

    # Get all context data in a single optimized query using SQL file
    if not profile_id:
        raise ValueError("profile_id is required for scenario problem statement generation")
    sql = load_sql("sql/v3/agents/get_scenario_run_context.sql")
    context_row = await conn.fetchrow(
        sql,
        department_id,  # Already a UUID object
        persona_id if persona_id else None,  # Already a UUID object or None
        [str(d) for d in document_ids]
        if document_ids
        else [],  # Convert to string list
        [str(p) for p in parameter_item_ids]
        if parameter_item_ids
        else [],  # Convert to string list
        str(agent_id),  # agent_id (required)
        str(profile_id),  # profile_id (required)
    )

    if not context_row:
        raise ValueError(
            f"Agent {agent_id} not found or not available for department {department_id}"
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
        "provider": context_row["provider"],
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
        persona_data = context["persona"]
        persona_info = {
            "role": "user",
            "content": f"This is the profile of the student: Name: {persona_data['name']} Description: {persona_data.get('description', '')}",
        }
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
        parameter_items = context["parameter_items"]
        if not parameter_items:
            parameter_item_info = {
                "role": "user",
                "content": "No parameter items found.",
            }
        else:
            formatted_items = []
            for row in parameter_items:
                formatted_item = (
                    f"This is the {row['param_name']} ({row.get('param_description', '')}) for this chat: {row['item_name']}. "
                    f"Description: {row.get('item_description', '')}."
                )
                formatted_items.append(formatted_item)

            content = "The following is the parameter item information:\n" + "\n".join(
                formatted_items
            )
            parameter_item_info = {
                "role": "user",
                "content": content,
            }

    # Determine final profile ID early (use provided or default guest)
    final_profile_id: uuid.UUID | None = profile_id
    if not final_profile_id:
        default_guest_id = context.get("default_guest_profile_id")
        if default_guest_id:
            try:
                final_profile_id = uuid.UUID(default_guest_id)
            except (ValueError, TypeError):
                final_profile_id = None

    # Create scenario generation tools
    if group_id is None:
        group_id = uuid.uuid4()

    # Generate trace_id for this operation
    scenario_trace_id = gen_trace_id()
    primary_id = str(group_id)  # Use group_id as primary_id

    # Set image generation context before creating tools (async)
    # Note: No room/sid for API endpoints - images will generate but no WebSocket events
    if images_enabled and final_profile_id:
        await set_image_generation_context(
            agent_id=context["agent_id"],
            profile_id=str(final_profile_id),
            primary_id=primary_id,
            department_id=str(department_id) if department_id else None,
            room=None,  # API endpoint - no WebSocket room
        )

    # Load agent tools from database
    agent_id_uuid = uuid.UUID(context["agent_id"])
    sql_get_agent_tools = load_sql("sql/v3/agents/get_agent_tools.sql")
    rows = await conn.fetch(sql_get_agent_tools, str(agent_id_uuid))
    agent_tools_config = [dict(row) for row in rows]
    tool_config_map: dict[str, dict[str, Any]] = {
        tool_config["name"]: tool_config for tool_config in agent_tools_config
    }

    # Create scenario generation tools inline
    scenario_tools: list[Tool] = []
    
    # 1. Title and Description Tool (always included)
    title_desc_config = tool_config_map.get("set_title_and_description")
    if title_desc_config:
        title_desc = title_desc_config.get("argument_descriptions", {}).get("title", "Short, descriptive title for the scenario (5-10 words)")
        scenario_desc = title_desc_config.get("argument_descriptions", {}).get("scenario", "Scenario description (1-2 sentences) that subtly demonstrates the persona without naming it")
    else:
        title_desc = "Short, descriptive title for the scenario (5-10 words)"
        scenario_desc = "Scenario description (1-2 sentences) that subtly demonstrates the persona without naming it"
    
    async def set_title_description(
        title: str = Field(description=title_desc),
        scenario: str = Field(description=scenario_desc),
    ) -> str:
        """Set the title and description for the scenario."""
        storage = get_scenario_storage()
        storage_key = build_storage_key(
            operation_type="scenario_generation",
            profile_id=str(final_profile_id) if final_profile_id else "",
            primary_id=primary_id,
        )
        await storage.set(storage_key, "title", title)
        await storage.set(storage_key, "description", scenario)
        await storage.set(storage_key, "title_description_progress", True)
        logger.info(f"✓ Set title: {title}")
        return "Set title and description successfully"
    
    scenario_tools.append(function_tool(set_title_description))
    
    # 2. Objectives Tool (if enabled)
    if objectives_enabled:
        objectives_config = tool_config_map.get("set_objectives")
        if objectives_config:
            objectives_desc = objectives_config.get("argument_descriptions", {}).get("objectives", "List of 1-3 specific learning objectives that GTAs should achieve in this scenario")
        else:
            objectives_desc = "List of 1-3 specific learning objectives that GTAs should achieve in this scenario"
        
        async def set_objectives(
            objectives: list[str] = Field(description=objectives_desc),
        ) -> str:
            """Set the learning objectives for this scenario."""
            objectives = objectives[:3]  # Limit to 3
            storage = get_scenario_storage()
            storage_key = build_storage_key(
                operation_type="scenario_generation",
                profile_id=str(final_profile_id) if final_profile_id else "",
                primary_id=primary_id,
            )
            await storage.set(storage_key, "objectives", objectives)
            await storage.set(storage_key, "objectives_progress", True)
            logger.info(f"✓ Set {len(objectives)} objectives")
            return f"Set {len(objectives)} learning objectives successfully"
        
        scenario_tools.append(function_tool(set_objectives))
    
    # 3. Image Generation Tool (if enabled)
    if images_enabled:
        image_config = tool_config_map.get("generate_image")
        if image_config:
            name_desc = image_config.get("argument_descriptions", {}).get("name", "Descriptive name for the generated image")
            prompt_desc = image_config.get("argument_descriptions", {}).get("prompt", "Detailed, descriptive prompt for image generation")
        else:
            name_desc = "Descriptive name for the generated image"
            prompt_desc = "Detailed, descriptive prompt for image generation"
        
        async def generate_image(
            name: str = Field(description=name_desc),
            prompt: str = Field(description=prompt_desc),
        ) -> str:
            """Generate an image from a detailed prompt."""
            # For API endpoints, image generation happens via storage context
            storage = get_scenario_storage()
            storage_key = build_storage_key(
                operation_type="image_generation",
                profile_id=str(final_profile_id) if final_profile_id else "",
                primary_id=primary_id,
            )
            # Store image generation request
            await storage.set(storage_key, f"image_{name}", prompt)
            logger.info(f"✓ Queued image generation: {name}")
            return f"Image generation queued for '{name}'"
        
        scenario_tools.append(function_tool(generate_image))
    
    scenario_tools.append(debug_info_tool)
    logger.info(f"Created {len(scenario_tools)} scenario tools (including debug_info)")

    # Create tool use behavior to check when all required tools are called
    def tool_use_behavior(
        tool_context: RunContextWrapper[Any],
        tool_results: list[FunctionToolResult],
    ) -> ToolsToFinalOutputResult:
        required_tools = ["title_description"]
        if objectives_enabled:
            required_tools.append("objectives")

        # Note: Progress checking happens synchronously, but storage is async
        # For now, we'll check progress after tool execution completes
        # This is a limitation of the current tool_use_behavior pattern
        # TODO: Consider making tool_use_behavior async or using a different pattern
        completed_required = True  # Will be checked after execution

        logger.info(
            f"Tool use check: required={required_tools}, completed={completed_required}"
        )
        return ToolsToFinalOutputResult(is_final_output=completed_required)

    scenario_agent_generic = GenericAgent(
        agent_name=context["agent_name"],
        system_prompt=context["system_prompt"],
        temperature=context["temperature"],
        model_name=context["model_name"],
        provider=context["provider"],
        base_url=context["base_url"],
        api_key=context["api_key"],
        reasoning=context["reasoning"],
        tools=scenario_tools,
        parallel_tool_calls=False,
        tool_use_behavior=tool_use_behavior,
    )

    agent_instance = scenario_agent_generic.agent()

    input_items: list[TResponseInputItem | None] = [
        persona_info,
        document_info,
        parameter_item_info,
    ]

    clean_input_items = [item for item in input_items if item is not None]

    # Generate a trace id for the scenario
    scenario_trace_id = gen_trace_id()

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
        department_id,  # Already a UUID object
        uuid.UUID(context["model_id"]),
        uuid.UUID(context["agent_id"]),
        "agent",
        final_profile_id,  # Already a UUID object or None
        None,  # key_id
        context["agent_id"],  # agent_id (as string)
    )
    model_run_id = uuid.UUID(model_run_row["run_id"])

    with trace(
        "Scenario Agent",
        group_id=str(group_id),
        trace_id=scenario_trace_id,
    ):
        result = await Runner.run(
            agent_instance,
            input=clean_input_items,
            context=DebugContext(conn=conn, run_id=model_run_id),
        )

    # Extract results from request-scoped storage
    storage = get_scenario_storage()
    storage_key = build_storage_key(
        operation_type="scenario_generation",
        profile_id=str(final_profile_id),
        primary_id=primary_id,
    )
    scenario_result = await storage.get_all(storage_key)

    logger.info("Scenario generation completed successfully")
    logger.info(f"Title: {scenario_result.get('title', 'N/A')}")
    logger.info(f"Description: {scenario_result.get('description', 'N/A')[:100]}...")
    objectives = scenario_result.get("objectives", []) if objectives_enabled else []
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

    # Get result values (ensure non-None values)
    title = scenario_result.get("title") or ""
    description = scenario_result.get("description") or ""

    logger.info(
        f"Scenario generation completed: title={title}, "
        f"description length={len(description)}, objectives count={len(objectives)}"
    )

    # Retrieve image_ids from storage (images are generated in background via WebSocket)
    generated_image_ids: list[str] = []
    if final_profile_id:
        image_results = await get_image_generation_results(
            profile_id=str(final_profile_id),
            primary_id=primary_id,
        )
        # image_results["images"] contains list of image_ids (strings)
        image_ids = image_results.get("images", [])
        if image_ids:
            generated_image_ids = image_ids
            logger.info(
                f"Retrieved {len(generated_image_ids)} image IDs from storage "
                f"(generation in progress in background)"
            )
            # Don't clear storage - background tasks will clean up individual image contexts

    return {
        "title": title,
        "description": description,
        "objectives": objectives,
        "generated_image_ids": generated_image_ids if generated_image_ids else None,
    }
