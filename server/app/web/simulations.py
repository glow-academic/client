# app/web/simulations.py

"""
WebSocket handlers for simulation chat functionality
Supports text and audio message processing with real-time streaming
"""
# Note: This file now requires``.
# Please add it to your requirements.txt.

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

import socketio  # type: ignore
from agents import gen_trace_id
from agents.exceptions import OutputGuardrailTripwireTriggered
from app.db import get_session
from app.models import (Scenarios, SimulationAttempts, SimulationChats,
                        SimulationMessages, Simulations, SimulationScenarios)
from app.services.agents.collection.grade import run_grade_agent
from app.services.agents.collection.hint import run_hint_agent
from app.services.agents.collection.scenario import run_scenario_agent
from app.services.agents.collection.simulation import (cancel_simulation_run,
                                                       run_simulation_agent)
from app.utils.guest import find_default_guest_profile
from app.utils.scenario import randomly_fill_scenario_attributes
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

# Global store for active simulation runs
active_simulation_runs: Dict[str, Any] = {}


def get_sio_instance() -> socketio.AsyncServer:
    """Get the Socket.IO server instance from main.py"""
    from app.main import get_socketio_instance

    return get_socketio_instance()


async def handle_start_simulation(sid: str, data: Dict[str, Any]) -> None:
    """
    Handle simulation start requests via WebSocket
    Replaces /simulations/start endpoint
    """
    try:
        logger.info(f"Received start_simulation request from {sid} with data: {data}")

        simulation_id = data.get("simulation_id")
        profile_id = data.get("profile_id")
        scenario_id_override = data.get("scenario_id")
        infinite = bool(data.get("infinite", False))
        infinite_time_limit = data.get("infinite_time_limit")
        department_id = data.get("department_id")

        if not simulation_id:
            logger.error(f"Missing simulation_id in request from {sid}")
            await emit_error(sid, "Missing simulation_id")
            return

        # Validate department_id is not null
        if not department_id:
            logger.error(f"Missing department_id in request from {sid}")
            await emit_error(sid, "Missing department_id - please refresh the page")
            return

        # If the client indicates guest (empty/"null"/None), register under default guest profile
        if profile_id == "" or profile_id == "null" or profile_id is None:
            profile_id = None  # normalize before DB lookup

        logger.info(
            f"Processing simulation start: simulation_id={simulation_id}, profile_id={profile_id}, sid={sid}"
        )

        # Create a new session for this operation
        db_session = next(get_session())

        try:
            # Resolve profile for guests to avoid ghost attempts
            if profile_id is None:
                default_guest = find_default_guest_profile(db_session)
                if default_guest is not None:
                    profile_id = default_guest.id
                    logger.info(
                        f"Assigning simulation attempt to default guest profile {profile_id}"
                    )
                else:
                    logger.warning(
                        "No default guest profile found; proceeding without profile_id (will create ghost attempt)"
                    )

            # Get the simulation
            simulation = db_session.exec(
                select(Simulations).where(Simulations.id == simulation_id)
            ).one_or_none()
            if not simulation:
                await emit_error(sid, "Simulation not found")
                return

            # Create the attempt
            new_attempt = SimulationAttempts(
                profile_id=profile_id,
                simulation_id=simulation_id,
                infinite_mode=infinite,
                infinite_mode_time_limit=(
                    int(infinite_time_limit)
                    if isinstance(infinite_time_limit, (int, str)) and str(infinite_time_limit).isdigit()
                    else None
                ),
            )
            db_session.add(new_attempt)
            db_session.commit()
            db_session.refresh(new_attempt)

            logger.info(
                f"Created attempt {new_attempt.id} for simulation {simulation_id}"
            )

            # Load scenarios for this simulation from junction table
            scenario_links = db_session.exec(
                select(SimulationScenarios)
                .where(SimulationScenarios.simulation_id == simulation.id)
                .order_by("position")
            ).all()

            # If no scenarios are configured, pick a random scenario
            if scenario_id_override:
                old_scenario = db_session.exec(
                    select(Scenarios).where(Scenarios.id == scenario_id_override)
                ).one_or_none()
                if not old_scenario:
                    await emit_error(sid, f"Scenario {scenario_id_override} not found")
                    return
                chosen_scenario_id = old_scenario.id
            elif not scenario_links:
                logger.info(
                    f"No scenarios configured for simulation {simulation_id}, selecting random scenario"
                )
                all_scenarios = db_session.exec(select(Scenarios)).all()
                if not all_scenarios:
                    await emit_error(sid, "No scenarios available in the system")
                    return

                import random

                random_scenario = random.choice(all_scenarios)
                scenario_id = random_scenario.id
                logger.info(
                    f"Selected random scenario {scenario_id} for simulation {simulation_id}"
                )
            else:
                chosen_scenario_id = scenario_links[0].scenario_id

            old_scenario = db_session.exec(
                select(Scenarios).where(Scenarios.id == chosen_scenario_id)
            ).one_or_none()

            if not old_scenario:
                await emit_error(sid, f"Scenario {scenario_id} not found")
                return

            # Randomly fill any null attributes in the scenario
            scenario = await randomly_fill_scenario_attributes(old_scenario, db_session, department_id)

            # Check if we got a new scenario or the original one
            is_new_scenario = scenario.id != old_scenario.id

            # Generate scenario problem_statement if empty
            if not scenario.problem_statement or scenario.problem_statement == "":
                # Load documents and parameters from junction tables
                from app.models import (t_scenario_documents,
                                        t_scenario_parameter_items)
                from sqlalchemy import select as sa_select
                
                doc_ids = list(db_session.connection().execute(  # type: ignore
                    sa_select(t_scenario_documents.c.document_id)
                    .where(t_scenario_documents.c.scenario_id == scenario.id)
                ).scalars().all())
                
                param_ids = list(db_session.connection().execute(  # type: ignore
                    sa_select(t_scenario_parameter_items.c.parameter_item_id)
                    .where(t_scenario_parameter_items.c.scenario_id == scenario.id)
                ).scalars().all())
                
                name, description, objectives, trace_id = await run_scenario_agent(
                    department_id=department_id,
                    persona_id=scenario.persona_id,
                    document_ids=doc_ids,
                    parameter_item_ids=param_ids,
                    group_id=new_attempt.id,
                    session=db_session,
                    profile_id=new_attempt.profile_id,
                )
                scenario.name = name
                scenario.problem_statement = description
                # Note: objectives would need to be saved via scenario_objectives junction
                # but for now we skip that as client handles it
                chat_title = scenario.name
            else:
                chat_title = scenario.name
                trace_id = gen_trace_id()

            # Only add to session if it's a new scenario
            if is_new_scenario:
                db_session.add(scenario)
                db_session.commit()
                db_session.refresh(scenario)

            # Create the chat
            chat = SimulationChats(
                created_at=datetime.now(timezone.utc),
                title=chat_title,
                scenario_id=scenario.id,
                attempt_id=new_attempt.id,
                completed=False,
                trace_id=trace_id,
            )

            db_session.add(chat)
            db_session.commit()
            db_session.refresh(chat)

            # Join the client to the simulation room for real-time updates
            sio_instance = get_sio_instance()
            simulation_room = f"simulation_{chat.id}"
            await sio_instance.enter_room(sid, simulation_room)
            logger.info(f"Client {sid} joined simulation room {simulation_room}")

            # Emit success response
            await sio_instance.emit(
                "simulation_started",
                {
                    "success": True,
                    "message": "Simulation started successfully",
                    "attempt_id": str(new_attempt.id),
                    "chat_id": str(chat.id),
                },
                room=sid,
            )

            logger.info(
                f"Simulation started successfully for {sid}: attempt={new_attempt.id}, chat={chat.id}"
            )

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error starting simulation for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to start simulation: {str(e)}")


