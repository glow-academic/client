# app/web/simulations.py

"""
WebSocket handlers for simulation chat functionality
Supports text and audio message processing with real-time streaming
"""
# Note: This file now requires `webrtcvad-wheels`.
# Please add it to your requirements.txt.

import asyncio
import base64
import json
import logging
import os
import uuid
from collections import deque
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import socketio  # type: ignore
from agents import gen_trace_id, trace
from aiortc import MediaStreamTrack, RTCPeerConnection
from app.db import get_session
from app.extensions import SKETCH_FOLDER
from app.main import ServerAudioStreamTrack
from app.models import (Scenarios, SimulationAttempts, SimulationChats,
                        SimulationMessages, Simulations, SimulationSketches)
from app.services.agents.collection.grade import run_grade_agent
from app.services.agents.collection.scenario import run_scenario_agent
from app.services.agents.collection.simulation import (cancel_simulation_run,
                                                       run_simulation_agent)
from app.services.agents.voice.simulation import SimulationPipeline
from app.utils.audio import (FRAME_MS, TARGET_SR, Modalities, VadDetector,
                             resample_and_chunk_audio)
from app.utils.scenario import randomly_fill_scenario_attributes
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

# Global store for active simulation runs
active_simulation_runs: Dict[str, Any] = {}


def get_sio_instance() -> socketio.AsyncServer:
    """Get the Socket.IO server instance from main.py"""
    from app.main import get_socketio_instance

    return get_socketio_instance()


