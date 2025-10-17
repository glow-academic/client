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
from app.utils.agents import get_department_agent
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


async def _build_guardrail_agent(conn: asyncpg.Connection, department_id: uuid.UUID, guardrail_type: str) -> tuple[GenericAgent, uuid.UUID, uuid.UUID]:
    """Create the internal agent that powers the guardrail from the department's configured guardrail agent.
    
    Args:
        conn: Database connection
        department_id: Department ID to get the guardrail agent from
        guardrail_type: Either "input" or "output" to determine which guardrail agent to use
    """
    # Get the appropriate guardrail agent from department via junction table
    if guardrail_type not in ("input", "output"):
        raise ValueError(f"Invalid guardrail_type: {guardrail_type}. Must be 'input' or 'output'")
    
    role = f"{guardrail_type}_guardrail"  # 'input_guardrail' or 'output_guardrail'
    agent_row = await get_department_agent(conn, department_id, role)

    model = await conn.fetchrow(
        "SELECT id, name, provider_id, custom_model FROM models WHERE id = $1",
        agent_row['model_id']
    )
    if not model:
        raise ValueError(f"Model with ID {agent_row['model_id']} not found")

    provider = await conn.fetchrow(
        "SELECT id, name, base_url, api_key FROM providers WHERE id = $1",
        model['provider_id']
    )
    if not provider:
        raise ValueError(f"Provider with ID {model['provider_id']} not found")

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
        agent_name=agent_row['name'],
        system_prompt=agent_row['system_prompt'],
        temperature=agent_row['temperature'],
        model_name=model['name'],
        model_provider=provider['name'],
        base_url=provider['base_url'],
        api_key=provider['api_key'],
        reasoning=agent_row['reasoning'],
        custom_model=model['custom_model'],
        tools=guardrail_tools,
        parallel_tool_calls=False,
        tool_use_behavior=tool_use_behavior,
    ), agent_row['id'], model['id']