async def handle_stop_simulation(sid: str, data: Dict[str, Any]) -> None:
    """
    Handle simulation stop requests via WebSocket
    Replaces /simulations/stop endpoint
    """
    try:
        chat_id = data.get("chat_id")

        if not chat_id:
            await emit_error(sid, "Missing chat_id")
            return

        # Create a new session for this operation
        db_session = next(get_session())

        try:
            # Verify the chat exists
            chat = db_session.exec(
                select(SimulationChats).where(SimulationChats.id == chat_id)
            ).one_or_none()
            if not chat:
                await emit_error(sid, "Chat not found")
                return

            # Attempt to cancel the simulation run and the in-process Runner immediately
            from app.main import cancel_active_result

            # Try immediate in-process cancel first
            immediate = await cancel_active_result(str(chat_id))
            # Then set cooperative cancel flag (Redis)
            success = await cancel_simulation_run(chat_id)

            sio_instance = get_sio_instance()

            if success:
                logger.info(f"Successfully cancelled simulation run for chat {chat_id}")

                # Mark the most recent unfinished assistant message complete
                # Get all response messages for this chat, then sort in Python
                assistant_msgs = db_session.exec(
                    select(SimulationMessages)
                    .where(SimulationMessages.chat_id == chat_id)
                    .where(SimulationMessages.type == "response")
                ).all()
                assistant_msg = None
                if assistant_msgs:
                    assistant_msgs_sorted = sorted(
                        assistant_msgs, key=lambda m: m.created_at, reverse=True
                    )
                    assistant_msg = assistant_msgs_sorted[0]

                if assistant_msg and not assistant_msg.completed:
                    assistant_msg.completed = True
                    db_session.add(assistant_msg)
                    db_session.commit()
                    db_session.refresh(assistant_msg)

                    # Emit a cancellation / final content event so clients update UI
                    await sio_instance.emit(
                        "simulation_message_cancelled",
                        {
                            "message_id": str(assistant_msg.id),
                            "chat_id": str(chat_id),
                            "final_content": assistant_msg.content or "",
                        },
                        room=f"simulation_{chat_id}",
                    )

                # Emit stop signal (even if message was empty)
                await sio_instance.emit(
                    "simulation_stopped",
                    {
                        "chat_id": chat_id,
                        "success": True,
                        "message": "",  # Empty message, no toast
                    },
                    room=f"simulation_{chat_id}",
                )

            else:
                logger.warning(f"No active simulation run found for chat {chat_id}")
                await sio_instance.emit(
                    "simulation_stopped",
                    {
                        "chat_id": chat_id,
                        "success": False,
                        "message": "No active message found for this chat",
                    },
                    room=f"simulation_{chat_id}",
                )

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error stopping simulation for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to stop simulation: {str(e)}")


