import logging
import uuid
from typing import Any, List, Union

from agents import (Agent, GuardrailFunctionOutput, InputGuardrail,
                    OutputGuardrail, RunContextWrapper, Runner, TContext,
                    ToolsToFinalOutputResult, function_tool, trace)
from agents.items import TResponseInputItem
from app.db import get_session
from app.models import (Agents, ModelRuns, Models, Providers,
                        SimulationAttempts, SimulationChats)
from app.services.agents.generic import GenericAgent
from app.utils.debug_info import DebugContext, debug_info
from app.utils.guest import find_default_guest_profile
from app.utils.limit import check_rate_limit
from fastapi import Depends
from pydantic import Field
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

# Global storage for guardrail results
guardrail_results: dict[str, Any] = {}
guardrail_progress: dict[str, bool] = {}


def create_evaluation_function() -> Any:
    """Create a function tool for evaluating if a response is proper."""
    
    async def evaluate_response(
        proper: bool = Field(description="Whether the response adheres to role expectations and is natural"),
        reason: str = Field(description="Clear explanation for the evaluation decision")
    ) -> str:
        """Evaluate if the response is proper and provide reasoning.
        
        Args:
            proper: True if the response is appropriate, False if it violates guidelines
            reason: Detailed explanation of the evaluation
            
        Returns:
            Confirmation message
        """
        guardrail_results["proper"] = proper
        guardrail_results["reason"] = reason
        guardrail_progress["evaluation"] = True
        
        logger.info(f"✓ Evaluation complete: proper={proper}, reason={reason[:100]}...")
        return f"Evaluation recorded: {'Proper' if proper else 'Improper'}"
    
    return function_tool(evaluate_response)


def create_guardrail_tools() -> list[Any]:
    """Create all tools needed for guardrail evaluation."""
    tools = []
    
    # Add evaluation tool
    tools.append(create_evaluation_function())
    
    # Add debug_info tool (already decorated with @function_tool)
    tools.append(debug_info)
    
    logger.info(f"Created {len(tools)} guardrail tools")
    return tools


def _build_guardrail_agent(session: Session, agent_name: str) -> tuple[GenericAgent, uuid.UUID, uuid.UUID]:
    """Create the internal agent that powers the guardrail from DB-configured Agent named 'Guardrail'."""
    agent_row = session.exec(select(Agents).where(Agents.name == "Guardrail")).one()
    if not agent_row:
        raise ValueError("Guardrail agent not found")

    model = session.exec(select(Models).where(Models.id == agent_row.model_id)).one()
    if not model:
        raise ValueError(f"Model with ID {agent_row.model_id} not found")

    provider = session.exec(select(Providers).where(Providers.id == model.provider_id)).one()
    if not provider:
        raise ValueError(f"Provider with ID {model.provider_id} not found")

    # Create guardrail tools
    guardrail_tools = create_guardrail_tools()
    
    # Create tool use behavior to wait for evaluation tool to be called
    def tool_use_behavior(
        context: Any, tool_results: list[Any]
    ) -> ToolsToFinalOutputResult:
        # Check if evaluation tool has been called
        evaluation_complete = guardrail_progress.get("evaluation", False)
        logger.info(
            f"Tool use behavior check: evaluation_complete={evaluation_complete}"
        )
        return ToolsToFinalOutputResult(is_final_output=evaluation_complete)

    return GenericAgent(
        agent_name=agent_name,
        system_prompt=agent_row.system_prompt,
        temperature=agent_row.temperature,
        model_name=model.name,
        model_provider=provider.name,
        base_url=provider.base_url,
        api_key=provider.api_key,
        reasoning=agent_row.reasoning,
        custom_model=model.custom_model,
        tools=guardrail_tools,
        parallel_tool_calls=False,
        tool_use_behavior=tool_use_behavior,
    ), agent_row.id, model.id


