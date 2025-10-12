import logging
import uuid
from typing import Any, List

from agents import Runner, Tool, ToolsToFinalOutputResult, function_tool, trace
from agents.items import TResponseInputItem
from app.db import get_session
from app.models import (Agents, ModelRuns, Models, Providers, Scenarios,
                        SimulationAttempts, SimulationChats, SimulationHints,
                        SimulationMessages)
from app.services.agents.generic import GenericAgent
from app.utils.chat import (get_chat_scenario,
                            get_simulation_conversation_history)
from app.utils.debug_info import DebugContext, debug_info
from app.utils.document import get_document_info
from app.utils.guest import find_default_guest_profile
from app.utils.limit import check_rate_limit
from fastapi import Depends
from pydantic import Field
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

# Global storage for hint results
hint_results: dict[str, Any] = {}
hint_progress: dict[str, bool] = {}

# Context for socket routing
_hint_sio_instance: Any = None
_hint_chat_id: uuid.UUID | None = None


async def _emit_hint_progress(event_data: dict[str, Any]) -> None:
    """Helper to emit hint generation progress via Socket.IO if available."""
    global _hint_sio_instance, _hint_chat_id
    
    if _hint_sio_instance and _hint_chat_id:
        try:
            await _hint_sio_instance.emit(
                "hint_generation_progress",
                event_data,
                room=f"simulation_{_hint_chat_id}",
            )
        except Exception as e:
            logger.warning(f"Failed to emit hint progress: {e}")


def create_hint_function(hint_number: int) -> Tool:
    """Create a function tool for providing a specific hint."""
    
    async def provide_hint(
        hint: str = Field(
            description=(
                f"A concise, practical teaching strategy or communication tip for the GTA. "
                f"This is hint #{hint_number} of 3 required hints. "
                f"Make it distinct from the other hints and focused on a different aspect "
                f"of helping the student (e.g., content explanation, emotional support, pedagogical approach)."
            )
        )
    ) -> str:
        """Provide a strategic hint for the GTA.
        
        This hint should help the GTA better address the student's needs or communication style.
        Focus on teaching strategies, clarification techniques, empathy, or encouragement.
        Each hint should cover a different aspect of the interaction.
        
        Args:
            hint: Practical, actionable hint for the GTA (distinct from other hints)
            
        Returns:
            Confirmation message indicating the hint was recorded
        """
        hint_results[f"hint_{hint_number}"] = hint
        hint_progress[f"hint_{hint_number}"] = True
        
        logger.info(f"✓ Hint {hint_number} recorded: {hint[:80]}...")
        return f"Hint {hint_number} recorded successfully. Continue until all 3 hints are provided."
    
    # Set unique function name
    provide_hint.__name__ = f"provide_hint_{hint_number}"
    return function_tool(provide_hint)


def create_hint_tools() -> list[Tool]:
    """Create all tools needed for hint generation."""
    tools = []
    
    # Create three separate hint tools
    for i in range(1, 4):  # 1, 2, 3
        tools.append(create_hint_function(i))
    
    # Add debug_info tool
    tools.append(debug_info)
    
    logger.info(f"Created {len(tools)} hint tools (3 hints + debug_info)")
    return tools


