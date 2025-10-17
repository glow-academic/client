import logging
import uuid
from datetime import datetime, timezone
from typing import Any, List, Tuple

import asyncpg  # type: ignore
from agents import (Runner, ToolsToFinalOutputResult, function_tool,
                    gen_trace_id, trace)
from agents.items import TResponseInputItem
from app.agents.generic import GenericAgent
from app.db import get_db
from app.services.agent_service import AgentService
from app.services.model_run_service import ModelRunService
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.document import format_document_info
from app.utils.limit import check_rate_limit
from app.utils.personas import format_persona_info
from app.utils.scenario import format_parameter_item_info
from fastapi import Depends
from pydantic import Field

logger = logging.getLogger(__name__)

# Global storage for scenario generation results
scenario_results: dict[str, Any] = {}
scenario_progress: dict[str, bool] = {}


def create_title_description_function(group_id: uuid.UUID | None) -> Any:
    """Create a function tool for setting scenario title and description."""
    
    async def set_title_and_description(
        title: str = Field(description="Short, descriptive title for the scenario (5-10 words)"),
        scenario: str = Field(description="Scenario description (1-2 sentences) that subtly demonstrates the persona without naming it")
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
        return f"Set title and description successfully"
    
    return function_tool(set_title_and_description)


def create_objectives_function(group_id: uuid.UUID | None) -> Any:
    """Create a function tool for setting scenario learning objectives."""
    
    async def set_objectives(
        objectives: List[str] = Field(
            description="List of 2-4 specific learning objectives that GTAs should achieve in this scenario"
        )
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
        - "Guide the student toward self-discovery rather than providing direct answers"
        
        Args:
            objectives: List of 2-4 learning objectives
            
        Returns:
            Confirmation message
        """
        if len(objectives) < 2 or len(objectives) > 4:
            logger.warning(f"Objectives count ({len(objectives)}) outside recommended range of 2-4")
        
        scenario_results["objectives"] = objectives
        scenario_progress["objectives"] = True
        
        logger.info(f"✓ Set {len(objectives)} objectives: {objectives}")
        return f"Set {len(objectives)} learning objectives successfully"
    
    return function_tool(set_objectives)


def create_scenario_tools(group_id: uuid.UUID | None) -> list[Any]:
    """Create all scenario generation function tools."""
    tools = []
    
    # Add title and description tool
    tools.append(create_title_description_function(group_id))
    logger.info("Created title and description tool")
    
    # Add objectives tool
    tools.append(create_objectives_function(group_id))
    logger.info("Created objectives tool")
    
    logger.info(f"Total scenario tools created: {len(tools)}")
    return tools


async def run_scenario_agent(
    department_id: uuid.UUID,
    persona_id: uuid.UUID | None = None,
    document_ids: List[uuid.UUID] | None = None,
    parameter_item_ids: List[uuid.UUID] | None = None,
    group_id: uuid.UUID | None = None,
    conn: asyncpg.Connection = Depends(get_db),
    profile_id: uuid.UUID | None = None,
    sio_instance: Any = None,
) -> Tuple[str, str, List[str], str]:
    """
    This function is used to run the scenario agent.

    Args:
        persona_id: The ID of the persona
        document_ids: The IDs of the documents
        parameter_item_ids: The IDs of the parameter items
        group_id: The ID of the group
        conn: The database connection (asyncpg.Connection)
        profile_id: The ID of the profile (optional)
        sio_instance: Optional Socket.IO instance for progress events
    Returns:
        A tuple of (title, description, objectives, trace_id).
    """
    try:
        # Clear previous results
        global scenario_results, scenario_progress
        scenario_results.clear()
        scenario_progress.clear()

        # Get all context data in a single optimized query via service layer
        agent_service = AgentService(conn)
        context = await agent_service.get_scenario_run_context(
            department_id=department_id,
            persona_id=persona_id,
            document_ids=document_ids,
            parameter_item_ids=parameter_item_ids,
        )

        # Format persona info if persona was provided
        if persona_id is None or context['persona'] is None:
            persona_info = None
            show_images = False
        else:
            persona_info = format_persona_info(context['persona'])
            # Note: image_input_active moved to simulation level
            # For scenario generation, default to False
            show_images = False

        # Format document info if documents were provided
        if document_ids is None or len(document_ids) == 0:
            document_info = None
        else:
            document_info = format_document_info(context['documents'], show_images)

        # Format parameter item info if parameter items were provided
        if parameter_item_ids is None or len(parameter_item_ids) == 0:
            parameter_item_info = None
        else:
            parameter_item_info = format_parameter_item_info(context['parameter_items'])

        # Create scenario generation tools
        scenario_tools = create_scenario_tools(group_id)
        # Add debug_info tool from utils
        scenario_tools.append(debug_info_tool)
        logger.info(f"Created {len(scenario_tools)} scenario tools (including debug_info)")

        # Create tool use behavior to check when all required tools are called
        def tool_use_behavior(
            context: Any, tool_results: list[Any]
        ) -> ToolsToFinalOutputResult:
            # Required tools: title_description and objectives (debug_info is optional)
            required_tools = ["title_description", "objectives"]
            
            # Check if all required tools have been called
            completed_required = all(
                scenario_progress.get(tool, False) for tool in required_tools
            )
            
            logger.info(
                f"Tool use check: required={required_tools}, completed={completed_required}, progress={scenario_progress}"
            )
            return ToolsToFinalOutputResult(is_final_output=completed_required)

        scenario_agent_generic = GenericAgent(
            agent_name=context['agent_name'],
            system_prompt=context['system_prompt'],
            temperature=context['temperature'],
            model_name=context['model_name'],
            model_provider=context['provider_name'],
            base_url=context['base_url'],
            api_key=context['api_key'],
            reasoning=context['reasoning'],
            tools=scenario_tools,
            parallel_tool_calls=False,
            tool_use_behavior=tool_use_behavior,
            custom_model=context['custom_model'],
        )

        agent_instance = scenario_agent_generic.agent()

        input_items: list[TResponseInputItem | None] = [
            persona_info,
            document_info,
            parameter_item_info,
        ]
        clean_input_items = [item for item in input_items if item is not None]
        logger.info(f"Input items: {clean_input_items}")

        # generate a trace id for the scenario
        trace_id = gen_trace_id()

        # Use default guest profile from context if no profile_id provided
        final_profile_id = profile_id if profile_id else context['default_guest_profile_id']

        success, error_message = await check_rate_limit(conn, final_profile_id)
        if not success:
            raise ValueError(error_message)

        # Create model run with all junction records
        model_run_service = ModelRunService(conn)
        model_run_id = await model_run_service.create_model_run(
            department_id=department_id,
            model_id=context['model_id'],
            entity_id=context['agent_id'],
            entity_type="agent",
            profile_id=final_profile_id,
        )

        with trace("Scenario Agent", group_id=str(group_id), trace_id=trace_id):
            result = await Runner.run(agent_instance, input=clean_input_items, context=DebugContext(conn=conn, model_run_id=model_run_id))

        # Extract results from the global storage
        scenario_result = scenario_results

        # Debug info is automatically handled by debug_info_tool via DebugContext
        # No need for manual debug info storage

        logger.info("Scenario generation completed successfully")
        logger.info(f"Title: {scenario_result.get('title', 'N/A')}")
        logger.info(f"Description: {scenario_result.get('description', 'N/A')[:100]}...")
        logger.info(f"Objectives: {scenario_result.get('objectives', [])}")

        usage = result.context_wrapper.usage

        # Update model run with token usage
        await model_run_service.update_model_run_tokens(
            model_run_id=model_run_id,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
        )

        # Get result values
        title = scenario_result.get("title", "")
        description = scenario_result.get("description", "")
        objectives = scenario_result.get("objectives", [])
        
        return title, description, objectives, trace_id

    except Exception as e:
        logger.error(f"Error in run_scenario_agent: {str(e)}", exc_info=True)
        raise
