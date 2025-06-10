# app/routes/eval_runs.py
from fastapi import APIRouter, Form, HTTPException, Depends
from app.models import (
    EvalRuns,
    EvalChats,
    Agents,
    Scenarios,
    Evals,
)
from app.db import get_session
from sqlmodel import Session, select
import logging
from app.services.agents.scenario import run_scenario_agent
from typing import Optional
import random

from app.services.agents.generic import run_generic_agent, run_evaluation_agent
from app.services.agents.evaluate import run_evaluate_agent
from app.services.agents.generic import run_generic_agent
from fastapi.responses import StreamingResponse
import json
from typing import AsyncIterator

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/start")
async def start_eval(
    eval_id: str = Form(...),
    class_id: str = Form(...),
    session: Session = Depends(get_session),
):
    """
    This endpoint creates a new attempt and associated chats based on a simulation.
    For guest mode, user_id can be None or empty string.
    Handles both permanent individual practice simulations and dynamic quiz simulations.
    """
    try:
        # Get the eval
        eval = session.exec(
            select(Evals).where(Evals.id == eval_id)
        ).one_or_none()
        if not eval:
            raise HTTPException(status_code=404, detail="Simulation not found")

        # Create the eval run
        new_eval_run = EvalRuns(
            class_id=class_id,
            eval_id=eval_id,
        )
        session.add(new_eval_run)
        session.commit()
        session.refresh(new_eval_run)

        logger.info(f"Created eval run {new_eval_run.id} for eval {eval_id}")

        # Get interaction IDs for this simulation and filter out invalid ones
        scenario_ids = eval.scenario_ids or []

        if not scenario_ids:
            raise HTTPException(
                status_code=400, detail="Eval has no valid scenarios configured"
            )

        # Get the first scenario
        scenario_id = scenario_ids[0]
        scenario = session.exec(
            select(Scenarios).where(Scenarios.id == scenario_id)
        ).one_or_none()

        if not scenario:
            raise HTTPException(
                status_code=400, detail=f"Scenario {scenario_id} not found"
            )

        # Handle scenario creation or selection
        if not scenario.scenario_id:
            scenario_id, chat_title = await run_scenario_agent(
                agent_id=scenario.agent_id,
                class_id=class_id,
                session=session,
            )
        else:
            scenario_id = scenario.id
            agent = session.exec(
                select(Agents).where(Agents.id == scenario.agent_id)
            ).one_or_none()
            if agent:
                chat_title = f"{agent.name} Student Session"
            else:
                chat_title = "Practice Session"

        # Handle agent selection
        if not scenario.agent_id:
            # get all agents
            agents = session.exec(select(Agents)).all()
            if not agents:
                raise HTTPException(status_code=400, detail="No agents found")
            agent_id = random.choice(agents).id
        else:
            agent_id = scenario.agent_id

        # Create the chat with the scenario and link it to this attempt
        chat = EvalChats(
            title=chat_title,
            eval_run_id=new_eval_run.id,
            completed=False,
        )

        session.add(chat)
        session.commit()
        session.refresh(chat)

        return {
            "success": True,
            "message": "Attempt started successfully",
            "attempt_id": str(new_attempt.id),
            "chat_id": str(chat.id),
        }

    except Exception as e:
        session.rollback()
        logger.error(f"Error starting attempt: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to start attempt: {str(e)}"
        )



@router.post("/message")
async def message(
    chat_id: str = Form(...),
    message: str = Form(...),
    test_data: Optional[bool] = Form(False),
    session: Session = Depends(get_session),
):
    """
    Streams assistant tokens back to the frontend via Server-Sent Events.
    """
    try:
        chat = session.exec(
            select(SimulationChats).where(SimulationChats.id == chat_id)
        ).one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        # Check if chat is completed
        if chat.completed:
            raise HTTPException(
                status_code=400, detail="Cannot send messages to completed chat"
            )

        async def event_stream() -> AsyncIterator[str]:
            # initial heartbeat so proxies flush headers
            yield ":\n\n"

            try:
                async for token in run_generic_agent(
                    chat_id=chat_id,
                    input_text=message,
                    session=session,
                    test_data=test_data,
                ):
                    yield f"data: {json.dumps({'text': token})}\n\n"

                yield 'data: {"done": true}\n\n'
            except Exception as exc:
                err_msg = str(exc)
                logger.exception("Streaming error: %s", err_msg)
                yield f"data: {json.dumps({'error': err_msg})}\n\n"
                raise

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream; charset=utf-8",
            headers={"Cache-Control": "no-store"},
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Error in message endpoint: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to process message: {str(e)}"
        )


