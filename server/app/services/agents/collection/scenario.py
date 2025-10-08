import logging
import uuid
from typing import Any, List, Tuple

from agents import (Runner, ToolsToFinalOutputResult, function_tool,
                    gen_trace_id, trace)
from agents.items import TResponseInputItem
from app.db import get_session
from app.models import Agents, ModelRuns, Models, Personas, Providers
from app.services.agents.generic import GenericAgent
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.document import get_document_info
from app.utils.guest import find_default_guest_profile
from app.utils.limit import check_rate_limit
from app.utils.personas import get_persona_info
from app.utils.scenario import get_parameter_item_info
from fastapi import Depends
from pydantic import Field
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

# Global storage for scenario generation results
scenario_results: dict[str, Any] = {}
scenario_progress: dict[str, bool] = {}

# Socket.IO instance for progress emissions (set per scenario generation run)
_scenario_sio_instance: Any = None
_scenario_group_id: uuid.UUID | None = None


async def _emit_scenario_progress(event_data: dict[str, Any]) -> None:
    """Helper to emit scenario generation progress via Socket.IO if available."""
    global _scenario_sio_instance, _scenario_group_id
    
    if _scenario_sio_instance and _scenario_group_id:
        try:
            await _scenario_sio_instance.emit(
                "scenario_generation_progress",
                event_data,
                room=f"scenario_generation_{_scenario_group_id}",
            )
            logger.info(f"Emitted scenario generation progress: {event_data.get('type')}")
        except Exception as e:
            logger.warning(f"Failed to emit scenario generation progress: {e}")


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
        
        # Emit progress event
        await _emit_scenario_progress({
            "type": "title_description_set",
            "group_id": str(group_id) if group_id else None,
            "message": "Title and description generated",
            "title": title,
            "description_preview": scenario[:100] + "..." if len(scenario) > 100 else scenario,
        })
        
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
        
        # Emit progress event
        await _emit_scenario_progress({
            "type": "objectives_set",
            "group_id": str(group_id) if group_id else None,
            "message": f"Generated {len(objectives)} learning objectives",
            "objectives_count": len(objectives),
            "objectives": objectives,
        })
        
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
    session: Session = Depends(get_session),
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
        session: The database session
        profile_id: The ID of the profile (optional)
        sio_instance: Optional Socket.IO instance for progress events
    Returns:
        A tuple of (title, description, objectives, trace_id).
    """
    try:
        # Clear previous results and set up socket context
        global scenario_results, scenario_progress, _scenario_sio_instance, _scenario_group_id
        scenario_results.clear()
        scenario_progress.clear()
        _scenario_sio_instance = sio_instance
        _scenario_group_id = group_id

        # Get the agent to get its name for the agent
        if persona_id is None:
            persona_info = None
            show_images = False
        else:
            persona = session.exec(
                select(Personas).where(Personas.id == persona_id)
            ).one_or_none()
            if not persona:
                raise ValueError(f"Persona with ID {persona_id} not found")
            persona_info = get_persona_info(persona.id, session)
            show_images = persona.image_input_active

        if document_ids is None or len(document_ids) == 0:
            document_info = None
        else:
            document_info = get_document_info(document_ids, show_images, session)

        if parameter_item_ids is None or len(parameter_item_ids) == 0:
            parameter_item_info = None
        else:
            parameter_item_info = get_parameter_item_info(parameter_item_ids, session)

        # find agent with name of "Scenario"
        scenario_agent = session.exec(select(Agents).where(Agents.name == "Scenario")).one()
        if not scenario_agent:
            raise ValueError("Scenario agent not found")

        # getting the model from the agent's model_id
        model = session.exec(
            select(Models).where(Models.id == scenario_agent.model_id)
        ).one()
        if not model:
            raise ValueError(f"Model with ID {scenario_agent.model_id} not found")

        # getting the provider from the model's provider_id
        provider = session.exec(
            select(Providers).where(Providers.id == model.provider_id)
        ).one()
        if not provider:
            raise ValueError(f"Provider with ID {model.provider_id} not found")

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
            agent_name=scenario_agent.name,
            system_prompt=scenario_agent.system_prompt,
            temperature=scenario_agent.temperature,
            model_name=model.name,
            model_provider=provider.name,
            base_url=provider.base_url,
            api_key=provider.api_key,
            reasoning=scenario_agent.reasoning,
            tools=scenario_tools,
            parallel_tool_calls=False,
            tool_use_behavior=tool_use_behavior,
            custom_model=model.custom_model,
        )

        agent_instance = scenario_agent_generic.agent()

        input_items: list[TResponseInputItem | None] = [
            persona_info,
            document_info,
            parameter_item_info,
        ]
        clean_input_items = [item for item in input_items if item is not None]
        logger.info(f"Input items: {clean_input_items}")

        # Emit scenario generation start event
        if sio_instance:
            await sio_instance.emit(
                "scenario_generation_progress",
                {
                    "type": "start",
                    "group_id": str(group_id) if group_id else None,
                    "message": "Starting scenario generation",
                    "has_persona": persona_id is not None,
                    "document_count": len(document_ids) if document_ids else 0,
                    "parameter_count": len(parameter_item_ids) if parameter_item_ids else 0,
                },
                room=f"scenario_generation_{group_id}",
            )
            logger.info(f"Emitted scenario generation start event for group {group_id}")

        # generate a trace id for the scenario
        trace_id = gen_trace_id()

        default_guest_profile = find_default_guest_profile(session)

        final_profile_id = (profile_id if profile_id else (default_guest_profile.id if default_guest_profile else None))

        success, error_message = check_rate_limit(final_profile_id, session)
        if not success:
            raise ValueError(error_message)

        # create model run
        model_run = ModelRuns(
            model_id=model.id,
            input_tokens=0,
            output_tokens=0,
            profile_id=final_profile_id,
            agent_id=scenario_agent.id,
            department_id=department_id,
        )
        session.add(model_run)
        session.commit()

        with trace("Scenario Agent", group_id=str(group_id), trace_id=trace_id):
            result = await Runner.run(agent_instance, input=clean_input_items, context=DebugContext(session=session, model_run_id=model_run.id))

        # Extract results from the global storage
        scenario_result = scenario_results

        # Debug info is automatically handled by debug_info_tool via DebugContext
        # No need for manual debug info storage

        logger.info("Scenario generation completed successfully")
        logger.info(f"Title: {scenario_result.get('title', 'N/A')}")
        logger.info(f"Description: {scenario_result.get('description', 'N/A')[:100]}...")
        logger.info(f"Objectives: {scenario_result.get('objectives', [])}")

        usage = result.context_wrapper.usage

        model_run.input_tokens = usage.input_tokens
        model_run.output_tokens = usage.output_tokens
        session.commit()

        # Get result values
        title = scenario_result.get("title", "")
        description = scenario_result.get("description", "")
        objectives = scenario_result.get("objectives", [])

        # Emit scenario generation completion event
        if sio_instance:
            await sio_instance.emit(
                "scenario_generation_progress",
                {
                    "type": "complete",
                    "group_id": str(group_id) if group_id else None,
                    "message": "Scenario generation completed successfully",
                    "title": title,
                    "description": description,
                    "objectives": objectives,
                    "trace_id": trace_id,
                },
                room=f"scenario_generation_{group_id}",
            )
            logger.info(f"Emitted scenario generation completion event for group {group_id}")

        # Clean up socket context (global already declared at top of try block)
        _scenario_sio_instance = None
        _scenario_group_id = None
        
        return title, description, objectives, trace_id

    except Exception as e:
        logger.error(f"Error in run_scenario_agent: {str(e)}", exc_info=True)
        
        # Emit error event
        if sio_instance:
            try:
                await sio_instance.emit(
                    "scenario_generation_progress",
                    {
                        "type": "error",
                        "group_id": str(group_id) if group_id else None,
                        "message": f"Scenario generation failed: {str(e)}",
                        "error": str(e),
                    },
                    room=f"scenario_generation_{group_id}",
                )
            except Exception as emit_error:
                logger.warning(f"Failed to emit error event: {emit_error}")
        
        # Clean up socket context (global already declared at top of try block)
        _scenario_sio_instance = None
        _scenario_group_id = None
        
        raise