def get_profiles_and_track_class() -> tuple[dict[str, Any], type[ServerAudioStreamTrack]]:
    """Get the profiles_live dict and ServerAudioStreamTrack class from main.py"""
    from app.main import profiles_live
    return profiles_live, ServerAudioStreamTrack


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
                    agent_id=scenario.agent_id,
                    class_id=scenario.class_id,
                    document_ids=scenario.documents,
                    seniority=scenario.seniority,
                    crowdedness=scenario.crowdedness,
                    intensity=scenario.intensity,
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

                # Emit stop signal via WebSocket
                await sio_instance.emit(
                    "simulation_stopped",
                    {
                        "chat_id": chat_id,
                        "success": True,
                        "message": "Simulation stopped successfully",
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
                        "message": "No active simulation run found",
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
                            agent_id=next_scenario.agent_id,
                            class_id=next_scenario.class_id,
                            document_ids=next_scenario.documents,
                            seniority=next_scenario.seniority,
                            crowdedness=next_scenario.crowdedness,
                            intensity=next_scenario.intensity,
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

            # Explicitly define which chat was completed and which is next
            completed_chat_id = chat_id
            new_chat_id = next_chat_id
            is_attempt_finished = (new_chat_id == completed_chat_id)

            # Run grading logic for the chat that was just completed
            simulation_grade_id = await run_grade_agent(completed_chat_id, db_session)

            # Emit the new, more descriptive success response
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


async def process_simulation_message_websocket(
    chat_id: str,
    message: str = "",
    sketch_data: Optional[bytes] = None,
    audio_data: Optional[bytes] = None,
    session: Optional[Session] = None,
    profile_id: Optional[str] = None,
    assistant_audio_enabled: bool = False,  # New parameter for assistant audio preference
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
        


        if sketch_data:
            # create new sketch to get the id
            sketch = SimulationSketches(
                chat_id=chat_id,
                file_path="",
            )
            db_session.add(sketch)
            db_session.commit()
            db_session.refresh(sketch)
            
            # persist the sketch to the file system
            sketch_file_path = os.path.join(SKETCH_FOLDER, f"{sketch.id}.png")
            with open(sketch_file_path, "wb") as f:
                f.write(sketch_data)

            # update the sketch with the file path
            sketch.file_path = sketch_file_path
            db_session.add(sketch)
            db_session.commit()
            db_session.refresh(sketch)

        # Auto-determine modality based on input parameters
        has_audio_input = audio_data is not None and len(audio_data) > 0
        has_text_input = message and message.strip()
        
        if has_audio_input and assistant_audio_enabled:
            audio_mode = Modalities.AUDIO_AUDIO
        elif has_audio_input and not assistant_audio_enabled:
            audio_mode = Modalities.AUDIO_TEXT
        elif has_text_input and assistant_audio_enabled:
            audio_mode = Modalities.TEXT_AUDIO
        else:
            audio_mode = Modalities.TEXT_TEXT

        logger.info(f"Processing message with modality: {audio_mode}")

        # Use pipeline for audio modalities, keep existing flow for TEXT_TEXT
        if audio_mode != Modalities.TEXT_TEXT:
            # SPEC CHANGE: Retrieve the existing, persistent audio track
            server_audio_track = None
            
            if audio_mode in [Modalities.AUDIO_AUDIO, Modalities.TEXT_AUDIO]:
                # Get the existing peer connection
                profiles_live, _ = get_profiles_and_track_class()
                
                if profile_id and profile_id in profiles_live:
                    # Get the peer connection and extract the audio track
                    pc = profiles_live[profile_id]
                    
                    # Find the audio track from the peer connection's transceivers
                    server_audio_track = None
                    for sender in pc.getSenders():
                        if sender.track and sender.track.kind == "audio":
                            server_audio_track = sender.track
                            break
                    
                    if not server_audio_track:
                        logger.error(f"No audio track found in peer connection for profile {profile_id}")
                        return
                    logger.info(f"Retrieved persistent audio track for profile {profile_id}")
                else:
                    logger.error(f"Could not find profile or peer connection for {profile_id}")
                    return

            # Use the new audio pipeline
            pipeline = SimulationPipeline(
                chat_id=uuid.UUID(chat_id),
                mode=audio_mode,
                session=db_session,
                original_message=message,
                profile_id=profile_id
            )

            with trace(chat.title, trace_id=chat.trace_id, group_id=str(chat.attempt_id)):
                # Process through pipeline (it handles all WebSocket emissions and database operations)
                async for result in pipeline.process_and_stream(
                    audio_data=audio_data, 
                    profile_id=profile_id,
                    server_audio_track=server_audio_track  # Pass the track instance
                ):
                    # Pipeline handles everything, we just need to consume the stream
                    pass
                
        else:
            # Keep existing TEXT_TEXT flow unchanged
            # 1. Add the user message to the chat
            sio_instance = get_sio_instance()
            if message and message.strip() != "":
                user_message = SimulationMessages(
                    chat_id=chat_id, type="query", content=message, completed=True, audio=False
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
                        "audio": False,
                        "created_at": user_message.created_at.isoformat(),
                    },
                    room=f"simulation_{chat_id}",
                )

            # 3. Create placeholder assistant message
            assistant_message = SimulationMessages(
                chat_id=chat_id,
                type="response",
                content="",
                completed=False,
                audio=False,
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
                    "audio": False,
                    "created_at": assistant_message.created_at.isoformat(),
                },
                room=f"simulation_{chat_id}",
            )

            logger.info(f"Processing simulation message for chat {chat_id}")

            # 5. Stream the assistant response
            accumulated_content = ""
            cancelled = False

            try:
                async for token in run_simulation_agent(uuid.UUID(chat_id), db_session):
                    # Regular content token
                    accumulated_content += token

                    # Update the database with accumulated content
                    assistant_message.content = accumulated_content
                    db_session.add(assistant_message)
                    db_session.commit()

                    # Try data-channel first, fallback to WebSocket
                    token_sent = False
                    if profile_id:
                        from app.main import send_text_dc
                        token_sent = await send_text_dc(profile_id, {
                            "type": "token",
                            "chat_id": str(chat_id),
                            "message_id": str(assistant_message.id),
                            "token": token,
                            "accumulated_content": accumulated_content,
                        })

                    # Fallback to WebSocket if data-channel unavailable
                    if not token_sent:
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

                    # Update message content with cancellation notice
                    if not accumulated_content.strip():
                        accumulated_content = "[Simulation cancelled by user]"
                    else:
                        accumulated_content += "\n\n[Simulation cancelled by user]"

                    assistant_message.content = accumulated_content
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
                # Try data-channel first, fallback to WebSocket
                completion_sent = False
                if profile_id:
                    from app.main import send_text_dc
                    completion_sent = await send_text_dc(profile_id, {
                        "type": "complete",
                        "chat_id": str(chat_id),
                        "message_id": str(assistant_message.id),
                        "final_content": accumulated_content,
                        "audio": assistant_message.audio,
                    })

                # Fallback to WebSocket if data-channel unavailable
                if not completion_sent:
                    logger.info(f"Emitting completion to room simulation_{chat_id}")
                    await sio_instance.emit(
                        "simulation_message_complete",
                        {
                            "message_id": str(assistant_message.id),
                            "chat_id": str(chat_id),
                            "final_content": accumulated_content,
                            "audio": assistant_message.audio,
                        },
                        room=f"simulation_{chat_id}",
                    )

    except Exception as e:
        logger.error(f"Error in process_simulation_message_websocket: {str(e)}")
        sio_instance = get_sio_instance()
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


async def process_audio_stream(track: Any, chat_id: str, profile_id: str, assistant_audio_enabled: bool) -> None:
    """Process an incoming audio stream from a client with VAD."""
    # MODIFIED: Update log to show the preference being used
    logger.info(
        f"Audio processing task started for chat {chat_id} from profile {profile_id} (assistant audio: {assistant_audio_enabled})"
    )

    vad = VadDetector(TARGET_SR, FRAME_MS, vad_level=2)
    speech_buffer: deque[bytes] = deque()
    is_speaking = False
    silence_frames = 0
    silence_threshold = 25  # ~750ms of silence

    try:
        async for vad_frame in resample_and_chunk_audio(track):
            if vad.is_speech(vad_frame):
                is_speaking = True
                silence_frames = 0
                speech_buffer.append(vad_frame)
            elif is_speaking:
                silence_frames += 1
                speech_buffer.append(vad_frame)  # Buffer some silence too

                if silence_frames > silence_threshold:
                    is_speaking = False
                    silence_frames = 0

                    # Combine buffer into a single audio chunk
                    full_audio_bytes = b"".join(speech_buffer)
                    speech_buffer.clear()

                    asyncio.create_task(
                        process_simulation_message_websocket(
                            chat_id=chat_id,
                            message="",  # No text message for audio input
                            audio_data=full_audio_bytes,
                            profile_id=profile_id,
                            # MODIFIED: Use the passed-in preference instead of hardcoding
                            assistant_audio_enabled=assistant_audio_enabled,
                        )
                    )
    except Exception:
        logger.exception(
            f"Audio stream processing for chat {chat_id} crashed."
        )


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