async def handle_continue_simulation(sid: str, data: Dict[str, Any]) -> None:
    """
    Handle simulation continue requests via WebSocket
    Replaces /simulations/continue endpoint
    """
    try:
        chat_id = data.get("chat_id")
        attempt_id = data.get("attempt_id")
        end_all = data.get("end_all", False)
        department_id = data.get("department_id")

        if not department_id:
            await emit_error(sid, "Missing department_id")
            return

        if not chat_id or not attempt_id:
            await emit_error(sid, "Missing chat_id or attempt_id")
            return

        # Create a new session for this operation
        db_session = next(get_session())

        try:
            # Local helpers to reduce duplication
            async def prepare_and_persist_scenario(
                old_scenario: Scenarios,
                department_id: uuid.UUID,
            ) -> Tuple[Scenarios, str, str]:
                scenario = await randomly_fill_scenario_attributes(old_scenario, db_session, department_id)
                
                # Check if we got a new scenario or the original one
                is_new_scenario = scenario.id != old_scenario.id
                
                if not scenario.problem_statement or scenario.problem_statement == "":
                    # Load documents and parameters from junction tables
                    from app.models import (t_scenario_documents,
                                            t_scenario_parameter_items)
                    from sqlalchemy import select as sa_select
                    
                    doc_ids = list(db_session.connection().execute(  # type: ignore
                        sa_select(t_scenario_documents.c.document_id)
                        .where(t_scenario_documents.c.scenario_id == scenario.id)
                    ).scalars().all())
                    
                    param_ids = list(db_session.connection().execute(  # type: ignore
                        sa_select(t_scenario_parameter_items.c.parameter_item_id)
                        .where(t_scenario_parameter_items.c.scenario_id == scenario.id)
                    ).scalars().all())
                    
                    name, description, objectives, trace_id = await run_scenario_agent(
                        department_id=scenario.department_id,
                        persona_id=scenario.persona_id,
                        document_ids=doc_ids,
                        parameter_item_ids=param_ids,
                        group_id=attempt_id,
                        session=db_session,
                        profile_id=simulation_attempt.profile_id if simulation_attempt else None,
                    )
                    scenario.name = name
                    scenario.problem_statement = description
                    # Note: objectives would need to be saved via scenario_objectives junction
                    chat_title = scenario.name
                else:
                    chat_title = scenario.name
                    trace_id = gen_trace_id()

                # Only add to session if it's a new scenario
                if is_new_scenario:
                    db_session.add(scenario)
                    db_session.commit()
                    db_session.refresh(scenario)
                return scenario, chat_title, trace_id

            async def create_chat_for_scenario_id(
                next_scenario_id: uuid.UUID, mark_completed: bool
            ) -> Optional[SimulationChats]:
                old_next_scenario = db_session.exec(
                    select(Scenarios).where(Scenarios.id == next_scenario_id)
                ).one_or_none()
                if not old_next_scenario:
                    return None

                scenario, chat_title, trace_id = await prepare_and_persist_scenario(old_next_scenario, department_id)

                next_chat = SimulationChats(
                    created_at=datetime.now(timezone.utc),
                    title=chat_title,
                    scenario_id=scenario.id,
                    attempt_id=attempt_id,
                    completed=mark_completed,
                    trace_id=trace_id,
                )
                db_session.add(next_chat)
                db_session.commit()
                db_session.refresh(next_chat)
                return next_chat

            # Get the chat
            chat = db_session.exec(
                select(SimulationChats).where(SimulationChats.id == chat_id)
            ).one_or_none()
            if not chat:
                await emit_error(sid, "Chat not found")
                return

            # Get the attempt
            simulation_attempt = db_session.exec(
                select(SimulationAttempts).where(SimulationAttempts.id == attempt_id)
            ).one_or_none()
            if not simulation_attempt:
                await emit_error(sid, "Attempt not found")
                return

            # Get the simulation
            simulation = db_session.exec(
                select(Simulations).where(
                    Simulations.id == simulation_attempt.simulation_id
                )
            ).one_or_none()
            if not simulation:
                await emit_error(sid, "Simulation not found")
                return

            # Load scenarios for this simulation from junction table
            scenario_links = db_session.exec(
                select(SimulationScenarios)
                .where(SimulationScenarios.simulation_id == simulation.id)
                .order_by("position")
            ).all()
            is_infinite_mode = bool(simulation_attempt.infinite_mode)

            # Determine how many chats already exist for this attempt
            existing_chats = db_session.exec(
                select(SimulationChats).where(
                    SimulationChats.attempt_id == attempt_id
                )
            ).all()
            next_index = len(existing_chats)

            # If not processing end_all, create the next chat
            # - Normal mode: create next chat only if we haven't exhausted scenarios
            # - Infinite mode: always create next chat by cycling through scenarios
            next_chat_id = chat_id
            if not end_all and scenario_links:
                next_scenario_id: Optional[uuid.UUID] = None
                if is_infinite_mode:
                    # Cycle through the configured scenarios indefinitely
                    num_scenarios = len(scenario_links)
                    if num_scenarios > 0:
                        cycling_index = next_index % num_scenarios
                        next_scenario_id = scenario_links[cycling_index].scenario_id
                elif next_index < len(scenario_links):
                    next_scenario_id = scenario_links[next_index].scenario_id

                if next_scenario_id is not None:
                    created_next_chat = await create_chat_for_scenario_id(
                        next_scenario_id, mark_completed=False
                    )
                    if created_next_chat is None:
                        await emit_error(sid, "Next scenario not found")
                        return
                    next_chat_id = created_next_chat.id

            # Grade the just-completed chat if it has at least 2 messages
            messages = db_session.exec(
                select(SimulationMessages).where(SimulationMessages.chat_id == chat_id)
            ).all()
            simulation_grade_id = None
            if len(messages) >= 2:
                sio_instance = get_sio_instance()
                simulation_grade_id = await run_grade_agent(chat_id, department_id, db_session, sio_instance)

            # Mark the current chat as completed
            chat.completed = True
            db_session.add(chat)
            db_session.commit()

            if end_all:
                logger.info(
                    f"End all: Starting to create remaining chats for attempt {attempt_id}"
                )

                # End any other incomplete chats for this attempt (excluding the current one we just completed)
                incomplete_chats_processed = 0
                for existing_chat in existing_chats:
                    if not existing_chat.completed and existing_chat.id != chat_id:
                        other_messages = db_session.exec(
                            select(SimulationMessages).where(
                                SimulationMessages.chat_id == existing_chat.id
                            )
                        ).all()
                        if len(other_messages) >= 2:
                            logger.info(
                                f"End all: Running grading for chat {str(existing_chat.id)}"
                            )
                            sio_instance = get_sio_instance()
                            await run_grade_agent(existing_chat.id, department_id, db_session, sio_instance)
                        existing_chat.completed = True
                        db_session.add(existing_chat)
                        incomplete_chats_processed += 1

                db_session.commit()

                # Calculate and create remaining chats in order
                created_count = 0
                start_index = len(existing_chats)
                total_needed = max(0, len(scenario_links) - start_index)
                logger.info(
                    f"End all: Need to create {total_needed} more chats"
                )

                for offset in range(total_needed):
                    next_id = scenario_links[start_index + offset].scenario_id
                    created = await create_chat_for_scenario_id(
                        next_id, mark_completed=True
                    )
                    if created is None:
                        logger.error(
                            f"End all: Next scenario not found: {next_id}"
                        )
                        break
                    created_count += 1
                    logger.info(
                        f"End all: Created chat {created.id} for scenario {start_index + offset + 1}"
                    )

                # Emit end all completed event
                sio_instance = get_sio_instance()
                payload = {
                    "success": True,
                    "message": f"Ended all chats for this attempt",
                    "attempt_id": attempt_id,
                }
                # Emit to requester
                await sio_instance.emit(
                    "end_all_completed",
                    payload,
                    room=sid,
                )
                # Also broadcast to the simulation room so watchers stay in sync
                await sio_instance.emit(
                    "end_all_completed",
                    payload,
                    room=f"simulation_{chat_id}",
                )

                logger.info(
                    f"End all completed for attempt {attempt_id}: processed {incomplete_chats_processed} incomplete chats, created {created_count} new chats"
                )
            else:
                # Emit the new, more descriptive success response for single chat
                completed_chat_id = chat_id
                new_chat_id = next_chat_id
                is_attempt_finished = new_chat_id == completed_chat_id

                sio_instance = get_sio_instance()
                payload = {
                    "success": True,
                    "message": "Simulation continued successfully",
                    "completed_chat_id": str(completed_chat_id),
                    "next_chat_id": str(new_chat_id),
                    "is_attempt_finished": is_attempt_finished,
                    "simulation_grade_id": simulation_grade_id,
                }
                # Emit to requester
                await sio_instance.emit(
                    "simulation_continued",
                    payload,
                    room=sid,
                )
                # Also broadcast to the simulation room so watchers stay in sync
                await sio_instance.emit(
                    "simulation_continued",
                    payload,
                    room=f"simulation_{chat_id}",
                )

                logger.info(
                    f"Simulation continued successfully: completed_chat={completed_chat_id}, next_chat={new_chat_id}"
                )

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error continuing simulation for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to continue simulation: {str(e)}")





