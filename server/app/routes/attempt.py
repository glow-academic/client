# app/routes/attempt.py
from fastapi import APIRouter, Form, HTTPException, Depends
from app.models import Attempts, Simulations, Chats, Agents, Interactions, Classes, Scenarios
from app.db import get_session
from sqlmodel import Session, select
import logging
from app.agents.scenario import run_scenario_agent
from typing import List, Optional
import random

from app.agents.evaluate import run_evaluate_agent
from app.agents.generic import run_generic_agent
from fastapi.responses import StreamingResponse
import json
from typing import AsyncIterator, Optional

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/start")
async def start_attempt(
    simulation_id: str = Form(...),
    user_id: Optional[str] = Form(None), 
    class_id: str = Form(...),
    test_data: Optional[bool] = Form(False),
    session: Session = Depends(get_session),
):
    """
    This endpoint creates a new attempt and associated chats based on a simulation.
    For guest mode, user_id can be None or empty string.
    Handles both permanent individual practice simulations and dynamic quiz simulations.
    """
    try:
        # Get the simulation
        simulation = session.exec(select(Simulations).where(Simulations.id == simulation_id)).one_or_none()
        if not simulation:
            raise HTTPException(status_code=404, detail="Simulation not found")
        
        # Create the attempt
        new_attempt = Attempts(
            user_id=user_id,  # Will be None for guest mode
            class_id=class_id,
            simulation_id=simulation_id
        )
        session.add(new_attempt)
        session.commit()
        session.refresh(new_attempt)
        
        logger.info(f"Created attempt {new_attempt.id} for simulation {simulation_id}")
        
        # Get interaction IDs for this simulation and filter out invalid ones
        interaction_ids = simulation.interaction_ids or []
        
        if not interaction_ids:
            raise HTTPException(status_code=400, detail="Simulation has no valid interactions configured")
        
        # Create the first interaction
        interaction_id = interaction_ids[0]
        interaction = session.exec(
            select(Interactions).where(Interactions.id == interaction_id)
        ).one_or_none()
        
        if not interaction:
            raise HTTPException(status_code=400, detail=f"Interaction {interaction_id} not found")
        
        # Handle scenario creation or selection
        if not interaction.scenario_id:
            scenario_id, chat_title = await run_scenario_agent(
                agent_id=interaction.agent_id,
                user_id=user_id,  # Pass actual_user_id (can be None for guest)
                class_id=class_id,
                test_data=test_data,
                session=session
            )
        else:
            scenario_id = interaction.scenario_id
            # Use agent-specific default titles for permanent simulations
            agent = session.exec(select(Agents).where(Agents.id == interaction.agent_id)).one_or_none()
            if agent:
                chat_title = f"{agent.name} Student Session"
            else:
                chat_title = "Practice Session"

        # Handle agent selection
        if not interaction.agent_id:
            # get all agents
            agents = session.exec(select(Agents)).all()
            if not agents:
                raise HTTPException(status_code=400, detail="No agents found")
            agent_id = random.choice(agents).id
        else:
            agent_id = interaction.agent_id

        # Create the chat with the scenario and link it to this attempt
        chat = Chats(
            title=chat_title,
            scenario_id=scenario_id,
            agent_id=agent_id,
            interaction_id=interaction_id,
            attempt_id=new_attempt.id,
            completed=False
        )

        session.add(chat)
        session.commit()
        session.refresh(chat)
        
        return {
            "success": True,
            "message": "Attempt started successfully",
            "attempt_id": str(new_attempt.id),
            "chat_id": str(chat.id)
        }
        
    except Exception as e:
        session.rollback()
        logger.error(f"Error starting attempt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start attempt: {str(e)}")

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
        chat = session.exec(select(Chats).where(Chats.id == chat_id)).one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        # Check if chat is completed
        if chat.completed:
            raise HTTPException(status_code=400, detail="Cannot send messages to completed chat")

        async def event_stream() -> AsyncIterator[str]:
            # initial heartbeat so proxies flush headers
            yield ":\n\n"

            try:
                async for token in run_generic_agent(
                    chat_id=chat_id, input_text=message, session=session, test_data=test_data
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
        raise HTTPException(status_code=500, detail=f"Failed to process message: {str(e)}")



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
        chat = session.exec(select(Chats).where(Chats.id == chat_id)).one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")

        # Get the attempt
        attempt = session.exec(select(Attempts).where(Attempts.id == attempt_id)).one_or_none()
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found")
        
        # get the simulation  
        simulation = session.exec(select(Simulations).where(Simulations.id == attempt.simulation_id)).one_or_none()
        if not simulation:
            raise HTTPException(status_code=404, detail="Simulation not found")
        
        # get all the interactions for this simulation and filter out invalid ones
        interaction_ids = simulation.interaction_ids or []
        
        # Find the current interaction index and get the next one
        current_interaction_id = chat.interaction_id
        if current_interaction_id not in interaction_ids:
            raise HTTPException(status_code=400, detail="Current interaction not found in simulation")
        
        current_index = interaction_ids.index(current_interaction_id)
        next_index = current_index + 1
        
        # do not continue if we do not have any interactions left
        next_chat_id = chat_id
        if next_index < len(interaction_ids):
            next_interaction_id = interaction_ids[next_index]
            next_interaction = session.exec(select(Interactions).where(Interactions.id == next_interaction_id)).one_or_none()
            if not next_interaction:
                raise HTTPException(status_code=404, detail="Next interaction not found")
            
            # if no scenario_id, create a new one
            if not next_interaction.scenario_id:
                scenario_id, chat_title = await run_scenario_agent(
                    agent_id=next_interaction.agent_id,
                    user_id=attempt.user_id, 
                    class_id=attempt.class_id,
                    test_data=test_data,
                    session=session
                )
            else:
                scenario_id = next_interaction.scenario_id
                # Use agent name for title if available
                agent = session.exec(select(Agents).where(Agents.id == next_interaction.agent_id)).one_or_none()
                if agent:
                    chat_title = f"{agent.name} Student Session"
                else:
                    chat_title = "Practice Session"

            # if no agent_id, select a random agent
            if not next_interaction.agent_id:
                # get all agents
                agents = session.exec(select(Agents)).all()
                if not agents:
                    raise HTTPException(status_code=400, detail="No agents found for class")
                agent_id = random.choice(agents).id
            else:
                agent_id = next_interaction.agent_id

            # Create the chat with the scenario and link it to this attempt
            next_chat = Chats(
                title=chat_title,
                scenario_id=scenario_id,
                agent_id=agent_id,
                interaction_id=next_interaction_id,  # Add the missing interaction_id
                attempt_id=attempt_id,
                completed=False
            )
            
            # Add and commit the new chat to the database
            session.add(next_chat)
            session.commit()
            session.refresh(next_chat)
            next_chat_id = next_chat.id

        # Run logic to end the current chat
        rubric_id = await run_evaluate_agent(chat_id, test_data, session)
        
        return {
            "success": True,
            "message": "Chat ended successfully",
            "chat_id": str(next_chat_id),
            "rubric_id": rubric_id,
            "completed": next_chat_id == chat_id
        }
        
    except Exception as e:
        session.rollback()
        logger.error(f"Error continuing attempt: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to continue attempt: {str(e)}")