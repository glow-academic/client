from typing import AsyncGenerator, List
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Runner, RunConfig
from openai.types import Reasoning
from datetime import datetime
from app.extensions import get_gemini
from app.utils.chat import get_conversation_history
from app.utils.classes import get_class_info
from app.db import get_session
from sqlmodel import Session, select
from app.models import EvalMessages, EvalChats, EvalRuns, Agents, Scenarios
from app.utils.agents import gta_prompt, student_prompt
from fastapi import Depends
from openai.types.responses import (
    ResponseTextDeltaEvent,
)
import logging
from pydantic import BaseModel

logger = logging.getLogger(__name__)


async def run_advanced_agent_parallel(
    chat_ids: List[str],
    input_texts: List[str],
    eval_obj,
    eval_run_chat_map: dict,
    session: Session,
) -> AsyncGenerator[dict, None]:
    """
    Run multiple agent conversations simultaneously using a single agent call.
    This function uses one agent to generate responses for multiple conversations at once,
    making it much more efficient than running separate agents.

    Args:
        chat_ids: List of eval chat IDs to process
        input_texts: List of input messages for each chat
        eval_obj: The evaluation object containing configuration
        eval_run_chat_map: Mapping of chat IDs to their eval run information
        session: Database session

    Yields:
        Event dictionaries for streaming to the client
    """
    from app.services.agents.evaluate import run_evaluate_agent

    # Group chats by agent type to process similar agents together
    agent_groups = {}
    for i, chat_id in enumerate(chat_ids):
        chat_info = eval_run_chat_map[chat_id]
        agent_key = f"{chat_info['query_agent'].id}_{chat_info['response_agent'].id}"
        if agent_key not in agent_groups:
            agent_groups[agent_key] = []
        agent_groups[agent_key].append(
            {
                "chat_id": chat_id,
                "input_text": input_texts[i],
                "chat_index": i,
                "chat_info": chat_info,
            }
        )

    # Process each agent group
    for agent_key, group_chats in agent_groups.items():
        # Get agent info from first chat in group
        first_chat_info = group_chats[0]["chat_info"]
        query_agent = first_chat_info["query_agent"]
        response_agent = first_chat_info["response_agent"]

        # Initialize conversation state for all chats in this group
        chat_states = {}
        for chat_data in group_chats:
            chat_states[chat_data["chat_id"]] = {
                "current_message": chat_data["input_text"],
                "current_speaker": "query",
                "chat_index": chat_data["chat_index"],
                "scenario": chat_data["chat_info"]["scenario"],
            }

        # Run conversation for max_turns
        for turn in range(eval_obj.max_turns):
            # Determine current agent for this turn
            current_speaker = list(chat_states.values())[0]["current_speaker"]
            current_agent = (
                query_agent if current_speaker == "query" else response_agent
            )

            # Emit turn start events for all chats
            for chat_id, state in chat_states.items():
                yield {
                    "type": "turn_start",
                    "chat_id": chat_id,
                    "chat_index": state["chat_index"],
                    "turn": turn + 1,
                    "speaker": current_agent.name,
                    "message": state["current_message"],
                }

            # Get responses for all chats simultaneously
            responses = await _run_parallel_agent_turn(
                list(chat_states.keys()),
                [state["current_message"] for state in chat_states.values()],
                [state["scenario"] for state in chat_states.values()],
                current_agent,
                session,
            )

            # Process responses and emit events
            for i, (chat_id, response) in enumerate(zip(chat_states.keys(), responses)):
                state = chat_states[chat_id]

                # Emit token events (simulate streaming for UI consistency)
                for char in response:
                    yield {
                        "type": "token",
                        "chat_id": chat_id,
                        "chat_index": state["chat_index"],
                        "speaker": current_agent.name,
                        "token": char,
                    }

                # Store the message exchange
                eval_message = EvalMessages(
                    chat_id=chat_id,
                    query=state["current_message"],
                    response=response,
                    completed=True,
                )
                session.add(eval_message)

                # Update state for next turn
                state["current_message"] = response
                state["current_speaker"] = (
                    "response" if current_speaker == "query" else "query"
                )

                yield {
                    "type": "turn_complete",
                    "chat_id": chat_id,
                    "chat_index": state["chat_index"],
                    "turn": turn + 1,
                    "speaker": current_agent.name,
                    "response": response,
                }

            session.commit()

        # Mark all chats as completed and run evaluations
        for chat_id, state in chat_states.items():
            # Mark chat as completed
            eval_chat = session.exec(
                select(EvalChats).where(EvalChats.id == chat_id)
            ).one()
            eval_chat.completed_at = datetime.now()
            session.add(eval_chat)

            yield {
                "type": "conversation_complete",
                "chat_id": chat_id,
                "chat_index": state["chat_index"],
                "total_turns": eval_obj.max_turns,
            }

        session.commit()

        # Run evaluations for all chats in this group
        for chat_id, state in chat_states.items():
            yield {
                "type": "evaluation_start",
                "chat_id": chat_id,
                "chat_index": state["chat_index"],
            }

            eval_grade_id = await run_evaluate_agent(chat_id, session)

            yield {
                "type": "evaluation_complete",
                "chat_id": chat_id,
                "chat_index": state["chat_index"],
                "eval_grade_id": eval_grade_id,
            }


