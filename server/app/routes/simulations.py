# app/routes/simulation_attempts.py
import json
import logging
import random
import uuid
from datetime import datetime, timezone
from typing import AsyncIterator, Optional

from app.db import get_session
from app.models import (Scenarios, SimulationAttempts, SimulationChats,
                        Simulations)
from app.services.agents.collection.grade import run_grade_agent
from app.services.agents.collection.scenario import run_scenario_agent
from app.services.agents.collection.simulation import run_simulation_agent
from app.utils.scenario import randomly_fill_scenario_attributes
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/start")
async def start_attempt(
    simulation_id: uuid.UUID = Form(...),
    profile_id: Optional[uuid.UUID] = Form(None),
    session: Session = Depends(get_session),
) -> JSONResponse:
    """
    This endpoint creates a new attempt and associated chats based on a simulation.
    For guest mode, profile_id can be None or empty string.
    Handles both permanent individual practice simulations and dynamic quiz simulations.
    """
    try:
        # Handle empty string profile_id as None for guest mode
        if profile_id == "" or profile_id == "null":
            profile_id = None

        # Get the simulation
        simulation = session.exec(
            select(Simulations).where(Simulations.id == simulation_id)
        ).one_or_none()
        if not simulation:
            raise HTTPException(status_code=404, detail="Simulation not found")

        # Create the attempt
        new_attempt = SimulationAttempts(
            profile_id=profile_id,  # Will be None for guest mode
            simulation_id=simulation_id,
        )
        session.add(new_attempt)
        session.commit()
        session.refresh(new_attempt)

        logger.info(f"Created attempt {new_attempt.id} for simulation {simulation_id}")

        # Get scenario IDs for this simulation and filter out invalid ones
        scenario_ids = simulation.scenario_ids or []

        # If no scenarios are configured, pick a random scenario from all available scenarios
        if not scenario_ids:
            logger.info(
                f"No scenarios configured for simulation {simulation_id}, selecting random scenario"
            )
            all_scenarios = session.exec(select(Scenarios)).all()
            if not all_scenarios:
                raise HTTPException(
                    status_code=400, detail="No scenarios available in the system"
                )
            # Pick a random scenario
            import random

            random_scenario = random.choice(all_scenarios)
            scenario_id = random_scenario.id
            logger.info(
                f"Selected random scenario {scenario_id} for simulation {simulation_id}"
            )
        else:
            # Get the first scenario from the configured list
            scenario_id = scenario_ids[0]
        old_scenario = session.exec(
            select(Scenarios).where(Scenarios.id == scenario_id)
        ).one_or_none()

        if not old_scenario:
            raise HTTPException(
                status_code=400, detail=f"Scenario {scenario_id} not found"
            )

        # First, randomly fill any null attributes in the scenario
        scenario = await randomly_fill_scenario_attributes(old_scenario, session)

        # if the scenario description is empty, we need to run the scenario agent to create a new scenario, and then link it to this chat
        if not scenario.description or scenario.description == "":
            name, description, trace_id = await run_scenario_agent(
                agent_id=scenario.agent_id,
                class_id=scenario.class_id,
                document_ids=scenario.documents,
                seniority=scenario.seniority,
                crowdedness=scenario.crowdedness,
                intensity=scenario.intensity,
                group_id=new_attempt.id,
                session=session,
            )

            scenario.name = name
            scenario.description = description

            chat_title = scenario.name
        else:
            chat_title = scenario.name
            trace_id = None

        session.add(scenario)
        session.commit()
        session.refresh(scenario)

        scenario_id = scenario.id

        # Create the chat with the scenario and link it to this attempt
        chat = SimulationChats(
            created_at=datetime.now(timezone.utc),
            title=chat_title,
            scenario_id=scenario_id,  # Use the scenario's primary key
            attempt_id=new_attempt.id,
            completed=False,
            trace_id=trace_id,
        )

        session.add(chat)
        session.commit()
        session.refresh(chat)

        return JSONResponse(
            status_code=200,
            content={
            "success": True,
            "message": "Attempt started successfully",
            "attempt_id": str(new_attempt.id),
            "chat_id": str(chat.id),
            }
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        logger.error(f"Error starting attempt: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to start attempt: {str(e)}"
        )


@router.post("/message")
async def message(
    chat_id: uuid.UUID = Form(...),
    message: str = Form(...),
    session: Session = Depends(get_session),
) -> StreamingResponse:
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
                async for token in run_simulation_agent(
                    chat_id=chat_id,
                    input_text=message,
                    session=session,
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
    attempt_id: uuid.UUID = Form(...),
    chat_id: uuid.UUID = Form(...),
    session: Session = Depends(get_session),
) -> JSONResponse:
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
        simulation_attempt = session.exec(
            select(SimulationAttempts).where(SimulationAttempts.id == attempt_id)
        ).one_or_none()
        if not simulation_attempt:
            raise HTTPException(status_code=404, detail="Attempt not found")

        # get the simulation
        simulation = session.exec(
            select(Simulations).where(
                Simulations.id == simulation_attempt.simulation_id
            )
        ).one_or_none()
        if not simulation:
            raise HTTPException(status_code=404, detail="Simulation not found")

        # get all the scenarios for this simulation and filter out invalid ones
        scenario_ids = simulation.scenario_ids or []

        # If no scenarios are configured, this was a random scenario selection
        # In this case, we don't continue to another scenario
        next_chat_id: uuid.UUID = chat_id
        if not scenario_ids:
            logger.info(
                f"No scenarios configured for simulation {simulation.id}, ending attempt"
            )
        else:
            # Count existing chats for this attempt to determine the next scenario index
            existing_chats = session.exec(
                select(SimulationChats).where(SimulationChats.attempt_id == attempt_id)
            ).all()

            # The next index is the count of existing chats (0-based indexing)
            next_index = len(existing_chats)

            # do not continue if we do not have any scenarios left
            if next_index < len(scenario_ids):
                next_scenario_id = scenario_ids[next_index]
                old_next_scenario = session.exec(
                    select(Scenarios).where(Scenarios.id == next_scenario_id)
                ).one_or_none()
                if not old_next_scenario:
                    raise HTTPException(
                        status_code=404, detail="Next scenario not found"
                    )

                # Randomly fill any null attributes in the next scenario
                next_scenario = await randomly_fill_scenario_attributes(
                    old_next_scenario, session
                )

                # if the scenario description is empty, we need to run the scenario agent to create a new scenario, and then link it to this chat
                if not next_scenario.description or next_scenario.description == "":
                    name, description, trace_id = await run_scenario_agent(
                        agent_id=next_scenario.agent_id,
                        class_id=next_scenario.class_id,
                        document_ids=next_scenario.documents,
                        seniority=next_scenario.seniority,
                        crowdedness=next_scenario.crowdedness,
                        intensity=next_scenario.intensity,
                        group_id=attempt_id,
                        session=session,
                    )

                    next_scenario.name = name
                    next_scenario.description = description

                    chat_title = next_scenario.name
                else:
                    chat_title = next_scenario.name
                    trace_id = None

                session.add(next_scenario)
                session.commit()
                session.refresh(next_scenario)

                next_scenario_id = next_scenario.id

                # Create the chat with the scenario and link it to this attempt
                next_chat = SimulationChats(
                    created_at=datetime.now(timezone.utc),
                    title=chat_title,
                    scenario_id=next_scenario_id,  # Use the scenario's primary key
                    attempt_id=attempt_id,
                    completed=False,
                    trace_id=trace_id,
                )

                # Add and commit the new chat to the database
                session.add(next_chat)
                session.commit()
                session.refresh(next_chat)
                next_chat_id = next_chat.id

        # Run logic to end the current chat
        simulation_grade_id = await run_grade_agent(chat_id, session)

        return JSONResponse(
            status_code=200,
            content={
            "success": True,
            "message": "Chat ended successfully",
            "chat_id": str(next_chat_id),
            "simulation_grade_id": simulation_grade_id,
            "completed": next_chat_id == chat_id,
            }
        )

    except HTTPException:
        # Re-raise HTTP exceptions as-is
        session.rollback()
        raise
    except Exception as e:
        session.rollback()
        logger.error(f"Error continuing attempt: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to continue attempt: {str(e)}"
        )
