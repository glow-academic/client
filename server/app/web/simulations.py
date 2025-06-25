# for use with the websockets

"""
WebSocket handlers for simulation chat functionality
Supports text and audio message processing with real-time streaming
"""

import asyncio
import base64
import json
import logging
import os
import tempfile
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import socketio  # type: ignore
import torch
from agents import gen_trace_id
from app.config import model_manager
from app.db import get_session
from app.extensions import AUDIO_FOLDER
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
        simulation_id = data.get('simulation_id')
        profile_id = data.get('profile_id')
        
        if not simulation_id:
            await emit_error(sid, "Missing simulation_id")
            return

        # Handle empty string profile_id as None for guest mode
        if profile_id == "" or profile_id == "null":
            profile_id = None

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

            logger.info(f"Created attempt {new_attempt.id} for simulation {simulation_id}")

            # Get scenario IDs for this simulation
            scenario_ids = simulation.scenario_ids or []

            # If no scenarios are configured, pick a random scenario
            if not scenario_ids:
                logger.info(f"No scenarios configured for simulation {simulation_id}, selecting random scenario")
                all_scenarios = db_session.exec(select(Scenarios)).all()
                if not all_scenarios:
                    await emit_error(sid, "No scenarios available in the system")
                    return
                
                import random
                random_scenario = random.choice(all_scenarios)
                scenario_id = random_scenario.id
                logger.info(f"Selected random scenario {scenario_id} for simulation {simulation_id}")
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

            # Emit success response
            sio_instance = get_sio_instance()
            await sio_instance.emit('simulation_started', {
                'success': True,
                'message': 'Simulation started successfully',
                'attempt_id': str(new_attempt.id),
                'chat_id': str(chat.id),
            }, room=sid)

            logger.info(f"Simulation started successfully for {sid}: attempt={new_attempt.id}, chat={chat.id}")

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error starting simulation for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to start simulation: {str(e)}")


async def handle_send_message(sid: str, data: Dict[str, Any]) -> None:
    """
    Handle text message sending via WebSocket
    Replaces /simulations/message endpoint
    """
    try:
        chat_id = data.get('chat_id')
        message = data.get('message')
        
        if not chat_id or not message:
            await emit_error(sid, "Missing chat_id or message")
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

            # Check if chat is completed
            if chat.completed:
                await emit_error(sid, "Cannot send messages to completed chat")
                return

            # Process the message asynchronously
            asyncio.create_task(process_simulation_message_websocket(
                chat_id=chat_id,
                message=message,
                is_audio=False,
                session=None
            ))
            
            # Emit acknowledgment
            sio_instance = get_sio_instance()
            await sio_instance.emit('message_processing', {
                'chat_id': chat_id,
                'status': 'processing',
                'message': 'Message is being processed'
            }, room=sid)

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error sending message for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to send message: {str(e)}")


async def handle_send_audio(sid: str, data: Dict[str, Any]) -> None:
    """
    Handle audio message sending via WebSocket
    Transcribes audio using Whisper and processes as text
    """
    try:
        chat_id = data.get('chat_id')
        audio_data = data.get('audio_data')  # Base64 encoded audio
        audio_format = data.get('audio_format', 'wav')  # Default to wav
        
        if not chat_id or not audio_data:
            await emit_error(sid, "Missing chat_id or audio_data")
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

            # Check if chat is completed
            if chat.completed:
                await emit_error(sid, "Cannot send messages to completed chat")
                return

            # Decode base64 audio data
            try:
                audio_bytes = base64.b64decode(audio_data)
            except Exception as e:
                await emit_error(sid, f"Invalid base64 audio data: {str(e)}")
                return

            # Save audio to temporary file for transcription
            with tempfile.NamedTemporaryFile(suffix=f'.{audio_format}', delete=False) as temp_file:
                temp_file.write(audio_bytes)
                temp_file_path = temp_file.name

            try:
                # Transcribe audio using Whisper
                whisper_model = model_manager.get_whisper_model()
                result = whisper_model.transcribe(
                    temp_file_path,
                    task='transcribe',
                    fp16=torch.cuda.is_available(),
                )
                
                transcribed_text = result['text'].strip()
                
                if not transcribed_text:
                    await emit_error(sid, "Could not transcribe audio - no text detected")
                    return

                logger.info(f"Transcribed audio for chat {chat_id}: {transcribed_text[:100]}...")

                # Process the transcribed message asynchronously
                asyncio.create_task(process_simulation_message_websocket(
                    chat_id=chat_id,
                    message=transcribed_text,
                    is_audio=True,
                    audio_data=audio_bytes,
                    session=None
                ))
                
                # Emit acknowledgment with transcription
                sio_instance = get_sio_instance()
                await sio_instance.emit('audio_transcribed', {
                    'chat_id': chat_id,
                    'transcribed_text': transcribed_text,
                    'status': 'processing',
                    'message': 'Audio transcribed and being processed'
                }, room=sid)

            finally:
                # Clean up temporary file
                try:
                    os.unlink(temp_file_path)
                except OSError:
                    pass

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error processing audio for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to process audio: {str(e)}")