async def run_advanced_agent(
    chat_id: str,
    input_text: str = "",
    session: Session = Depends(get_session),
) -> AsyncGenerator[str, None]:
    """
    This function is used to run the generic agent using the OpenAI Agents SDK.
    Returns a streamable result that yields clean text chunks as they're generated.
    The agent behavior is customized based on the agent's description.

    This is kept for backward compatibility with single chat operations.

    Args:
        chat_id: The ID of the chat session (eval_chat_id)
        input_text: Optional input text to send to the agent
    Yields:
        Text chunks from the agent's response
    """
    eval_chat = session.exec(
        select(EvalChats).where(EvalChats.id == chat_id)
    ).one_or_none()

    if eval_chat:
        # Handle eval chat
        async for token in _handle_single_eval_chat(eval_chat, input_text, session):
            yield token
    else:
        raise ValueError(f"Chat not found with ID: {chat_id}")


async def _handle_single_eval_chat(
    chat: EvalChats, input_text: str, session: Session
) -> AsyncGenerator[str, None]:
    """Handle single eval chat processing."""

    # Get the eval run
    eval_run = session.exec(
        select(EvalRuns).where(EvalRuns.id == chat.eval_run_id)
    ).one()
    if not eval_run:
        raise ValueError(f"Eval run not found for chat {chat.id}")

    # Get the agent from the eval run
    agent = session.exec(select(Agents).where(Agents.id == eval_run.agent_id)).one()
    if not agent:
        raise ValueError(f"Agent not found for eval run {eval_run.id}")

    # Add a new message with an empty response
    message = EvalMessages(chat_id=chat.id, query=input_text, response="")
    session.add(message)

    # Get all the messages for the chat_id, including the new one, order by created_at
    messages = session.exec(
        select(EvalMessages)
        .where(EvalMessages.chat_id == chat.id)
        .order_by(EvalMessages.created_at)
    ).all()

    # Prepare conversation history - need to adapt for eval messages
    conversation_history = get_conversation_history(messages)

    # Get scenario info for context
    scenario = session.exec(
        select(Scenarios).where(Scenarios.id == eval_run.scenario_id)
    ).one()
    scenario_context = f"Scenario: {scenario.name} - {scenario.description}"

    # Get class info
    class_info = get_class_info(eval_run.class_id, session)

    input_items = [scenario_context, class_info] + conversation_history

    # Define the agent with agent-specific behavior
    agent_instance = AdvancedAgent(
        agent_name=agent.name,
        agent_prompt=agent.system_prompt,
        agent_type=agent.agent_type,
        temperature=agent.temperature / 10.0,
    )

    result = Runner.run_streamed(
        agent_instance.agent(),
        input=input_items,
        run_config=RunConfig(workflow_name=chat.title),
    )

    # Process streaming events
    full_response = ""
    async for event in result.stream_events():
        if event.type == "raw_response_event":
            if isinstance(event.data, ResponseTextDeltaEvent):
                chunk = event.data.delta
                full_response += chunk
                yield chunk

    # Update the message with the full response
    message.response = full_response
    session.add(message)
    session.commit()


class ParallelOutput(BaseModel):
    outputs: List[str]


