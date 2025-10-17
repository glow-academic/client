import logging
import uuid
from typing import Any, List, Union

import asyncpg  # type: ignore
from agents import (Agent, GuardrailFunctionOutput, InputGuardrail,
                    OutputGuardrail, RunContextWrapper, Runner, TContext,
                    ToolsToFinalOutputResult, function_tool, trace)
from agents.items import TResponseInputItem
from app.agents.generic import GenericAgent
from app.db import get_db
from app.services.agent_service import AgentService
from app.services.model_run_service import ModelRunService
from app.utils.debug_info import DebugContext, debug_info
from app.utils.guest import find_default_guest_profile
from app.utils.limit import check_rate_limit
from fastapi import Depends
from pydantic import Field

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


def _build_guardrail_agent(context: dict[str, Any]) -> GenericAgent:
    """Create the internal agent that powers the guardrail from context data.
    
    Args:
        context: Dict containing agent, model, and provider data from service layer
    
    Returns:
        GenericAgent configured for guardrail evaluation
    """
    # Create guardrail tools
    guardrail_tools = create_guardrail_tools()
    
    # Create tool use behavior to wait for evaluation tool to be called
    def tool_use_behavior(
        tool_context: Any, tool_results: list[Any]
    ) -> ToolsToFinalOutputResult:
        # Check if evaluation tool has been called
        evaluation_complete = guardrail_progress.get("evaluation", False)
        logger.info(
            f"Tool use behavior check: evaluation_complete={evaluation_complete}"
        )
        return ToolsToFinalOutputResult(is_final_output=evaluation_complete)

    return GenericAgent(
        agent_name=context['agent_name'],
        system_prompt=context['system_prompt'],
        temperature=context['temperature'],
        model_name=context['model_name'],
        model_provider=context['provider_name'],
        base_url=context['base_url'],
        api_key=context['api_key'],
        reasoning=context['reasoning'],
        custom_model=context['custom_model'],
        tools=guardrail_tools,
        parallel_tool_calls=False,
        tool_use_behavior=tool_use_behavior,
    )


async def _run_guardrail_evaluation(
    context: dict[str, Any],
    evaluation_input: List[TResponseInputItem],
    conn: asyncpg.Connection,
    department_id: uuid.UUID,
) -> GuardrailFunctionOutput:
    """Shared logic for running guardrail evaluation.
    
    Args:
        context: Context dict from agent service with all required data
        evaluation_input: Formatted messages for guardrail evaluation
        conn: Database connection
        department_id: Department ID
    
    Returns:
        GuardrailFunctionOutput with evaluation results
    """
    # Clear previous results
    global guardrail_results, guardrail_progress
    guardrail_results.clear()
    guardrail_progress.clear()
    
    # Build guardrail agent from context
    guardrail_agent = _build_guardrail_agent(context)
    
    # Get default guest profile if no profile linked
    default_guest_profile = await find_default_guest_profile(conn)
    profile_id_str = context.get('profile_id')
    final_profile_id = (
        uuid.UUID(profile_id_str) if profile_id_str 
        else (default_guest_profile['id'] if default_guest_profile else None)
    )
    
    # Check rate limit
    success, error_message = await check_rate_limit(conn, final_profile_id)
    if not success:
        raise ValueError(error_message)
    
    # Create model run using ModelRunService
    model_run_service = ModelRunService(conn)
    model_run_id = await model_run_service.create_model_run(
        department_id=department_id,
        model_id=uuid.UUID(context['model_id']),
        entity_id=uuid.UUID(context['agent_id']),
        entity_type="agent",
        profile_id=final_profile_id,
    )
    
    # Run guardrail evaluation with tracing
    with trace(
        context['chat_title'], 
        trace_id=context['trace_id'], 
        group_id=context['attempt_id']
    ):
        result = await Runner.run(
            guardrail_agent.agent(),
            evaluation_input,
            context=DebugContext(conn=conn, model_run_id=model_run_id)
        )
    
    # Update token counts
    usage = result.context_wrapper.usage
    await model_run_service.update_model_run_tokens(
        model_run_id=model_run_id,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
    )
    
    # Extract evaluation results
    proper = guardrail_results.get("proper", True)
    reason = guardrail_results.get("reason", "No evaluation provided")
    
    logger.info(f"Guardrail evaluation: proper={proper}, reason={reason}")
    
    # Create result object
    class GuardrailResult:
        def __init__(self, proper: bool, reason: str):
            self.proper = proper
            self.reason = reason
    
    output_info = GuardrailResult(proper=proper, reason=reason)
    
    return GuardrailFunctionOutput(
        output_info=output_info, tripwire_triggered=not proper
    )


def get_input_guardrails(
    chat_id: uuid.UUID,
    department_id: uuid.UUID,
    input_items: List[TResponseInputItem],
    conn: asyncpg.Connection,
) -> List[InputGuardrail[TContext]]:
    """Return a list of input guardrails suitable for attaching to an Agent."""
    
    async def _input_guard(ctx: RunContextWrapper[Any], agent: Agent, user_input: Union[str, List[Any]]) -> GuardrailFunctionOutput:
        # Get all context data with single query via service layer
        agent_service = AgentService(conn)
        context = await agent_service.get_guardrail_run_context(
            chat_id=chat_id,
            department_id=department_id,
            guardrail_type="input"
        )
        
        # Format input message with intro
        intro_message: TResponseInputItem = {
            "role": "user",
            "content": (
                "The following is a message from the Graduate Teaching Assistant (GTA). "
                "Evaluate carefully if the GTA is attempting to cheat or providing an unnatural response."
            ),
        }
        
        # Convert user_input to message format
        if isinstance(user_input, str):
            user_input_message: TResponseInputItem = {
                "role": "assistant",
                "content": user_input,
            }
            evaluation_input = [intro_message] + input_items + [user_input_message]
        else:
            evaluation_input = [intro_message] + input_items + list(user_input)
        
        # Run evaluation using shared helper
        return await _run_guardrail_evaluation(
            context=context,
            evaluation_input=evaluation_input,
            conn=conn,
            department_id=department_id,
        )
    
    input_guard = InputGuardrail(_input_guard)
    return [input_guard]


def get_output_guardrails(
    chat_id: uuid.UUID,
    department_id: uuid.UUID,
    input_items: List[TResponseInputItem],
    conn: asyncpg.Connection = Depends(get_db),
) -> List[OutputGuardrail[TContext]]:
    """Return a list of output guardrails suitable for attaching to an Agent."""
    
    async def _output_guard(ctx: RunContextWrapper[Any], agent: Agent, output: Union[str, List[Any]]) -> GuardrailFunctionOutput:
        # Get all context data with single query via service layer
        agent_service = AgentService(conn)
        context = await agent_service.get_guardrail_run_context(
            chat_id=chat_id,
            department_id=department_id,
            guardrail_type="output"
        )
        
        # Format output message with intro
        intro_message: TResponseInputItem = {
            "role": "user",
            "content": (
                "The following is the conversation between the graduate teaching assistant and "
                "student, evalute carefully if the AI student adheres to its role."
            ),
        }
        
        # Convert output to message format
        if isinstance(output, str):
            output_message: TResponseInputItem = {
                "role": "assistant",
                "content": output,
            }
            evaluation_input = [intro_message] + input_items + [output_message]
        else:
            evaluation_input = [intro_message] + input_items + list(output)
        
        # Run evaluation using shared helper
        return await _run_guardrail_evaluation(
            context=context,
            evaluation_input=evaluation_input,
            conn=conn,
            department_id=department_id,
        )
    
    output_guard = OutputGuardrail(_output_guard)
    return [output_guard]