def _build_hint_agent(session: Session, department_id: uuid.UUID) -> tuple[GenericAgent, uuid.UUID, uuid.UUID]:
    """Create the hint generation agent from the department's configured hint agent."""
    
    # Get the hint agent configured for this department (via junction table)
    from app.utils.agents import get_department_agent
    agent_row = get_department_agent(session, department_id, 'hint')

    model = session.exec(select(Models).where(Models.id == agent_row.model_id)).one()
    if not model:
        raise ValueError(f"Model with ID {agent_row.model_id} not found")

    provider = session.exec(
        select(Providers).where(Providers.id == model.provider_id)
    ).one()
    if not provider:
        raise ValueError(f"Provider with ID {model.provider_id} not found")

    # Create hint tools
    hint_tools = create_hint_tools()
    
    # Create tool use behavior - require all 3 hint tools to be called
    def tool_use_behavior(
        context: Any, tool_results: list[Any]
    ) -> ToolsToFinalOutputResult:
        # Check if all three hint tools have been called
        hint_1_complete = hint_progress.get("hint_1", False)
        hint_2_complete = hint_progress.get("hint_2", False)
        hint_3_complete = hint_progress.get("hint_3", False)
        
        all_hints_complete = hint_1_complete and hint_2_complete and hint_3_complete
        
        logger.info(
            f"Tool use behavior check: hint_1={hint_1_complete}, "
            f"hint_2={hint_2_complete}, hint_3={hint_3_complete}, "
            f"all_complete={all_hints_complete}, "
            f"tool_results_count={len(tool_results)}"
        )
        
        # Return False to continue until all 3 hints are provided
        return ToolsToFinalOutputResult(is_final_output=all_hints_complete)

    return GenericAgent(
        agent_name=agent_row.name,
        system_prompt=agent_row.system_prompt,
        temperature=agent_row.temperature,
        model_name=model.name,
        model_provider=provider.name,
        base_url=provider.base_url,
        api_key=provider.api_key,
        reasoning=agent_row.reasoning,
        custom_model=model.custom_model,
        tools=hint_tools,
        parallel_tool_calls=True,  # Enable parallel execution
        tool_use_behavior=tool_use_behavior,
    ), agent_row.id, model.id


