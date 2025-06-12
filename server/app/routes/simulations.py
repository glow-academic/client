# app/routes/simulation_attempts.py
from fastapi import APIRouter, Form, HTTPException, Depends
from app.models import (
    SimulationAttempts,
    Simulations,
    SimulationChats,
    Agents,
    Scenarios,
    Classes,
    Documents,
)
from app.db import get_session
from sqlmodel import Session, select
import logging
from typing import Optional
import random
from datetime import datetime, timezone
from app.services.agents.grade import run_grade_agent
from app.services.agents.generic import run_generic_agent
from app.services.agents.scenario import run_scenario_agent
from fastapi.responses import StreamingResponse
import json
from typing import AsyncIterator

logger = logging.getLogger(__name__)

router = APIRouter()


async def randomly_fill_scenario_attributes(
    scenario: Scenarios, session: Session
) -> Scenarios:
    """
    Randomly fill null attributes of a scenario with available options from the database.

    Args:
        scenario: The scenario object with potentially null attributes
        session: Database session

    Returns:
        Updated scenario object with randomly selected values for null attributes
    """
    # Random agent selection if agent_id is null
    if scenario.agent_id is None:
        all_agents = session.exec(select(Agents)).all()
        if all_agents:
            scenario_agent_id = random.choice(all_agents).id
            logger.info(f"Randomly selected agent_id: {scenario_agent_id}")
    else:
        scenario_agent_id = scenario.agent_id

    # Random class selection if class_id is null
    if scenario.class_id is None:
        all_classes = session.exec(select(Classes)).all()
        if all_classes:
            scenario_class_id = random.choice(all_classes).id
            logger.info(f"Randomly selected class_id: {scenario_class_id}")
    else:
        scenario_class_id = scenario.class_id

    # Random document selection if documents is null
    if scenario.documents is None:
        # Get all documents, optionally filtered by class if we have one
        if scenario_class_id:
            class_documents = session.exec(
                select(Documents).where(Documents.class_id == scenario_class_id)
            ).all()
        else:
            class_documents = session.exec(select(Documents)).all()

        if class_documents:
            # Randomly select 0-3 documents
            num_docs = random.randint(0, min(3, len(class_documents)))
            if num_docs > 0:
                selected_docs = random.sample(class_documents, num_docs)
                scenario_documents = [doc.id for doc in selected_docs]
                logger.info(
                    f"Randomly selected {num_docs} documents: {scenario_documents}"
                )
            else:
                scenario_documents = []
                logger.info("Randomly selected 0 documents (empty list)")
        else:
            scenario_documents = []
            logger.info("No documents found")
    else:
        scenario_documents = scenario.documents

    # Random seniority selection if seniority is null
    if scenario.seniority is None:
        seniority_options = ["freshman", "sophomore", "junior", "senior"]
        scenario_seniority = random.choice(seniority_options)
        logger.info(f"Randomly selected seniority: {scenario_seniority}")
    else:
        scenario_seniority = scenario.seniority

    # Random crowdedness selection if crowdedness is null (1-10 scale)
    if scenario.crowdedness is None:
        scenario_crowdedness = random.randint(1, 10)
        logger.info(f"Randomly selected crowdedness: {scenario_crowdedness}")
    else:
        scenario_crowdedness = scenario.crowdedness

    # Random intensity selection if intensity is null (1-10 scale)
    if scenario.intensity is None:
        scenario_intensity = random.randint(1, 10)
        logger.info(f"Randomly selected intensity: {scenario_intensity}")
    else:
        scenario_intensity = scenario.intensity

    return Scenarios(
        name=scenario.name,
        description=scenario.description,
        agent_id=scenario_agent_id,
        class_id=scenario_class_id,
        documents=scenario_documents,
        seniority=scenario_seniority,
        crowdedness=scenario_crowdedness,
        intensity=scenario_intensity,
    )


@router.post("/start")
async def start_attempt(
    simulation_id: str = Form(...),
    profile_id: Optional[str] = Form(None),
    session: Session = Depends(get_session),
):
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

        # Use agent-specific default titles for simulations
        agent = session.exec(
            select(Agents).where(Agents.id == scenario.agent_id)
        ).one_or_none()
        if agent:
            chat_title = f"{agent.name} Student Session"
        else:
            chat_title = "Practice Session"

        # if the scenario description is empty, we need to run the scenario agent to create a new scenario, and then link it to this chat
        if not scenario.description or scenario.description == "":
            name, description = await run_scenario_agent(
                agent_id=scenario.agent_id,
                class_id=scenario.class_id,
                document_ids=scenario.documents,
                seniority=scenario.seniority,
                crowdedness=scenario.crowdedness,
                intensity=scenario.intensity,
                session=session,
            )

            scenario.name = name
            scenario.description = description

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
    chat_id: str = Form(...),
    message: str = Form(...),
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
        if not scenario_ids:
            logger.info(
                f"No scenarios configured for simulation {simulation.id}, ending attempt"
            )
            next_chat_id = chat_id
        else:
            # Count existing chats for this attempt to determine the next scenario index
            existing_chats = session.exec(
                select(SimulationChats).where(SimulationChats.attempt_id == attempt_id)
            ).all()

            # The next index is the count of existing chats (0-based indexing)
            next_index = len(existing_chats)

            # do not continue if we do not have any scenarios left
            next_chat_id = chat_id
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

                # Use agent name for title if available
                agent = session.exec(
                    select(Agents).where(Agents.id == next_scenario.agent_id)
                ).one_or_none()
                if agent:
                    chat_title = f"{agent.name} Student Session"
                else:
                    chat_title = "Practice Session"

                # if the scenario description is empty, we need to run the scenario agent to create a new scenario, and then link it to this chat
                if not next_scenario.description or next_scenario.description == "":
                    name, description = await run_scenario_agent(
                        agent_id=next_scenario.agent_id,
                        class_id=next_scenario.class_id,
                        document_ids=next_scenario.documents,
                        seniority=next_scenario.seniority,
                        crowdedness=next_scenario.crowdedness,
                        intensity=next_scenario.intensity,
                        session=session,
                    )

                    next_scenario.name = name
                    next_scenario.description = description

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
                )

                # Add and commit the new chat to the database
                session.add(next_chat)
                session.commit()
                session.refresh(next_chat)
                next_chat_id = next_chat.id

        # Run logic to end the current chat
        rubric_id = await run_grade_agent(chat_id, session)

        return {
            "success": True,
            "message": "Chat ended successfully",
            "chat_id": str(next_chat_id),
            "rubric_id": rubric_id,
            "completed": next_chat_id == chat_id,
        }

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