async def _generate_hints_background(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    department_id: uuid.UUID,
    sio_instance: Any,
) -> None:
    """
    Background task to generate hints for a completed simulation message.
    Runs independently and emits progress via Socket.IO.
    """
    db_session = next(get_session())
    try:
        logger.info(f"Background hint generation started for message {message_id}")
        hint_ids = await run_hint_agent(
            chat_id=chat_id,
            message_id=message_id,
            department_id=department_id,
            session=db_session,
            sio_instance=sio_instance,
        )
        logger.info(f"Background hint generation completed: {len(hint_ids)} hints created")
    except Exception as e:
        logger.error(f"Background hint generation failed for message {message_id}: {e}", exc_info=True)
    finally:
        db_session.close()


async def process_simulation_message_websocket(
    chat_id: uuid.UUID,
    department_id: uuid.UUID,
    message: str = "",
    is_retry: bool = False,
) -> None:
    """
    Process a simulation message and stream the response via WebSocket
    Handles both text and audio messages with unified pipeline
    """

    # Create a new session for this async operation
    from app.db import get_session

    db_session = next(get_session())

    try:
        # get the chat
        chat = db_session.exec(
            select(SimulationChats).where(SimulationChats.id == chat_id)
        ).one_or_none()
        if not chat:
            raise ValueError(f"Chat {chat_id} not found")

        # Keep existing TEXT_TEXT flow unchanged
        # 1. Add the user message to the chat (skip if this is a retry)
        sio_instance = get_sio_instance()
        if message and message.strip() != "" and not is_retry:
            user_message = SimulationMessages(
                chat_id=chat_id,
                type="query",
                content=message,
                completed=True,
            )

            db_session.add(user_message)
            db_session.commit()
            db_session.refresh(user_message)

            # 2. Emit user message to connected clients
            logger.info(f"Emitting user message to room simulation_{chat_id}")
            await sio_instance.emit(
                "simulation_new_message",
                {
                    "message_id": str(user_message.id),
                    "chat_id": str(chat_id),
                    "role": "user",
                    "content": message,
                    "completed": True,
                    "created_at": user_message.created_at.isoformat(),
                },
                room=f"simulation_{chat_id}",
            )
        elif is_retry:
            logger.info(f"Skipping user message creation for retry in chat {chat_id}")

        # 3. Create placeholder assistant message
        assistant_message = SimulationMessages(
            chat_id=chat_id,
            type="response",
            content="",
            completed=False,
        )
        db_session.add(assistant_message)
        db_session.commit()
        db_session.refresh(assistant_message)

        # 4. Emit placeholder assistant message
        logger.info(f"Emitting assistant placeholder to room simulation_{chat_id}")
        await sio_instance.emit(
            "simulation_new_message",
            {
                "message_id": str(assistant_message.id),
                "chat_id": str(chat_id),
                "role": "assistant",
                "content": "",
                "completed": False,
                "created_at": assistant_message.created_at.isoformat(),
            },
            room=f"simulation_{chat_id}",
        )

        logger.info(f"Processing simulation message for chat {chat_id}")

        # 5. Stream the assistant response
        accumulated_content = ""
        cancelled = False

        try:
            # Cooperative cancellation support using Redis flags
            # We poll for a cancellation flag bound to this chat's active run ID
            from app.extensions import get_active_run, is_run_cancelled

            async for token in run_simulation_agent(chat_id, department_id, db_session):
                # Check cancellation BEFORE processing this token to avoid emitting it
                try:
                    run_id = await get_active_run(str(chat_id))
                    if run_id and await is_run_cancelled(run_id):
                        cancelled = True
                        assistant_message.completed = True
                        db_session.add(assistant_message)
                        db_session.commit()
                        break
                except Exception:
                    pass

                # Regular content token
                accumulated_content += token

                # Update the database with accumulated content
                assistant_message.content = accumulated_content
                db_session.add(assistant_message)
                db_session.commit()

                logger.info(
                    f"Emitting token to room simulation_{chat_id}: {token[:20]}..."
                )
                await sio_instance.emit(
                    "simulation_message_token",
                    {
                        "message_id": str(assistant_message.id),
                        "chat_id": str(chat_id),
                        "token": token,
                        "accumulated_content": accumulated_content,
                    },
                    room=f"simulation_{chat_id}",
                )
        except OutputGuardrailTripwireTriggered as e:
            # Handle guardrail-triggered output: overwrite message with model-provided reason
            reason = ""
            try:
                reason = (
                    getattr(e, "guardrail_result", None)
                    and getattr(e.guardrail_result, "output", None)
                    and getattr(e.guardrail_result.output, "output_info", None)
                    and getattr(e.guardrail_result.output.output_info, "reason", "")
                ) or ""
            except Exception:
                reason = ""

            error_text = (
                "Error: "
                f"{reason or 'Guardrail tripwire triggered'}"
            )

            # Persist error onto the assistant message and emit completion + error
            assistant_message.content = error_text
            assistant_message.completed = True
            db_session.add(assistant_message)
            db_session.commit()

            sio_instance = get_sio_instance()
            await sio_instance.emit(
                "simulation_message_complete",
                {
                    "message_id": str(assistant_message.id),
                    "chat_id": str(chat_id),
                    "final_content": error_text,
                },
                room=f"simulation_{chat_id}",
            )

            await sio_instance.emit(
                "simulation_message_error",
                {"chat_id": str(chat_id), "error": error_text},
                room=f"simulation_{chat_id}",
            )

            # Skip later completion emission
            cancelled = True

        except Exception as e:
            if "cancelled" in str(e).lower() or "canceled" in str(e).lower():
                # Handle cancellation gracefully
                cancelled = True
                logger.info(f"Simulation run for chat {chat_id} was cancelled")

                # Keep content as-is, don't add cancellation notice
                # Mark message as completed when cancelled
                assistant_message.content = accumulated_content
                assistant_message.completed = True
                db_session.add(assistant_message)
                db_session.commit()

                # Emit cancellation signal
                logger.info(f"Emitting cancellation to room simulation_{chat_id}")
                await sio_instance.emit(
                    "simulation_message_cancelled",
                    {
                        "message_id": str(assistant_message.id),
                        "chat_id": str(chat_id),
                        "final_content": accumulated_content,
                    },
                    room=f"simulation_{chat_id}",
                )
            else:
                # Re-raise other exceptions
                raise e

        # 6. Mark as completed
        assistant_message.completed = True
        db_session.add(assistant_message)
        db_session.commit()

        # 7. Emit completion signal (only if not cancelled)
        if not cancelled:
            logger.info(f"Emitting completion to room simulation_{chat_id}")
            await sio_instance.emit(
                "simulation_message_complete",
                {
                    "message_id": str(assistant_message.id),
                    "chat_id": str(chat_id),
                    "final_content": accumulated_content,
                },
                room=f"simulation_{chat_id}",
            )
            
            # 8. Trigger hint generation for practice simulations only (fire and forget)
            # Get the simulation via attempt to check if it's a practice simulation
            attempt = db_session.exec(
                select(SimulationAttempts).where(SimulationAttempts.id == chat.attempt_id)
            ).one_or_none()
            
            if attempt:
                simulation = db_session.exec(
                    select(Simulations).where(Simulations.id == attempt.simulation_id)
                ).one_or_none()
                
                if simulation and simulation.practice_simulation:
                    logger.info(f"Triggering hint generation for practice message {assistant_message.id}")
                    asyncio.create_task(
                        _generate_hints_background(
                            chat_id=chat_id,
                            message_id=assistant_message.id,
                            department_id=department_id,
                            sio_instance=sio_instance
                        )
                    )
                else:
                    logger.debug(f"Skipping hint generation for non-practice simulation")

    except Exception as e:
        logger.error(f"Error in process_simulation_message_websocket: {str(e)}")
        sio_instance = get_sio_instance()

        # Best-effort: if we have already created a placeholder assistant message,
        # persist the error text onto it and mark it complete so the UI shows it.
        try:
            error_text = f"Error: {str(e)}"
            if "assistant_message" in locals() and assistant_message is not None:
                assistant_message.content = error_text
                assistant_message.completed = True
                db_session.add(assistant_message)
                db_session.commit()

                # Emit a completion update using the same message so the client updates content
                await sio_instance.emit(
                    "simulation_message_complete",
                    {
                        "message_id": str(assistant_message.id),
                        "chat_id": str(chat_id),
                        "final_content": error_text,
                    },
                    room=f"simulation_{chat_id}",
                )
        except Exception as persist_error:
            logger.error(
                f"Failed to persist/emit error content for chat {chat_id}: {persist_error}"
            )

        # Also emit the explicit error event for toasts/state resets
        # Only emit explicit error event if not cancelled
        if "cancelled" not in str(e).lower() and "canceled" not in str(e).lower():
            logger.info(f"Emitting error to room simulation_{chat_id}")
            await sio_instance.emit(
                "simulation_message_error",
                {"chat_id": str(chat_id), "error": str(e)},
                room=f"simulation_{chat_id}",
            )
    finally:
        db_session.close()