@router.post("/continue")
async def continue_attempt(
    attempt_id: str = Form(...),
    chat_id: str = Form(...),
    test_data: Optional[bool] = Form(False),
    session: Session = Depends(get_session),
):
    """
    This endpoint is used to continue an attempt, which should be called when a chat is ended.
    """
    try:
        # get the chat
        chat = session.exec(
            select(SimulationChats).where(SimulationChats.id == chat_id)
        ).one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        # Get the attempt
        attempt = session.exec(
            select(Attempts).where(Attempts.id == attempt_id)
        ).one_or_none()
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found")

        # get the simulation
        simulation = session.exec(
            select(Simulations).where(Simulations.id == attempt.simulation_id)
        ).one_or_none()
        if not simulation:
            raise HTTPException(status_code=404, detail="Simulation not found")

        # get all the scenarios for this simulation and filter out invalid ones
        scenario_ids = simulation.scenario_ids or []

        # Find the current scenario index and get the next one
        current_scenario_id = chat.scenario_id
        if current_scenario_id not in scenario_ids:
            raise HTTPException(
                status_code=400, detail="Current scenario not found in simulation"
            )

        current_index = scenario_ids.index(current_scenario_id)
        next_index = current_index + 1

        # do not continue if we do not have any scenarios left
        next_chat_id = chat_id
        if next_index < len(scenario_ids):
            next_scenario_id = scenario_ids[next_index]
            next_scenario = session.exec(
                select(Scenarios).where(Scenarios.id == next_scenario_id)
            ).one_or_none()
            if not next_scenario:
                raise HTTPException(status_code=404, detail="Next scenario not found")

            # if no scenario_id, create a new one
            if not next_scenario.scenario_id:
                scenario_id, chat_title = await run_scenario_agent(
                    agent_id=next_scenario.agent_id,
                    user_id=attempt.user_id,
                    class_id=attempt.class_id,
                    test_data=test_data,
                    session=session,
                )
            else:
                scenario_id = next_scenario.id
                # Use agent name for title if available
                agent = session.exec(
                    select(Agents).where(Agents.id == next_scenario.agent_id)
                ).one_or_none()
                if agent:
                    chat_title = f"{agent.name} Student Session"
                else:
                    chat_title = "Practice Session"

            # Create the chat with the scenario and link it to this attempt
            next_chat = SimulationChats(
                title=chat_title,
                scenario_id=scenario_id,
                attempt_id=attempt_id,
                completed=False,
            )

            # Add and commit the new chat to the database
            session.add(next_chat)
            session.commit()
            session.refresh(next_chat)
            next_chat_id = next_chat.id

        # Run logic to end the current chat
        rubric_id = await run_grading_agent(chat_id, test_data, session)
        
        rubric_id = await run_evaluate_agent(chat_id, test_data, session)

        return {
            "success": True,
            "message": "Chat ended successfully",
            "chat_id": str(next_chat_id),
            "rubric_id": rubric_id,
            "completed": next_chat_id == chat_id,
        }

    except Exception as e:
        session.rollback()
        logger.error(f"Error continuing attempt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to continue attempt: {str(e)}")

@router.post("/ai-conversation")
async def start_ai_conversation(
    chat_id: str = Form(...),
    test_data: Optional[bool] = Form(False),
    session: Session = Depends(get_session),
):
    """
    Start an AI-to-AI conversation between Generic and GTA agents.
    """
    try:
        chat = session.exec(select(Chats).where(Chats.id == chat_id)).one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        # Check if chat is completed
        if chat.completed:
            raise HTTPException(status_code=400, detail="Cannot start AI conversation on completed chat")

        async def event_stream() -> AsyncIterator[str]:
            yield ":\n\n"

            try:
                # Start conversation with "Hello, how are you?" from GTA to Generic
                current_message = "Hello, how are you?"
                sender = "GTA"
                
                for i in range(8):  # Changed from 10 to 8 messages
                    yield f"data: {json.dumps({'sender': sender, 'message': current_message, 'message_number': i + 1})}\n\n"
                    
                    # Get response from the appropriate agent
                    if sender == "GTA":
                        # GTA is asking, Generic responds
                        response = ""
                        async for token in run_generic_agent(
                            chat_id=chat_id, 
                            input_text=current_message, 
                            session=session, 
                            test_data=test_data,
                            agent_mode="student"
                        ):
                            response += token
                        
                        current_message = response
                        sender = "Generic"
                        
                    else:
                        # Generic asked, GTA responds
                        response = ""
                        async for token in run_generic_agent(
                            chat_id=chat_id, 
                            input_text=current_message, 
                            session=session, 
                            test_data=test_data,
                            agent_mode="gta"
                        ):
                            response += token
                        
                        current_message = response
                        sender = "GTA"

                # After 8 messages, run evaluation
                logger.info(f"Starting evaluation for chat {chat_id}")
                evaluation_result = await run_evaluation_agent(chat_id, test_data, session)
                logger.info(f"Evaluation completed for chat {chat_id}: {evaluation_result}")
                
                yield f"data: {json.dumps({'evaluation': evaluation_result['evaluation'], 'done': True})}\n\n"

            except Exception as exc:
                err_msg = str(exc)
                logger.exception("AI conversation error: %s", err_msg)
                yield f"data: {json.dumps({'error': err_msg})}\n\n"
                raise

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream; charset=utf-8",
            headers={"Cache-Control": "no-store"},
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in AI conversation endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start AI conversation: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to continue attempt: {str(e)}"
        )
