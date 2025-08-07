# app/web/simulations.py

"""
WebSocket handlers for simulation chat functionality
Supports text and audio message processing with real-time streaming
"""
# Note: This file now requires``.
# Please add it to your requirements.txt.

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict

import socketio  # type: ignore
from agents import gen_trace_id
from app.db import get_session
from app.models import (Scenarios, SimulationAttempts, SimulationChats,
                        SimulationMessages, Simulations)
from app.services.agents.collection.grade import run_grade_agent
from app.services.agents.collection.scenario import run_scenario_agent
from app.services.agents.collection.simulation import (cancel_simulation_run,
                                                       run_simulation_agent)
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

        if not simulation_id:
            logger.error(f"Missing simulation_id in request from {sid}")
            await emit_error(sid, "Missing simulation_id")
            return

        # Handle empty string profile_id as None for guest mode
        if profile_id == "" or profile_id == "null":
            profile_id = None

        logger.info(
            f"Processing simulation start: simulation_id={simulation_id}, profile_id={profile_id}, sid={sid}"
        )

        # Create a new session for this operation
        db_session = next(get_session())

        try:
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
            )
            db_session.add(new_attempt)
            db_session.commit()
            db_session.refresh(new_attempt)

            logger.info(
                f"Created attempt {new_attempt.id} for simulation {simulation_id}"
            )

            # Get scenario IDs for this simulation
            scenario_ids = simulation.scenario_ids or []

            # If no scenarios are configured, pick a random scenario
            if not scenario_ids:
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
                scenario_id = scenario_ids[0]

            old_scenario = db_session.exec(
                select(Scenarios).where(Scenarios.id == scenario_id)
            ).one_or_none()

            if not old_scenario:
                await emit_error(sid, f"Scenario {scenario_id} not found")
                return

            # Randomly fill any null attributes in the scenario
            scenario = await randomly_fill_scenario_attributes(old_scenario, db_session)

            # Generate scenario description if empty
            if not scenario.description or scenario.description == "":
                name, description, trace_id = await run_scenario_agent(
                    persona_id=scenario.persona_id,
                    document_ids=scenario.document_ids,
                    parameter_item_ids=scenario.parameter_item_ids,
                    group_id=new_attempt.id,
                    session=db_session,
                )
                scenario.name = name
                scenario.description = description
                chat_title = scenario.name
            else:
                chat_title = scenario.name
                trace_id = gen_trace_id()

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

            # Attempt to cancel the simulation run
            success = cancel_simulation_run(chat_id)

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

        if not chat_id or not attempt_id:
            await emit_error(sid, "Missing chat_id or attempt_id")
            return

        # Create a new session for this operation
        db_session = next(get_session())

        try:
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

            # Get scenario IDs for this simulation
            scenario_ids = simulation.scenario_ids or []

            next_chat_id = chat_id
            if scenario_ids:
                # Count existing chats for this attempt to determine the next scenario index
                existing_chats = db_session.exec(
                    select(SimulationChats).where(
                        SimulationChats.attempt_id == attempt_id
                    )
                ).all()

                next_index = len(existing_chats)

                # Continue if we have more scenarios
                if next_index < len(scenario_ids):
                    next_scenario_id = scenario_ids[next_index]
                    old_next_scenario = db_session.exec(
                        select(Scenarios).where(Scenarios.id == next_scenario_id)
                    ).one_or_none()
                    if not old_next_scenario:
                        await emit_error(sid, "Next scenario not found")
                        return

                    # Randomly fill any null attributes in the next scenario
                    next_scenario = await randomly_fill_scenario_attributes(
                        old_next_scenario, db_session
                    )

                    # Generate scenario description if empty
                    if not next_scenario.description or next_scenario.description == "":
                        (
                            name,
                            description,
                            trace_id,
                        ) = await run_scenario_agent(
                            persona_id=next_scenario.persona_id,
                            document_ids=next_scenario.document_ids,
                            parameter_item_ids=next_scenario.parameter_item_ids,
                            group_id=attempt_id,
                            session=db_session,
                        )
                        next_scenario.name = name
                        next_scenario.description = description
                        chat_title = next_scenario.name
                    else:
                        chat_title = next_scenario.name
                        trace_id = gen_trace_id()

                    db_session.add(next_scenario)
                    db_session.commit()
                    db_session.refresh(next_scenario)

                    # Create the next chat
                    next_chat = SimulationChats(
                        created_at=datetime.now(timezone.utc),
                        title=chat_title,
                        scenario_id=next_scenario.id,
                        attempt_id=attempt_id,
                        completed=False,
                        trace_id=trace_id,
                    )

                    db_session.add(next_chat)
                    db_session.commit()
                    db_session.refresh(next_chat)
                    next_chat_id = next_chat.id

            # Check if this chat has at least 2 messages before running grading
            messages = db_session.exec(
                select(SimulationMessages).where(SimulationMessages.chat_id == chat_id)
            ).all()

            # Explicitly define which chat was completed and which is next
            completed_chat_id = chat_id
            new_chat_id = next_chat_id
            is_attempt_finished = new_chat_id == completed_chat_id

            # Only run grading if chat has at least 2 messages
            simulation_grade_id = None
            if len(messages) >= 2:
                simulation_grade_id = await run_grade_agent(completed_chat_id, db_session)

            # Mark the current chat as completed
            chat.completed = True
            chat.completed_at = datetime.now(timezone.utc)
            db_session.add(chat)
            db_session.commit()

            if end_all:
                # Handle end all functionality - create all remaining chats
                await _handle_end_all_remaining_chats(
                    sid, attempt_id, scenario_ids, db_session
                )
            else:
                # Emit the new, more descriptive success response for single chat
                sio_instance = get_sio_instance()
                await sio_instance.emit(
                    "simulation_continued",
                    {
                        "success": True,
                        "message": "Simulation continued successfully",
                        "completed_chat_id": str(completed_chat_id),
                        "next_chat_id": str(new_chat_id),
                        "is_attempt_finished": is_attempt_finished,
                        "simulation_grade_id": simulation_grade_id,
                    },
                    room=sid,
                )

                logger.info(
                    f"Simulation continued successfully: completed_chat={completed_chat_id}, next_chat={new_chat_id}"
                )

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error continuing simulation for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to continue simulation: {str(e)}")