async def emit_error(sid: str, message: str) -> None:
    """Helper function to emit error messages to a specific client"""
    sio_instance = get_sio_instance()
    await sio_instance.emit(
        "simulation_error", {"success": False, "message": message}, room=sid
    )
    logger.error(f"Emitted error to {sid}: {message}")


def register_simulation_events(sio: socketio.AsyncServer) -> None:
    """Register all simulation WebSocket event handlers"""

    logger.info("Starting registration of simulation WebSocket event handlers")

    # Don't register connect/disconnect here as they're already handled in main.py
    # Just register simulation-specific events

    @sio.event  # type: ignore
    async def start_simulation(sid: str, data: Dict[str, Any]) -> None:
        """Start a new simulation attempt"""
        logger.info(
            f"start_simulation event triggered for sid={sid} with data keys: {list(data.keys())}"
        )
        await handle_start_simulation(sid, data)

    @sio.event  # type: ignore
    async def stop_simulation(sid: str, data: Dict[str, Any]) -> None:
        """Stop an active simulation"""
        await handle_stop_simulation(sid, data)

    @sio.event  # type: ignore
    async def continue_simulation(sid: str, data: Dict[str, Any]) -> None:
        """Continue to next chat in simulation"""
        await handle_continue_simulation(sid, data)

    logger.info("Successfully registered simulation WebSocket event handlers")