async def _run_parallel_agent_turn(
    chat_ids: List[str],
    input_messages: List[str],
    scenarios: List,
    agent,
    session: Session,
) -> List[str]:
    """
    Run a single agent turn for multiple conversations simultaneously.
    The agent receives multiple inputs and generates multiple outputs in one call.

    Args:
        chat_ids: List of chat IDs
        input_messages: List of input messages for each chat
        scenarios: List of scenario objects for each chat
        agent: The agent object to use
        session: Database session

    Returns:
        List of response strings, one for each input
    """
    try:
        # Build conversation contexts for all chats
        all_contexts = []

        for i, chat_id in enumerate(chat_ids):
            # Get conversation history for this chat
            messages = session.exec(
                select(EvalMessages)
                .where(EvalMessages.chat_id == chat_id)
                .order_by(EvalMessages.created_at)
            ).all()

            # Build conversation context
            conversation_context = []
            for msg in messages:
                if msg.query:
                    conversation_context.append(f"Previous: {msg.query}")
                if msg.response:
                    conversation_context.append(f"Response: {msg.response}")

            # Add scenario context and current input
            scenario = scenarios[i]
            scenario_context = f"Scenario: {scenario.name} - {scenario.description}"

            # Format this conversation for the multi-input prompt
            chat_context = f"""
INPUT {i + 1}:
Scenario: {scenario_context}
Conversation History: {" | ".join(conversation_context) if conversation_context else "None"}
Current Message: {input_messages[i]}
"""
            all_contexts.append(chat_context)

        # Create the multi-input prompt
        multi_input_prompt = f"""
You are responding to {len(chat_ids)} different conversations simultaneously. 
For each INPUT, provide a corresponding OUTPUT response.

Please respond with exactly {len(chat_ids)} outputs in the following format:
OUTPUT 1: [your response to INPUT 1]
OUTPUT 2: [your response to INPUT 2]
...and so on.

Make sure each output is appropriate for its corresponding input and scenario.

{chr(10).join(all_contexts)}

Remember to provide exactly {len(chat_ids)} outputs, one for each input.
"""

        # Create agent instance with parallel output enabled
        agent_instance = AdvancedAgent(
            agent_name=agent.name,
            agent_prompt=agent.system_prompt,
            agent_type=agent.agent_type,
            temperature=agent.temperature / 10.0,
            use_parallel_output=True,
        )

        # Run the agent with the multi-input prompt
        result = Runner.run(
            agent_instance.agent(),
            input=[multi_input_prompt],
            run_config=RunConfig(workflow_name=f"{agent.name} Parallel Conversation"),
        )

        # Parse the response to extract individual outputs
        if hasattr(result, "outputs") and result.outputs:
            # If the agent returns structured output
            return result.outputs
        else:
            # Parse the text response to extract outputs
            response_text = str(result)
            outputs = _parse_multi_output_response(response_text, len(chat_ids))
            return outputs

    except Exception as e:
        logger.error(f"Error in parallel agent conversation: {str(e)}")
        # Return error responses for all chats
        return [f"[Error: {str(e)}]" for _ in chat_ids]


def _parse_multi_output_response(response_text: str, expected_count: int) -> List[str]:
    """
    Parse a multi-output response from the agent.
    Looks for patterns like "OUTPUT 1:", "OUTPUT 2:", etc.

    Args:
        response_text: The raw response from the agent
        expected_count: Number of outputs expected

    Returns:
        List of parsed output strings
    """
    import re

    outputs = []

    # Try to find OUTPUT patterns
    pattern = r"OUTPUT\s+(\d+):\s*(.*?)(?=OUTPUT\s+\d+:|$)"
    matches = re.findall(pattern, response_text, re.DOTALL | re.IGNORECASE)

    if matches and len(matches) >= expected_count:
        # Sort by output number and extract text
        sorted_matches = sorted(matches, key=lambda x: int(x[0]))
        outputs = [match[1].strip() for match in sorted_matches[:expected_count]]
    else:
        # Fallback: split by common delimiters or line breaks
        lines = response_text.strip().split("\n")
        non_empty_lines = [line.strip() for line in lines if line.strip()]

        if len(non_empty_lines) >= expected_count:
            outputs = non_empty_lines[:expected_count]
        else:
            # Last resort: duplicate the response or create generic responses
            if non_empty_lines:
                base_response = non_empty_lines[0]
                outputs = [
                    f"{base_response} (Response {i + 1})" for i in range(expected_count)
                ]
            else:
                outputs = [
                    f"I understand your question {i + 1}. Let me help you with that."
                    for i in range(expected_count)
                ]

    # Ensure we have exactly the expected number of outputs
    while len(outputs) < expected_count:
        outputs.append(
            "I apologize, but I need more information to provide a complete response."
        )

    return outputs[:expected_count]


class AdvancedAgent:
    def __init__(
        self,
        agent_name: str,
        agent_prompt: str,
        agent_type: str,
        temperature: float = 0.0,
        use_parallel_output: bool = False,
    ):
        self.gemini_client = get_gemini()
        self.agent_name = agent_name
        self.agent_prompt = agent_prompt
        self.use_parallel_output = use_parallel_output
        if agent_type == "ta":
            self.system_prompt = gta_prompt(agent_name, agent_prompt)
        elif agent_type == "student":
            self.system_prompt = student_prompt(agent_name, agent_prompt)
        else:
            self.system_prompt = agent_prompt
        self.temperature = temperature

    def agent(self):
        agent_config = {
            "name": f"{self.agent_name} Agent",
            "instructions": self.system_prompt,
            "model": OpenAIChatCompletionsModel(
                model="gemini-2.5-flash-preview-04-17",
                openai_client=self.gemini_client,
            ),
            "model_settings": ModelSettings(
                temperature=self.temperature,
                include_usage=True,
                reasoning=Reasoning(effort="low"),
            ),
        }

        # Only add output_type for parallel operations
        if self.use_parallel_output:
            agent_config["output_type"] = ParallelOutput

        return Agent(**agent_config)
