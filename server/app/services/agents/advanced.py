from typing import AsyncGenerator, List
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Runner, RunConfig
from openai.types import Reasoning
from datetime import datetime
from app.extensions import get_gemini
from app.utils.chat import generate_natural_opening, get_eval_conversation_history
from app.utils.classes import get_class_info
from app.db import get_session
from sqlmodel import Session, select
from app.models import EvalMessages, EvalChats, EvalRuns, Agents, Scenarios, Evals
from app.utils.agents import gta_prompt, student_prompt
from fastapi import Depends
from openai.types.responses import (
    ResponseTextDeltaEvent,
)
import logging
from pydantic import BaseModel
import json

logger = logging.getLogger(__name__)


class ParallelOutput(BaseModel):
    outputs: List[str]


async def run_advanced_agent(
    eval_chat_ids: List[str],
    session: Session,
) -> AsyncGenerator[dict, None]:
    """
    Run multiple agent conversations simultaneously using a single agent call.
    This function processes all conversation histories at once and gets multiple responses
    via the ParallelOutput object.

    Args:
        eval_chat_ids: List of eval chat IDs to process

    Yields:
        Event dictionaries for streaming to the client
    """

    # Get eval chats
    eval_chats = session.exec(
        select(EvalChats).where(EvalChats.id.in_(eval_chat_ids))
    ).all()

    if not eval_chats:
        raise ValueError(f"No eval chats found with IDs: {eval_chat_ids}")

    if len(eval_chats) < 2:
        raise ValueError("At least 2 chats are required for advanced agent processing")

    yield {
        "type": "parallel_info",
        "message": f"Processing {len(eval_chats)} conversations simultaneously"
    }

    # All chats should have the same eval run id
    eval_run = session.exec(
        select(EvalRuns).where(EvalRuns.id == eval_chats[0].eval_run_id)
    ).one()
    if not eval_run:
        raise ValueError(f"Eval run not found for chat {eval_chats[0].id}")
    
    # Get the eval for this eval run
    eval_obj = session.exec(select(Evals).where(Evals.id == eval_run.eval_id)).one()
    if not eval_obj:
        raise ValueError(f"Eval not found for eval run {eval_run.id}")
    
    max_turns = eval_obj.max_turns
    
    # Get the base agent (query agent) from the eval
    query_agent = session.exec(select(Agents).where(Agents.id == eval_obj.base_agent_id)).one()
    if not query_agent:
        raise ValueError(f"Base agent not found for eval {eval_obj.id}")
    
    # Get the response agent from the eval run
    response_agent = session.exec(select(Agents).where(Agents.id == eval_run.agent_id)).one()
    if not response_agent:
        raise ValueError(f"Agent not found for eval run {eval_run.id}")

    # Process turns until max_turns is reached
    for turn in range(max_turns):
        yield {
            "type": "turn_start",
            "turn": turn + 1,
            "max_turns": max_turns,
            "message": f"Starting turn {turn + 1} of {max_turns}"
        }

        # Determine current agent and message type
        if turn % 2 == 0:
            current_agent = response_agent
            message_type = "response"
        else:
            current_agent = query_agent
            message_type = "query"

        # Collect conversation histories for all chats
        conversation_inputs = []
        new_messages = []
        
        for i, chat in enumerate(eval_chats):
            # Get existing messages for this chat
            existing_messages = session.exec(
                select(EvalMessages)
                .where(EvalMessages.chat_id == chat.id)
                .order_by(EvalMessages.created_at)
            ).all()

            # For turn 0, generate opening if no messages exist
            if turn == 0 and len(existing_messages) == 0:
                opening_text = generate_natural_opening(query_agent)
                opening_message = EvalMessages(
                    chat_id=chat.id, 
                    content=opening_text, 
                    type="query"
                )
                session.add(opening_message)
                session.commit()
                session.refresh(opening_message)
                existing_messages = [opening_message]

            # Create new empty message for this turn
            new_message = EvalMessages(
                chat_id=chat.id,
                content="",
                type=message_type
            )
            session.add(new_message)
            new_messages.append(new_message)

            # Get scenario info for context
            scenario = session.exec(
                select(Scenarios).where(Scenarios.id == chat.scenario_id)
            ).one()
            scenario_context = f"Scenario {i+1}: {scenario.name} - {scenario.description}"

            # Get class info if available
            class_info = ""
            if scenario.class_id:
                class_info = get_class_info(scenario.class_id, session)

            # Prepare conversation history
            conversation_history = get_eval_conversation_history(existing_messages)
            
            # Build input for this conversation
            chat_input = [scenario_context]
            if class_info:
                chat_input.append(class_info)
            chat_input.extend(conversation_history)
            
            conversation_inputs.append({
                "chat_index": i,
                "chat_id": chat.id,
                "input": chat_input
            })

        session.commit()

        # Prepare the combined input for the agent
        combined_input = [
            f"You are responding to {len(eval_chats)} different conversations simultaneously.",
            f"This is turn {turn + 1} of {max_turns}.",
            f"You are currently acting as: {current_agent.name}",
            "Below are the conversation histories for each scenario:"
        ]

        for conv_input in conversation_inputs:
            combined_input.append(f"\n--- Conversation {conv_input['chat_index'] + 1} ---")
            combined_input.extend(conv_input['input'])

        combined_input.append(
            f"\nPlease provide {len(eval_chats)} responses in JSON format with the 'outputs' key containing a list of responses, "
            f"one for each conversation in the order they were presented."
        )

        # Create agent instance with advanced=True for parallel processing
        agent_instance = AdvancedAgent(
            agent_name=current_agent.name,
            agent_prompt=current_agent.system_prompt,
            agent_type=current_agent.agent_type,
            temperature=current_agent.temperature,
            advanced=True  # Enable parallel processing mode
        )

        # Run the agent
        result = Runner.run_streamed(
            agent_instance.agent(),
            input=combined_input,
            run_config=RunConfig(workflow_name=f"Advanced Agent Turn {turn + 1}"),
        )

        # Process streaming events
        full_response = ""
        async for event in result.stream_events():
            if event.type == "raw_response_event":
                if isinstance(event.data, ResponseTextDeltaEvent):
                    chunk = event.data.delta
                    full_response += chunk
                    yield {
                        "type": "token",
                        "turn": turn + 1,
                        "agent": current_agent.name,
                        "token": chunk
                    }

        # Process the final output
        try:
            final_output = result.final_output_as(ParallelOutput)
            
            if len(final_output.outputs) != len(eval_chats):
                raise ValueError(f"Expected {len(eval_chats)} outputs, got {len(final_output.outputs)}")
            
            # Update messages with the responses
            for i, (output, message) in enumerate(zip(final_output.outputs, new_messages)):
                message.content = output.strip()
                message.completed = True
                session.add(message)
                
                yield {
                    "type": "chat_info",
                    "chat_id": message.chat_id,
                    "chat_index": i,
                    "turn": turn + 1,
                    "message": f"Chat {i+1} response: {output[:100]}..."
                }
            
            session.commit()
            
            yield {
                "type": "turn_complete",
                "turn": turn + 1,
                "message": f"Turn {turn + 1} completed for all {len(eval_chats)} conversations"
            }
            
        except Exception as e:
            logger.error(f"Error processing parallel output: {str(e)}")
            # Fallback: use the full response and split it
            responses = full_response.split('\n\n') if full_response else [""] * len(eval_chats)
            
            for i, message in enumerate(new_messages):
                response_text = responses[i] if i < len(responses) else f"Error processing response for chat {i+1}"
                message.content = response_text.strip()
                message.completed = True
                session.add(message)
            
            session.commit()
            
            yield {
                "type": "error",
                "turn": turn + 1,
                "message": f"Error processing parallel output, used fallback: {str(e)}"
            }

    # Mark all chats as completed
    for chat in eval_chats:
        chat.completed = True
        chat.completed_at = datetime.now()
        session.add(chat)
    
    session.commit()

    yield {
        "type": "all_complete",
        "message": f"All {len(eval_chats)} conversations completed successfully after {max_turns} turns"
    }


class AdvancedAgent:
    def __init__(
        self,
        agent_name: str,
        agent_prompt: str,
        agent_type: str,
        temperature: float = 0.0,
        advanced: bool = False,
    ):
        self.gemini_client = get_gemini()
        self.agent_name = agent_name
        self.agent_prompt = agent_prompt
        self.advanced = advanced
        
        if agent_type == "ta":
            self.system_prompt = gta_prompt(agent_name, agent_prompt, advanced=advanced)
        elif agent_type == "student":
            self.system_prompt = student_prompt(agent_name, agent_prompt, advanced=advanced)
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
        
        # Only add output_type for advanced mode
        if self.advanced:
            agent_config["output_type"] = ParallelOutput
            
        return Agent(**agent_config)