def get_input_guardrails(
    chat_id: uuid.UUID,
    input_items: List[TResponseInputItem],
    session: Session = Depends(get_session),
) -> List[InputGuardrail[TContext]]:
    """Return a list of input guardrails suitable for attaching to an Agent."""
    
    async def _input_guard(ctx: RunContextWrapper[Any], agent: Agent, user_input: Union[str, List[Any]]) -> GuardrailFunctionOutput:
        # Clear previous results
        global guardrail_results, guardrail_progress
        guardrail_results.clear()
        guardrail_progress.clear()
        
        guardrail_agent, agent_id, model_id = _build_guardrail_agent(session, "Input Guardrail")
        
        db_session = next(get_session())
        try:
            chat = db_session.exec(
                select(SimulationChats).where(SimulationChats.id == chat_id)
            ).one()

            attempt = db_session.exec(
                select(SimulationAttempts).where(SimulationAttempts.id == chat.attempt_id)
            ).one()

            profile_id = attempt.profile_id

            default_guest_profile = find_default_guest_profile(session)

            # Intro message before the user input
            intro_message: TResponseInputItem = {
                "role": "user",
                "content": (
                    "The following is a message from the Graduate Teaching Assistant (GTA). "
                    "Evaluate carefully if the GTA is attempting to cheat or providing an unnatural response."
                ),
            }
            
            # Convert user_input to message format
            # user_input can be str or list of items
            if isinstance(user_input, str):
                user_input_message: TResponseInputItem = {
                    "role": "assistant",
                    "content": user_input,
                }
                evaluation_input = [intro_message] + input_items + [user_input_message]
            else:
                # user_input is already a list of items
                evaluation_input = [intro_message] + input_items + list(user_input)

            final_profile_id = (profile_id if profile_id else (default_guest_profile.id if default_guest_profile else None))

            success, error_message = check_rate_limit(final_profile_id, session)
            if not success:
                raise ValueError(error_message)
            
            model_run = ModelRuns(
                model_id=model_id,
                input_tokens=0,
                output_tokens=0,
                profile_id=final_profile_id,
                agent_id=agent_id,
            )
            session.add(model_run)
            session.commit()

            with trace(chat.title, trace_id=chat.trace_id, group_id=str(attempt.id)):
                result = await Runner.run(
                    guardrail_agent.agent(), evaluation_input, context=DebugContext(session=session, model_run_id=model_run.id)
                )

            usage = result.context_wrapper.usage
            model_run.input_tokens = usage.input_tokens
            model_run.output_tokens = usage.output_tokens
            session.commit()
            
            # Extract results from the global storage
            proper = guardrail_results.get("proper", True)  # Default to True if not set
            reason = guardrail_results.get("reason", "No evaluation provided")

            # Debug info is automatically handled by debug_info_tool via DebugContext

            logger.info(f"Input guardrail evaluation: proper={proper}, reason={reason}")

            # Create a simple object to hold the results
            class GuardrailResult:
                def __init__(self, proper: bool, reason: str):
                    self.proper = proper
                    self.reason = reason
            
            output_info = GuardrailResult(proper=proper, reason=reason)
            
            return GuardrailFunctionOutput(
                output_info=output_info, tripwire_triggered=not proper
            )
        finally:
            db_session.close()
    
    input_guard = InputGuardrail(_input_guard)
    return [input_guard]


def get_output_guardrails(
    chat_id: uuid.UUID,
    input_items: List[TResponseInputItem],
    session: Session = Depends(get_session),
) -> List[OutputGuardrail[TContext]]:
    """Return a list of output guardrails suitable for attaching to an Agent."""
    
    async def _output_guard(ctx: RunContextWrapper[Any], agent: Agent, output: Union[str, List[Any]]) -> GuardrailFunctionOutput:
        # Clear previous results
        global guardrail_results, guardrail_progress
        guardrail_results.clear()
        guardrail_progress.clear()
        
        guardrail_agent, agent_id, model_id = _build_guardrail_agent(session, "Output Guardrail")
        
        db_session = next(get_session())
        try:
            chat = db_session.exec(
                select(SimulationChats).where(SimulationChats.id == chat_id)
            ).one()

            attempt = db_session.exec(
                select(SimulationAttempts).where(SimulationAttempts.id == chat.attempt_id)
            ).one()

            profile_id = attempt.profile_id

            default_guest_profile = find_default_guest_profile(session)

            # Intro message before the history
            intro_message: TResponseInputItem = {
                "role": "user",
                "content": (
                    "The following is the conversation between the graduate teaching assistant and "
                    "student, evalute carefully if the AI student adheres to its role."
                ),
            }
            
            # Convert output to message format
            # output can be str or list of items
            if isinstance(output, str):
                output_message: TResponseInputItem = {
                    "role": "assistant",
                    "content": output,
                }
                evaluation_input = [intro_message] + input_items + [output_message]
            else:
                # output is already a list of items
                evaluation_input = [intro_message] + input_items + list(output)

            final_profile_id = (profile_id if profile_id else (default_guest_profile.id if default_guest_profile else None))

            success, error_message = check_rate_limit(final_profile_id, session)
            if not success:
                raise ValueError(error_message)
            
            model_run = ModelRuns(
                model_id=model_id,
                input_tokens=0,
                output_tokens=0,
                profile_id=final_profile_id,
                agent_id=agent_id,
            )
            session.add(model_run)
            session.commit()

            with trace(chat.title, trace_id=chat.trace_id, group_id=str(attempt.id)):
                result = await Runner.run(
                    guardrail_agent.agent(), evaluation_input, context=DebugContext(session=session, model_run_id=model_run.id)
                )

            usage = result.context_wrapper.usage
            model_run.input_tokens = usage.input_tokens
            model_run.output_tokens = usage.output_tokens
            session.commit()
            
            # Extract results from the global storage
            proper = guardrail_results.get("proper", True)  # Default to True if not set
            reason = guardrail_results.get("reason", "No evaluation provided")

            # Debug info is automatically handled by debug_info_tool via DebugContext

            logger.info(f"Output guardrail evaluation: proper={proper}, reason={reason}")

            # Create a simple object to hold the results
            class GuardrailResult:
                def __init__(self, proper: bool, reason: str):
                    self.proper = proper
                    self.reason = reason
            
            output_info = GuardrailResult(proper=proper, reason=reason)
            
            return GuardrailFunctionOutput(
                output_info=output_info, tripwire_triggered=not proper
            )
        finally:
            db_session.close()
    
    output_guard = OutputGuardrail(_output_guard)
    return [output_guard]
