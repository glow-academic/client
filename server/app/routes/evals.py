# app/routes/evals.py
from fastapi import APIRouter, Form, HTTPException, Depends
from app.models import (
    EvalRuns,
    EvalChats,
    EvalMessages,
    Agents,
    Scenarios,
    Evals,
    Rubrics,
)
from app.db import get_session
from sqlmodel import Session, select
import logging
from typing import Optional, List
import random
from app.services.agents.evaluate import run_evaluate_agent
from app.services.agents.generic import GenericAgent
from fastapi.responses import StreamingResponse
import json
from typing import AsyncIterator
from datetime import datetime
from agents import Runner, RunConfig
from openai.types.responses import ResponseTextDeltaEvent

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/start")
async def start_eval(
    eval_id: str = Form(...),
    class_id: str = Form(...),
    session: Session = Depends(get_session),
):
    """
    Create eval runs for all combinations of agents, scenarios, and rubrics in the evaluation.
    This endpoint sets up all the eval runs that will be executed later.
    """
    try:
        # Get the eval
        eval_obj = session.exec(
            select(Evals).where(Evals.id == eval_id)
        ).one_or_none()
        if not eval_obj:
            raise HTTPException(status_code=404, detail="Evaluation not found")

        # Get all required data
        scenario_ids = eval_obj.scenario_ids or []
        agent_ids = eval_obj.agent_ids or []
        rubric_ids = eval_obj.rubric_ids or []

        if not scenario_ids:
            raise HTTPException(status_code=400, detail="Eval has no scenarios configured")
        if not agent_ids:
            raise HTTPException(status_code=400, detail="Eval has no agents configured")
        if not rubric_ids:
            raise HTTPException(status_code=400, detail="Eval has no rubrics configured")

        # Validate that all referenced entities exist
        scenarios = session.exec(select(Scenarios).where(Scenarios.id.in_(scenario_ids))).all()
        agents = session.exec(select(Agents).where(Agents.id.in_(agent_ids))).all()
        rubrics = session.exec(select(Rubrics).where(Rubrics.id.in_(rubric_ids))).all()

        if len(scenarios) != len(scenario_ids):
            raise HTTPException(status_code=400, detail="Some scenarios not found")
        if len(agents) != len(agent_ids):
            raise HTTPException(status_code=400, detail="Some agents not found")
        if len(rubrics) != len(rubric_ids):
            raise HTTPException(status_code=400, detail="Some rubrics not found")

        # Create eval runs for all combinations
        eval_runs_created = []
        
        # Limit combinations based on num_parallel_runs
        max_runs = min(eval_obj.num_parallel_runs, len(scenario_ids))
        selected_scenarios = scenario_ids[:max_runs]
        
        for scenario_id in selected_scenarios:
            for agent_id in agent_ids:
                for rubric_id in rubric_ids:
                    eval_run = EvalRuns(
                        class_id=class_id,
                        eval_id=eval_id,
                        agent_id=agent_id,
                        scenario_id=scenario_id,
                        rubric_id=rubric_id
                    )
                    session.add(eval_run)
                    eval_runs_created.append(eval_run)

        session.commit()
        
        # Refresh all eval runs to get their IDs
        for eval_run in eval_runs_created:
            session.refresh(eval_run)

        logger.info(f"Created {len(eval_runs_created)} eval runs for eval {eval_id}")

        return {
            "success": True,
            "message": f"Created {len(eval_runs_created)} eval runs",
            "eval_run_ids": [str(run.id) for run in eval_runs_created],
            "total_runs": len(eval_runs_created)
        }

    except Exception as e:
        session.rollback()
        logger.error(f"Error starting eval: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to start eval: {str(e)}"
        )


