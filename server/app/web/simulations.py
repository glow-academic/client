# app/web/simulations.py

"""
WebSocket handlers for simulation chat functionality
Supports text and audio message processing with real-time streaming
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

import asyncpg  # type: ignore
import socketio  # type: ignore
from agents import gen_trace_id
from agents.exceptions import OutputGuardrailTripwireTriggered
from app.agents.collection.grade import run_grade_agent
from app.agents.collection.hint import run_hint_agent
from app.agents.collection.scenario import run_scenario_agent
from app.agents.collection.simulation import (cancel_simulation_run,
                                              run_simulation_agent)
from app.db import get_pool

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

        # Get connection pool
        pool = get_pool()
        if not pool:
            await emit_error(sid, "Database connection pool not available")
            return

        async with pool.acquire() as conn:
            # Resolve profile for guests to avoid ghost attempts
            if profile_id is None:
                from app.services.profile_service import ProfileService
                profile_service = ProfileService(conn)
                profile_id = await profile_service.get_default_guest_profile_id()
                if profile_id:
                    logger.info(
                        f"Assigning simulation attempt to default guest profile {profile_id}"
                    )
                else:
                    logger.warning(
                        "No default guest profile found; proceeding without profile_id (will create ghost attempt)"
                    )

            # Parse infinite_time_limit
            infinite_time_limit_value = (
                int(infinite_time_limit)
                if isinstance(infinite_time_limit, (int, str)) and str(infinite_time_limit).isdigit()
                else None
            )
            
            # Use service layer to create attempt and chat
            from app.services.simulation_service import SimulationService
            service = SimulationService(conn)
            
            result = await service.start_simulation_attempt(
                simulation_id=simulation_id,
                profile_id=str(profile_id) if profile_id else None,
                scenario_id_override=scenario_id_override,
                infinite=infinite,
                infinite_time_limit=infinite_time_limit_value,
                department_id=department_id,
            )

            logger.info(
                f"Created attempt {result['attempt_id']} for simulation {simulation_id}"
            )

            # Join the client to the simulation room for real-time updates
            sio_instance = get_sio_instance()
            simulation_room = f"simulation_{result['chat_id']}"
            await sio_instance.enter_room(sid, simulation_room)
            logger.info(f"Client {sid} joined simulation room {simulation_room}")

            # Emit success response
            await sio_instance.emit(
                "simulation_started",
                {
                    "success": True,
                    "message": "Simulation started successfully",
                    "attempt_id": str(result['attempt_id']),
                    "chat_id": str(result['chat_id']),
                },
                room=sid,
            )

            logger.info(
                f"Simulation started successfully for {sid}: attempt={result['attempt_id']}, chat={result['chat_id']}"
            )

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

        # Get connection pool
        pool = get_pool()
        if not pool:
            await emit_error(sid, "Database connection pool not available")
            return

        async with pool.acquire() as conn:
            # Attempt to cancel the simulation run and the in-process Runner immediately
            from app.main import cancel_active_result
            from app.services.simulation_service import SimulationService

            # Try immediate in-process cancel first
            immediate = await cancel_active_result(str(chat_id))
            # Then set cooperative cancel flag (Redis)
            success = await cancel_simulation_run(chat_id)

            # Use service layer to stop simulation and mark message complete
            service = SimulationService(conn)
            result = await service.stop_simulation_run(str(chat_id))

            sio_instance = get_sio_instance()

            if result["success"] and result["cancelled_message_id"]:
                logger.info(f"Successfully cancelled simulation run for chat {chat_id}")

                # Emit a cancellation / final content event so clients update UI
                await sio_instance.emit(
                    "simulation_message_cancelled",
                    {
                        "message_id": str(result["cancelled_message_id"]),
                        "chat_id": str(chat_id),
                        "final_content": result["final_content"],
                    },
                    room=f"simulation_{chat_id}",
                )

                # Emit stop signal
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

        # Get connection pool
        pool = get_pool()
        if not pool:
            await emit_error(sid, "Database connection pool not available")
            return

        async with pool.acquire() as conn:
            # Use service layer to continue simulation
            from app.services.simulation_service import SimulationService
            service = SimulationService(conn)

            sio_instance = get_sio_instance()
            result = await service.continue_simulation_attempt(
                chat_id=str(chat_id),
                attempt_id=str(attempt_id),
                department_id=str(department_id),
                end_all=end_all,
                sio_instance=sio_instance,
            )

            if end_all:
                logger.info(
                    f"End all completed for attempt {attempt_id}: created {result['created_chats_count']} new chats"
                    )

                # Emit end all completed event
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
            else:
                # Emit the new, more descriptive success response for single chat
                payload = {
                    "success": True,
                    "message": "Simulation continued successfully",
                    "completed_chat_id": str(result["completed_chat_id"]),
                    "next_chat_id": str(result["next_chat_id"]),
                    "is_attempt_finished": result["is_attempt_finished"],
                    "simulation_grade_id": result["simulation_grade_id"],
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
                    f"Simulation continued successfully: completed_chat={result['completed_chat_id']}, next_chat={result['next_chat_id']}"
                )

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
    pool = get_pool()
    if not pool:
        logger.error("Database connection pool not available for hint generation")
        return
        
    async with pool.acquire() as conn:
        try:
            logger.info(f"Background hint generation started for message {message_id}")
            hint_ids = await run_hint_agent(
                chat_id=chat_id,
                message_id=message_id,
                department_id=department_id,
                conn=conn,
                sio_instance=sio_instance,
            )
            logger.info(f"Background hint generation completed: {len(hint_ids)} hints created")
        except Exception as e:
            logger.error(f"Background hint generation failed for message {message_id}: {e}", exc_info=True)


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

    # Get connection pool
    pool = get_pool()
    if not pool:
        raise ValueError("Database connection pool not available")

    async with pool.acquire() as conn:
        try:
            # Use service layer for database operations
            from app.services.simulation_service import SimulationService
            service = SimulationService(conn)

            # 1. Add the user message to the chat (skip if this is a retry)
            sio_instance = get_sio_instance()
            if message and message.strip() != "" and not is_retry:
                user_message = await service.create_user_message(str(chat_id), message)

                # 2. Emit user message to connected clients
                logger.info(f"Emitting user message to room simulation_{chat_id}")
                await sio_instance.emit(
                    "simulation_new_message",
                    {
                        "message_id": str(user_message['id']),
                        "chat_id": str(chat_id),
                        "role": "user",
                        "content": message,
                        "completed": True,
                        "created_at": user_message['created_at'].isoformat(),
                    },
                    room=f"simulation_{chat_id}",
                )
            elif is_retry:
                logger.info(f"Skipping user message creation for retry in chat {chat_id}")

            # 3. Create placeholder assistant message
            assistant_message = await service.create_assistant_message_placeholder(str(chat_id))

            # 4. Emit placeholder assistant message
            logger.info(f"Emitting assistant placeholder to room simulation_{chat_id}")
            await sio_instance.emit(
                "simulation_new_message",
                {
                    "message_id": str(assistant_message['id']),
                    "chat_id": str(chat_id),
                    "role": "assistant",
                    "content": "",
                    "completed": False,
                    "created_at": assistant_message['created_at'].isoformat(),
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

                async for token in run_simulation_agent(chat_id, department_id, conn):  # type: ignore[arg-type]
                    # Check cancellation BEFORE processing this token to avoid emitting it
                    try:
                        run_id = await get_active_run(str(chat_id))
                        if run_id and await is_run_cancelled(run_id):
                            cancelled = True
                            await service.complete_message(str(assistant_message['id']))
                            break
                    except Exception:
                        pass

                    # Regular content token
                    accumulated_content += token

                    # Update the database with accumulated content
                    await service.update_message_content(str(assistant_message['id']), accumulated_content)

                    logger.info(
                        f"Emitting token to room simulation_{chat_id}: {token[:20]}..."
                    )
                    await sio_instance.emit(
                        "simulation_message_token",
                        {
                            "message_id": str(assistant_message['id']),
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
                await service.complete_message(str(assistant_message['id']), error_text)

                sio_instance = get_sio_instance()
                await sio_instance.emit(
                    "simulation_message_complete",
                    {
                        "message_id": str(assistant_message['id']),
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
                    await service.complete_message(str(assistant_message['id']), accumulated_content)

                    # Emit cancellation signal
                    logger.info(f"Emitting cancellation to room simulation_{chat_id}")
                    await sio_instance.emit(
                        "simulation_message_cancelled",
                        {
                            "message_id": str(assistant_message['id']),
                            "chat_id": str(chat_id),
                            "final_content": accumulated_content,
                        },
                        room=f"simulation_{chat_id}",
                    )
                else:
                    # Re-raise other exceptions
                    raise e

            # 6. Mark as completed
            await service.complete_message(str(assistant_message['id']))

            # 7. Emit completion signal (only if not cancelled)
            if not cancelled:
                logger.info(f"Emitting completion to room simulation_{chat_id}")
                await sio_instance.emit(
                    "simulation_message_complete",
                    {
                        "message_id": str(assistant_message['id']),
                        "chat_id": str(chat_id),
                        "final_content": accumulated_content,
                    },
                    room=f"simulation_{chat_id}",
                )
                
                # 8. Trigger hint generation for practice simulations only (fire and forget)
                # Use optimized query to get simulation metadata
                sim_metadata = await service.get_simulation_for_chat(str(chat_id))
                
                if sim_metadata['practice_simulation']:
                    logger.info(f"Triggering hint generation for practice message {assistant_message['id']}")
                    asyncio.create_task(
                        _generate_hints_background(
                            chat_id=chat_id,
                            message_id=assistant_message['id'],
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
                    await service.complete_message(str(assistant_message['id']), error_text)

                    # Emit a completion update using the same message so the client updates content
                    await sio_instance.emit(
                        "simulation_message_complete",
                        {
                            "message_id": str(assistant_message['id']),
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