async def run_hint_agent(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    department_id: uuid.UUID,
    session: Session = Depends(get_session),
    sio_instance: Any = None,
) -> List[uuid.UUID]:
    """
    Generate 3 helpful hints for a GTA based on simulation conversation history.
    
    Args:
        chat_id: The ID of the simulation chat
        message_id: The ID of the specific message to generate hints for
        session: Database session
        
    Returns:
        List of SimulationHints IDs (up to 3)
    """
    try:
        # Clear previous results and set up socket context
        global hint_results, hint_progress, _hint_sio_instance, _hint_chat_id
        hint_results.clear()
        hint_progress.clear()
        _hint_sio_instance = sio_instance
        _hint_chat_id = chat_id
        
        # Get the simulation message
        message = session.exec(
            select(SimulationMessages).where(SimulationMessages.id == message_id)
        ).one()
        
        # Get the chat
        chat = session.exec(
            select(SimulationChats).where(SimulationChats.id == chat_id)
        ).one()
        
        # Get the attempt
        attempt = session.exec(
            select(SimulationAttempts).where(SimulationAttempts.id == chat.attempt_id)
        ).one()
        
        # Get the scenario
        scenario = session.exec(
            select(Scenarios).where(Scenarios.id == chat.scenario_id)
        ).one()
        
        logger.info(
            f"Starting hint generation for chat {chat_id}, message {message_id}"
        )
        
        # Emit start event
        await _emit_hint_progress({
            "type": "start",
            "message": "Starting hint generation",
            "chat_id": str(chat_id),
            "message_id": str(message_id),
        })
        
        # Build input items
        input_items: list[TResponseInputItem] = []
        
        # Add document info if available (no images needed for hints)
        # Load document IDs from junction table
        from app.models import t_scenario_documents
        from sqlalchemy import select as sa_select
        
        doc_ids = [row[0] for row in session.execute(
            sa_select(t_scenario_documents.c.document_id)
            .where(t_scenario_documents.c.scenario_id == scenario.id)
        ).fetchall()]
        
        if doc_ids:
            document_info = get_document_info(doc_ids, False, session)
            input_items.append(document_info)
        
        # Get all messages up to and including the target message
        messages = session.exec(
            select(SimulationMessages)
            .where(SimulationMessages.chat_id == chat_id)
            .where(SimulationMessages.created_at <= message.created_at)
        ).all()
        
        # Sort by created_at
        messages = sorted(messages, key=lambda x: x.created_at)
        
        # Build conversation history
        conversation_history = get_simulation_conversation_history(list(messages))
        
        # Add scenario context at the beginning
        chat_scenario = get_chat_scenario(chat, session)
        input_items.insert(0, chat_scenario)
        input_items.extend(conversation_history)
        
        # Get profile for rate limiting
        default_guest_profile = find_default_guest_profile(session)
        final_profile_id = (
            attempt.profile_id 
            if attempt.profile_id 
            else (default_guest_profile.id if default_guest_profile else None)
        )
        
        # Check rate limit
        success, error_message = check_rate_limit(final_profile_id, session)
        if not success:
            raise ValueError(error_message)
        
        # Build hint agent
        hint_agent, agent_id, model_id = _build_hint_agent(session, department_id)
        
        # Create model run
        model_run = ModelRuns(
            model_id=model_id,
            input_tokens=0,
            output_tokens=0,
            profile_id=final_profile_id,
            agent_id=agent_id,
            department_id=department_id,
        )
        session.add(model_run)
        session.commit()
        
        # Run the hint agent
        logger.info("Running hint agent with parallel tool calls...")
        with trace(chat.title, trace_id=chat.trace_id, group_id=str(attempt.id)):
            result = await Runner.run(
                hint_agent.agent(),
                input=input_items,
                context=DebugContext(session=session, model_run_id=model_run.id)
            )
        
        # Update token usage
        usage = result.context_wrapper.usage
        model_run.input_tokens = usage.input_tokens
        model_run.output_tokens = usage.output_tokens
        session.commit()
        
        logger.info("Hint agent completed successfully")
        
        # Extract hints from global storage
        hint_1 = hint_results.get("hint_1", "")
        hint_2 = hint_results.get("hint_2", "")
        hint_3 = hint_results.get("hint_3", "")
        
        # Log what was generated
        hints_generated = sum([bool(hint_1), bool(hint_2), bool(hint_3)])
        logger.info(f"Generated {hints_generated}/3 hints")
        
        if hints_generated < 3:
            logger.warning(
                f"Not all hints were generated for message {message_id}. "
                f"Got: hint_1={bool(hint_1)}, hint_2={bool(hint_2)}, hint_3={bool(hint_3)}"
            )
        
        # Create SimulationHints records
        hint_ids = []
        for i, hint_text in enumerate([hint_1, hint_2, hint_3], 1):
            if hint_text:  # Only save non-empty hints
                hint_record = SimulationHints(
                    hint=hint_text,
                    simulation_message_id=message_id,
                )
                session.add(hint_record)
                session.flush()
                hint_ids.append(hint_record.id)
                logger.info(f"Created hint {i}: {hint_text[:80]}...")
        
        session.commit()
        
        logger.info(
            f"Successfully generated {len(hint_ids)} hints for message {message_id} "
            f"in chat {chat_id}"
        )
        
        # Emit completion event
        await _emit_hint_progress({
            "type": "complete",
            "message": "Hint generation completed successfully",
            "chat_id": str(chat_id),
            "message_id": str(message_id),
            "hint_ids": [str(hid) for hid in hint_ids],
            "hints_count": len(hint_ids),
        })
        
        # Clean up socket context
        _hint_sio_instance = None
        _hint_chat_id = None
        
        return hint_ids
        
    except Exception as e:
        logger.error(f"Error in run_hint_agent: {str(e)}", exc_info=True)
        
        # Emit error event
        if sio_instance:
            try:
                await sio_instance.emit(
                    "hint_generation_progress",
                    {
                        "type": "error",
                        "message": f"Hint generation failed: {str(e)}",
                        "error": str(e),
                        "chat_id": str(chat_id),
                        "message_id": str(message_id),
                    },
                    room=f"simulation_{chat_id}",
                )
            except Exception as emit_error:
                logger.warning(f"Failed to emit error event: {emit_error}")
        
        # Clean up socket context
        _hint_sio_instance = None
        _hint_chat_id = None
        
        session.rollback()
        raise