def get_input_guardrails(
    chat_id: uuid.UUID,
    department_id: uuid.UUID,
    input_items: List[TResponseInputItem],
    conn: asyncpg.Connection,
) -> List[InputGuardrail[TContext]]:
    """Return a list of input guardrails suitable for attaching to an Agent."""
    
    async def _input_guard(ctx: RunContextWrapper[Any], agent: Agent, user_input: Union[str, List[Any]]) -> GuardrailFunctionOutput:
        # Clear previous results
        global guardrail_results, guardrail_progress
        guardrail_results.clear()
        guardrail_progress.clear()
        
        guardrail_agent, agent_id, model_id = await _build_guardrail_agent(conn, department_id, "input")
        
        chat = await conn.fetchrow(
            "SELECT id, title, trace_id, attempt_id FROM simulation_chats WHERE id = $1",
            chat_id
        )
        if not chat:
            raise ValueError(f"Chat {chat_id} not found")

        attempt = await conn.fetchrow(
            "SELECT id, simulation_id FROM simulation_attempts WHERE id = $1",
            chat['attempt_id']
        )
        if not attempt:
            raise ValueError(f"Attempt {chat['attempt_id']} not found")

        # Get profile from attempt_profiles junction
        attempt_profile_link = await conn.fetchrow("""
            SELECT profile_id 
            FROM attempt_profiles 
            WHERE attempt_id = $1 AND active = true
        """, attempt['id'])
        
        profile_id = attempt_profile_link['profile_id'] if attempt_profile_link else None

        default_guest_profile = await find_default_guest_profile(conn)

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

        final_profile_id = (profile_id if profile_id else (default_guest_profile['id'] if default_guest_profile else None))

        success, error_message = await check_rate_limit(conn, final_profile_id)
        if not success:
            raise ValueError(error_message)
        
        # Create model run
        model_run_id = await conn.fetchval("""
            INSERT INTO model_runs (input_tokens, output_tokens, department_id)
            VALUES ($1, $2, $3)
            RETURNING id
        """, 0, 0, department_id)

        # Create model_run junction records
        if model_id:
            await conn.execute("""
                INSERT INTO model_run_models (model_run_id, model_id, active)
                VALUES ($1, $2, $3)
            """, model_run_id, model_id, True)
        
        if agent_id:
            await conn.execute("""
                INSERT INTO model_run_agents (model_run_id, agent_id, active)
                VALUES ($1, $2, $3)
            """, model_run_id, agent_id, True)
        
        if final_profile_id:
            await conn.execute("""
                INSERT INTO model_run_profiles (model_run_id, profile_id, active)
                VALUES ($1, $2, $3)
            """, model_run_id, final_profile_id, True)

        with trace(chat['title'], trace_id=chat['trace_id'], group_id=str(attempt['id'])):
            result = await Runner.run(
                guardrail_agent.agent(), evaluation_input, context=DebugContext(conn=conn, model_run_id=model_run_id)
            )

        usage = result.context_wrapper.usage
        await conn.execute("""
            UPDATE model_runs 
            SET input_tokens = $1, output_tokens = $2
            WHERE id = $3
        """, usage.input_tokens, usage.output_tokens, model_run_id)
        
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
        # Clear previous results
        global guardrail_results, guardrail_progress
        guardrail_results.clear()
        guardrail_progress.clear()
        
        guardrail_agent, agent_id, model_id = await _build_guardrail_agent(conn, department_id, "output")
        
        chat = await conn.fetchrow(
            "SELECT id, title, trace_id, attempt_id FROM simulation_chats WHERE id = $1",
            chat_id
        )
        if not chat:
            raise ValueError(f"Chat {chat_id} not found")

        attempt = await conn.fetchrow(
            "SELECT id, simulation_id FROM simulation_attempts WHERE id = $1",
            chat['attempt_id']
        )
        if not attempt:
            raise ValueError(f"Attempt {chat['attempt_id']} not found")

        # Get profile from attempt_profiles junction
        attempt_profile_link = await conn.fetchrow("""
            SELECT profile_id 
            FROM attempt_profiles 
            WHERE attempt_id = $1 AND active = true
        """, attempt['id'])
        
        profile_id = attempt_profile_link['profile_id'] if attempt_profile_link else None

        default_guest_profile = await find_default_guest_profile(conn)

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

        final_profile_id = (profile_id if profile_id else (default_guest_profile['id'] if default_guest_profile else None))

        success, error_message = await check_rate_limit(conn, final_profile_id)
        if not success:
            raise ValueError(error_message)
        
        # Create model run
        model_run_id = await conn.fetchval("""
            INSERT INTO model_runs (input_tokens, output_tokens, department_id)
            VALUES ($1, $2, $3)
            RETURNING id
        """, 0, 0, department_id)

        # Create model_run junction records
        if model_id:
            await conn.execute("""
                INSERT INTO model_run_models (model_run_id, model_id, active)
                VALUES ($1, $2, $3)
            """, model_run_id, model_id, True)
        
        if agent_id:
            await conn.execute("""
                INSERT INTO model_run_agents (model_run_id, agent_id, active)
                VALUES ($1, $2, $3)
            """, model_run_id, agent_id, True)
        
        if final_profile_id:
            await conn.execute("""
                INSERT INTO model_run_profiles (model_run_id, profile_id, active)
                VALUES ($1, $2, $3)
            """, model_run_id, final_profile_id, True)

        with trace(chat['title'], trace_id=chat['trace_id'], group_id=str(attempt['id'])):
            result = await Runner.run(
                guardrail_agent.agent(), evaluation_input, context=DebugContext(conn=conn, model_run_id=model_run_id)
            )

        usage = result.context_wrapper.usage
        await conn.execute("""
            UPDATE model_runs 
            SET input_tokens = $1, output_tokens = $2
            WHERE id = $3
        """, usage.input_tokens, usage.output_tokens, model_run_id)
        
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
    
    output_guard = OutputGuardrail(_output_guard)
    return [output_guard]