async def handle_stop_simulation(sid: str, data: Dict[str, Any]) -> None:
    """
    Handle simulation stop requests via WebSocket
    Replaces /simulations/stop endpoint
    """
    try:
        chat_id = data.get('chat_id')
        
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
                await sio_instance.emit('simulation_stopped', {
                    'chat_id': chat_id,
                    'success': True,
                    'message': 'Simulation stopped successfully'
                }, room=f"simulation_{chat_id}")
                
            else:
                logger.warning(f"No active simulation run found for chat {chat_id}")
                await sio_instance.emit('simulation_stopped', {
                    'chat_id': chat_id,
                    'success': False,
                    'message': 'No active simulation run found'
                }, room=f"simulation_{chat_id}")

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
        chat_id = data.get('chat_id')
        attempt_id = data.get('attempt_id')
        
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
                select(Simulations).where(Simulations.id == simulation_attempt.simulation_id)
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
                    select(SimulationChats).where(SimulationChats.attempt_id == attempt_id)
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
                    next_scenario = await randomly_fill_scenario_attributes(old_next_scenario, db_session)

                    # Generate scenario description if empty
                    if not next_scenario.description or next_scenario.description == "":
                        name, description, trace_id = await run_scenario_agent(
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

            # Run grading logic for the current chat
            simulation_grade_id = await run_grade_agent(chat_id, db_session)

            # Emit success response
            sio_instance = get_sio_instance()
            await sio_instance.emit('simulation_continued', {
                'success': True,
                'message': 'Simulation continued successfully',
                'chat_id': str(next_chat_id),
                'simulation_grade_id': simulation_grade_id,
                'completed': next_chat_id == chat_id,
            }, room=sid)

            logger.info(f"Simulation continued successfully: next_chat={next_chat_id}, completed={next_chat_id == chat_id}")

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error continuing simulation for {sid}: {str(e)}")
        await emit_error(sid, f"Failed to continue simulation: {str(e)}")


async def process_simulation_message_websocket(
    chat_id: str, 
    message: str, 
    is_audio: bool = False,
    audio_data: Optional[bytes] = None,
    session: Optional[Session] = None
) -> None:
    """
    Process a simulation message and stream the response via WebSocket
    Handles both text and audio messages
    """
    
    # Create a new session for this async operation
    from app.db import get_session
    db_session = next(get_session())
    
    try:
        # 1. Add the user message to the chat
        user_message = SimulationMessages(
            chat_id=chat_id,
            type="query",
            content=message,
            completed=True,
            audio=is_audio
        )
        
        # Save audio file if this is an audio message
        if is_audio and audio_data:
            # Generate unique filename for audio
            audio_filename = f"{user_message.id}.wav"
            audio_filepath = os.path.join(AUDIO_FOLDER, audio_filename)
            
            # Save audio file
            with open(audio_filepath, 'wb') as f:
                f.write(audio_data)
            
            user_message.file_path = audio_filepath
            logger.info(f"Saved audio file for message {user_message.id}: {audio_filepath}")
        
        db_session.add(user_message)
        db_session.commit()
        db_session.refresh(user_message)
        
        # 2. Emit user message to connected clients
        sio_instance = get_sio_instance()
        logger.info(f"Emitting user message to room simulation_{chat_id}")
        await sio_instance.emit('new_message', {
            'message_id': str(user_message.id),
            'chat_id': str(chat_id),
            'role': 'user',
            'content': message,
            'completed': True,
            'audio': is_audio,
            'created_at': user_message.created_at.isoformat()
        }, room=f"simulation_{chat_id}")
        
        # 3. Create placeholder assistant message
        assistant_message = SimulationMessages(
            chat_id=chat_id,
            type="response",
            content="",
            completed=False,
            audio=False  # Will be updated if audio response is generated
        )
        db_session.add(assistant_message)
        db_session.commit()
        db_session.refresh(assistant_message)
        
        # 4. Emit placeholder assistant message
        logger.info(f"Emitting assistant placeholder to room simulation_{chat_id}")
        await sio_instance.emit('new_message', {
            'message_id': str(assistant_message.id),
            'chat_id': str(chat_id),
            'role': 'assistant',
            'content': '',
            'completed': False,
            'audio': False,
            'created_at': assistant_message.created_at.isoformat()
        }, room=f"simulation_{chat_id}")

        logger.info(f"Processing simulation message for chat {chat_id}")

        # 5. Stream the assistant response
        accumulated_content = ""
        cancelled = False
        
        try:
            async for token in run_simulation_agent(uuid.UUID(chat_id), message, db_session):
                # Regular content token
                accumulated_content += token
                
                # Update the database with accumulated content
                assistant_message.content = accumulated_content
                db_session.add(assistant_message)
                db_session.commit()
                
                # Emit token update to connected clients
                logger.info(f"Emitting token to room simulation_{chat_id}: {token[:20]}...")
                await sio_instance.emit('message_token', {
                    'message_id': str(assistant_message.id),
                    'chat_id': str(chat_id),
                    'token': token,
                    'accumulated_content': accumulated_content
                }, room=f"simulation_{chat_id}")
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
                await sio_instance.emit('message_cancelled', {
                    'message_id': str(assistant_message.id),
                    'chat_id': str(chat_id),
                    'final_content': accumulated_content
                }, room=f"simulation_{chat_id}")
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
            await sio_instance.emit('message_complete', {
                'message_id': str(assistant_message.id),
                'chat_id': str(chat_id),
                'final_content': accumulated_content,
                'audio': assistant_message.audio
            }, room=f"simulation_{chat_id}")
        
    except Exception as e:
        logger.error(f"Error in process_simulation_message_websocket: {str(e)}")
        sio_instance = get_sio_instance()
        logger.info(f"Emitting error to room simulation_{chat_id}")
        await sio_instance.emit('message_error', {
            'chat_id': str(chat_id),
            'error': str(e)
        }, room=f"simulation_{chat_id}")
    finally:
        db_session.close()


async def emit_error(sid: str, message: str) -> None:
    """Helper function to emit error messages to a specific client"""
    sio_instance = get_sio_instance()
    await sio_instance.emit('error', {
        'success': False,
        'message': message
    }, room=sid)
    logger.error(f"Emitted error to {sid}: {message}")


def register_simulation_events(sio: socketio.AsyncServer) -> None:
    """Register all simulation WebSocket event handlers"""
    
    @sio.event  # type: ignore
    async def start_simulation(sid: str, data: Dict[str, Any]) -> None:
        """Start a new simulation attempt"""
        await handle_start_simulation(sid, data)
    
    @sio.event  # type: ignore
    async def send_message(sid: str, data: Dict[str, Any]) -> None:
        """Send a text message in simulation"""
        await handle_send_message(sid, data)
    
    @sio.event  # type: ignore
    async def send_audio(sid: str, data: Dict[str, Any]) -> None:
        """Send an audio message in simulation"""
        await handle_send_audio(sid, data)
    
    @sio.event  # type: ignore
    async def stop_simulation(sid: str, data: Dict[str, Any]) -> None:
        """Stop an active simulation"""
        await handle_stop_simulation(sid, data)
    
    @sio.event  # type: ignore
    async def continue_simulation(sid: str, data: Dict[str, Any]) -> None:
        """Continue to next chat in simulation"""
        await handle_continue_simulation(sid, data)
    
    logger.info("Registered simulation WebSocket event handlers")