async def _handle_end_all_remaining_chats(
    sid: str,
    attempt_id: str,
    scenario_ids: list[uuid.UUID],
    db_session: Session,
) -> None:
    """
    Handle creating all remaining chats and marking them as completed
    """
    # Get all existing chats for this attempt
    existing_chats = db_session.exec(
        select(SimulationChats).where(SimulationChats.attempt_id == attempt_id)
    ).all()

    # End all existing incomplete chats
    for chat in existing_chats:
        if not chat.completed:
            # Check message count for each chat
            messages = db_session.exec(
                select(SimulationMessages).where(SimulationMessages.chat_id == chat.id)
            ).all()

            if len(messages) >= 2:
                # Run grading for chats with sufficient messages
                await run_grade_agent(chat.id, db_session)

            # Mark chat as completed
            chat.completed = True
            chat.completed_at = datetime.now(timezone.utc)
            db_session.add(chat)

    # Create remaining chats and mark them as completed
    existing_scenario_ids = [chat.scenario_id for chat in existing_chats]
    remaining_scenario_ids = [sid for sid in scenario_ids if sid not in existing_scenario_ids]

    for i, scenario_id in enumerate(remaining_scenario_ids):
        chat_index = len(existing_chats) + i + 1
        new_chat = SimulationChats(
            title=f"Scenario {chat_index}",
            scenario_id=scenario_id,
            attempt_id=attempt_id,
            completed=True,
            completed_at=datetime.now(timezone.utc),
        )
        db_session.add(new_chat)

    # Commit all changes
    db_session.commit()

    # Emit end all completed event
    sio_instance = get_sio_instance()
    await sio_instance.emit(
        "end_all_completed",
        {
            "success": True,
            "message": f"Ended {len(existing_chats)} existing chats and created {len(remaining_scenario_ids)} new completed chats",
            "attempt_id": attempt_id,
        },
        room=sid,
    )

    logger.info(f"End all completed for attempt {attempt_id}")


async def process_simulation_message_websocket(
    chat_id: uuid.UUID,
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
            async for token in run_simulation_agent(chat_id, db_session):
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