@router.post("/run")
async def run_eval(
    eval_run_id: str = Form(...),
    session: Session = Depends(get_session),
):
    """
    Execute a specific eval run by running an agent-to-agent conversation
    followed by evaluation. Streams the conversation progress back to the client.
    """
    try:
        # Get the eval run
        eval_run = session.exec(
            select(EvalRuns).where(EvalRuns.id == eval_run_id)
        ).one_or_none()
        if not eval_run:
            raise HTTPException(status_code=404, detail="Eval run not found")

        # Get related entities
        eval_obj = session.exec(select(Evals).where(Evals.id == eval_run.eval_id)).one()
        scenario = session.exec(select(Scenarios).where(Scenarios.id == eval_run.scenario_id)).one()
        query_agent = session.exec(select(Agents).where(Agents.id == scenario.agent_id)).one()
        response_agent = session.exec(select(Agents).where(Agents.id == eval_run.agent_id)).one()

        async def event_stream() -> AsyncIterator[str]:
            yield ":\n\n"  # Initial heartbeat

            try:
                # Create the eval chat
                chat_title = f"{query_agent.name} vs {response_agent.name} - {scenario.name}"
                eval_chat = EvalChats(
                    title=chat_title,
                    eval_run_id=eval_run_id
                )
                session.add(eval_chat)
                session.commit()
                session.refresh(eval_chat)

                yield f"data: {json.dumps({'type': 'chat_created', 'chat_id': str(eval_chat.id), 'title': chat_title})}\n\n"

                # Create agent instances
                query_agent_instance = GenericAgent(
                    agent_name=query_agent.name,
                    agent_prompt=query_agent.system_prompt,
                    agent_type=query_agent.agent_type,
                    temperature=query_agent.temperature / 10.0  # Convert to 0-1 range
                )
                
                response_agent_instance = GenericAgent(
                    agent_name=response_agent.name,
                    agent_prompt=response_agent.system_prompt,
                    agent_type=response_agent.agent_type,
                    temperature=response_agent.temperature / 10.0  # Convert to 0-1 range
                )

                # Initialize conversation with scenario-based opening
                # The first agent (query agent) starts with a natural problem/question based on the scenario
                current_message = _generate_natural_opening(scenario, query_agent)
                current_speaker = "query"  # query agent starts
                current_agent_instance = query_agent_instance
                current_agent_name = query_agent.name
                
                # Run conversation for max_turns
                for turn in range(eval_obj.max_turns):
                    yield f"data: {json.dumps({'type': 'turn_start', 'turn': turn + 1, 'speaker': current_agent_name, 'message': current_message})}\n\n"

                    # Get response from current agent
                    response = ""
                    async for token in run_agent_conversation(
                        eval_chat.id,
                        current_message,
                        current_agent_instance,
                        current_agent_name,
                        scenario,
                        session
                    ):
                        response += token
                        yield f"data: {json.dumps({'type': 'token', 'speaker': current_agent_name, 'token': token})}\n\n"

                    # Store the message exchange
                    eval_message = EvalMessages(
                        chat_id=eval_chat.id,
                        query=current_message,
                        response=response,
                        completed=True
                    )
                    session.add(eval_message)
                    session.commit()

                    yield f"data: {json.dumps({'type': 'turn_complete', 'turn': turn + 1, 'speaker': current_agent_name, 'response': response})}\n\n"

                    # Switch to the other agent for next turn
                    if current_speaker == "query":
                        current_speaker = "response"
                        current_agent_instance = response_agent_instance
                        current_agent_name = response_agent.name
                    else:
                        current_speaker = "query"
                        current_agent_instance = query_agent_instance
                        current_agent_name = query_agent.name
                    
                    # The response becomes the next message
                    current_message = response

                # Mark chat as completed
                eval_chat.completed_at = datetime.now()
                session.add(eval_chat)
                session.commit()

                yield f"data: {json.dumps({'type': 'conversation_complete', 'total_turns': eval_obj.max_turns})}\n\n"

                # Run evaluation
                yield f"data: {json.dumps({'type': 'evaluation_start'})}\n\n"
                
                eval_grade_id = await run_evaluate_agent(str(eval_chat.id), session)
                
                yield f"data: {json.dumps({'type': 'evaluation_complete', 'eval_grade_id': eval_grade_id})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'success': True})}\n\n"

            except Exception as exc:
                error_msg = str(exc)
                logger.exception("Error in eval run: %s", error_msg)
                yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"
                raise

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream; charset=utf-8",
            headers={"Cache-Control": "no-store"},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in run eval endpoint: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to run eval: {str(e)}"
        )


def _generate_natural_opening(scenario: Scenarios, agent: Agents) -> str:
    """
    Generate a natural conversation opening based on the scenario and agent type.
    """
    if agent.agent_type == "student":
        # Student agents start with a problem or question related to the scenario
        openings = [
            f"I'm having trouble with {scenario.description.lower()}. Can you help me understand it?",
            f"I'm stuck on this problem about {scenario.description.lower()}. Where should I start?",
            f"Can you explain {scenario.description.lower()} to me? I'm really confused.",
            f"I've been working on {scenario.description.lower()} but I'm not getting the right answer.",
            f"I need help with {scenario.description.lower()}. I don't know what I'm doing wrong."
        ]
    else:
        # TA agents start by offering help or asking what the student needs
        openings = [
            f"I see you're working on {scenario.description.lower()}. What specific part are you struggling with?",
            f"How can I help you with {scenario.description.lower()} today?",
            f"What questions do you have about {scenario.description.lower()}?",
            f"Let's work through {scenario.description.lower()} together. What have you tried so far?",
            f"I'm here to help with {scenario.description.lower()}. What's your main concern?"
        ]
    
    return random.choice(openings)


async def run_agent_conversation(
    chat_id: str,
    input_message: str,
    agent_instance: GenericAgent,
    agent_name: str,
    scenario: Scenarios,
    session: Session
) -> AsyncIterator[str]:
    """
    Run a single agent in the conversation and yield tokens as they're generated.
    """
    try:
        # Get conversation history for context
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
        scenario_context = f"Scenario: {scenario.name} - {scenario.description}"
        input_items = [scenario_context] + conversation_context + [f"Current message: {input_message}"]
        
        # Run the agent
        result = Runner.run_streamed(
            agent_instance.agent(),
            input=input_items,
            run_config=RunConfig(workflow_name=f"{agent_name} Conversation"),
        )

        # Stream the response
        async for event in result.stream_events():
            if event.type == "raw_response_event":
                if isinstance(event.data, ResponseTextDeltaEvent):
                    chunk = event.data.delta
                    yield chunk

    except Exception as e:
        logger.error(f"Error in agent conversation: {str(e)}")
        yield f"[Error: {str(e)}]"