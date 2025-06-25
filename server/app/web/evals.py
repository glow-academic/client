# for use with the websockets

"""
WebSocket handlers for evaluation functionality
Supports real-time evaluation processing and streaming
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, Optional

import socketio  # type: ignore
from agents import gen_trace_id
from app.db import get_session
from app.models import (Agents, EvalChats, EvalMessages, EvalRuns, Evals,
                        Rubrics, Scenarios)
from app.services.agents.collection.eval import cancel_eval_run, run_eval_agent
from app.services.agents.collection.evaluate import run_evaluate_agent
from app.services.agents.collection.scenario import run_scenario_agent
from app.utils.scenario import randomly_fill_scenario_attributes
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


def get_sio_instance() -> socketio.AsyncServer:
    """Get the Socket.IO server instance from main.py"""
    from app.main import get_socketio_instance
    return get_socketio_instance()


async def handle_start_eval(sid: str, data: Dict[str, Any]) -> None:
    """
    Handle eval start requests via WebSocket
    Replaces /evals/start endpoint
    """
    try:
        logger.info(f"Received start_eval request from {sid} with data: {data}")
        
        eval_id = data.get('eval_id')
        
        if not eval_id:
            logger.error(f"Missing eval_id in request from {sid}")
            await emit_eval_error(sid, "Missing eval_id")
            return

        logger.info(f"Processing eval start: eval_id={eval_id}, sid={sid}")

        # Create a new session for this operation
        db_session = next(get_session())
        
        try:
            # Get the eval
            eval_obj = db_session.exec(select(Evals).where(Evals.id == eval_id)).one_or_none()
            if not eval_obj:
                await emit_eval_error(sid, "Evaluation not found")
                return

            # Get all required data
            scenario_ids = eval_obj.scenario_ids or []
            agent_ids = eval_obj.agent_ids or []
            rubric_ids = eval_obj.rubric_ids or []

            if not scenario_ids:
                await emit_eval_error(sid, "Eval has no scenarios configured")
                return
            if not agent_ids:
                await emit_eval_error(sid, "Eval has no agents configured")
                return
            if not rubric_ids:
                await emit_eval_error(sid, "Eval has no rubrics configured")
                return

            # Validate that all referenced entities exist
            scenarios = db_session.exec(
                select(Scenarios).where(Scenarios.id.in_(scenario_ids))
            ).all()
            agents = db_session.exec(select(Agents).where(Agents.id.in_(agent_ids))).all()
            rubrics = db_session.exec(select(Rubrics).where(Rubrics.id.in_(rubric_ids))).all()

            if len(scenarios) != len(scenario_ids):
                await emit_eval_error(sid, "Some scenarios not found")
                return
            if len(agents) != len(agent_ids):
                await emit_eval_error(sid, "Some agents not found")
                return
            if len(rubrics) != len(rubric_ids):
                await emit_eval_error(sid, "Some rubrics not found")
                return

            # Create eval runs for all combinations
            eval_runs_created = []

            for agent_id in agent_ids:
                for rubric_id in rubric_ids:
                    eval_run = EvalRuns(
                        eval_id=eval_id,
                        agent_id=agent_id,
                        rubric_id=rubric_id,
                    )
                    db_session.add(eval_run)
                    eval_runs_created.append(eval_run)

            db_session.commit()

            # Refresh all eval runs to get their IDs
            for i, eval_run in enumerate(eval_runs_created):
                for j, scenario_id in enumerate(scenario_ids):
                    # Randomly fill scenario attributes if needed
                    old_scenario = db_session.exec(
                        select(Scenarios).where(Scenarios.id == scenario_id)
                    ).one_or_none()

                    if not old_scenario:
                        logger.error(f"Scenario {scenario_id} not found")
                        continue

                    scenario = await randomly_fill_scenario_attributes(old_scenario, db_session)

                    if not scenario.description or scenario.description == "":
                        name, description, trace_id = await run_scenario_agent(
                            agent_id=scenario.agent_id,
                            class_id=scenario.class_id,
                            document_ids=scenario.documents,
                            seniority=scenario.seniority,
                            crowdedness=scenario.crowdedness,
                            intensity=scenario.intensity,
                            group_id=eval_run.id,
                            session=db_session,
                        )

                        scenario.name = name
                        scenario.description = description

                        db_session.add(scenario)
                        db_session.commit()
                        db_session.refresh(scenario)

                        scenario_id = scenario.id
                        chat_title = scenario.name
                    else:
                        chat_title = scenario.name
                        trace_id = gen_trace_id()

                    eval_chat = EvalChats(
                        title=chat_title,
                        eval_run_id=eval_run.id,
                        scenario_id=scenario_id,
                        completed=False,
                        trace_id=trace_id,
                    )

                    db_session.add(eval_chat)
                    db_session.commit()
                    db_session.refresh(eval_chat)

                db_session.refresh(eval_run)

            # Emit success response
            sio_instance = get_sio_instance()
            await sio_instance.emit('eval_started', {
                'success': True,
                'message': f'Created {len(eval_runs_created)} eval runs',
                'eval_run_ids': [str(run.id) for run in eval_runs_created],
                'total_runs': len(eval_runs_created),
            }, room=sid)

            logger.info(f"Eval started successfully for {sid}: created {len(eval_runs_created)} runs")

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error starting eval for {sid}: {str(e)}")
        await emit_eval_error(sid, f"Failed to start eval: {str(e)}")


async def handle_run_eval(sid: str, data: Dict[str, Any]) -> None:
    """
    Handle eval run requests via WebSocket
    Replaces /evals/run endpoint
    """
    try:
        eval_run_id = data.get('eval_run_id')
        
        if not eval_run_id:
            await emit_eval_error(sid, "Missing eval_run_id")
            return

        # Create a new session for this operation
        db_session = next(get_session())
        
        try:
            # Get the eval run
            eval_run = db_session.exec(
                select(EvalRuns).where(EvalRuns.id == eval_run_id)
            ).one_or_none()
            if not eval_run:
                await emit_eval_error(sid, "Eval run not found")
                return
            
            # get the agent for this eval run
            agent = db_session.exec(
                select(Agents).where(Agents.id == eval_run.agent_id)
            ).one_or_none()
            if not agent:
                await emit_eval_error(sid, "Agent not found")
                return
            
            # get the rubric for this eval run
            rubric = db_session.exec(
                select(Rubrics).where(Rubrics.id == eval_run.rubric_id)
            ).one_or_none()
            if not rubric:
                await emit_eval_error(sid, "Rubric not found")
                return
            
            # get the eval for this eval run
            eval_obj = db_session.exec(select(Evals).where(Evals.id == eval_run.eval_id)).one()
            if not eval_obj:
                await emit_eval_error(sid, "Eval not found")
                return

            # find the eval chats for this eval run
            eval_chats = db_session.exec(
                select(EvalChats).where(EvalChats.eval_run_id == eval_run_id)
            ).all()

            # find the eval chats that are not completed
            eval_chats_not_completed = [chat for chat in eval_chats if not chat.completed]

            if not eval_chats_not_completed:
                sio_instance = get_sio_instance()
                await sio_instance.emit('eval_run_complete', {
                    'eval_run_id': eval_run_id,
                    'message': 'All chats in this eval run are already completed'
                }, room=sid)
                return

            # Ensure client is joined to the eval room
            sio_instance = get_sio_instance()
            eval_room = f"eval_{eval_run_id}"
            await sio_instance.enter_room(sid, eval_room)
            logger.info(f"Client {sid} joined eval room {eval_room}")

            # Process the evaluation via WebSocket
            asyncio.create_task(process_eval_run_websocket(
                eval_run_id=eval_run_id,
                eval_chats_not_completed=eval_chats_not_completed,
                eval_obj=eval_obj,
                session=None  # We create our own session in the function
            ))
            
            # Emit acknowledgment
            await sio_instance.emit('eval_run_processing', {
                'eval_run_id': eval_run_id,
                'status': 'processing',
                'message': 'Evaluation is being processed'
            }, room=sid)

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error running eval for {sid}: {str(e)}")
        await emit_eval_error(sid, f"Failed to run eval: {str(e)}")


async def handle_stop_eval(sid: str, data: Dict[str, Any]) -> None:
    """
    Handle eval stop requests via WebSocket
    Replaces /evals/stop endpoint
    """
    try:
        chat_id = data.get('chat_id')
        
        if not chat_id:
            await emit_eval_error(sid, "Missing chat_id")
            return

        # Create a new session for this operation
        db_session = next(get_session())
        
        try:
            # Verify the chat exists
            chat = db_session.exec(
                select(EvalChats).where(EvalChats.id == chat_id)
            ).one_or_none()
            if not chat:
                await emit_eval_error(sid, "Chat not found")
                return
            
            # Attempt to cancel the eval run
            import uuid
            success = cancel_eval_run(uuid.UUID(chat_id))
            
            sio_instance = get_sio_instance()
            
            if success:
                logger.info(f"Successfully cancelled eval run for chat {chat_id}")
                
                # Emit stop signal via WebSocket
                await sio_instance.emit('eval_stopped', {
                    'chat_id': chat_id,
                    'success': True,
                    'message': 'Evaluation run cancelled successfully'
                }, room=f"eval_{chat.eval_run_id}")
                
            else:
                logger.warning(f"No active eval run found for chat {chat_id}")
                await sio_instance.emit('eval_stopped', {
                    'chat_id': chat_id,
                    'success': False,
                    'message': 'No active evaluation run found'
                }, room=f"eval_{chat.eval_run_id}")

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error stopping eval for {sid}: {str(e)}")
        await emit_eval_error(sid, f"Failed to stop eval: {str(e)}")


async def handle_stop_all_evals(sid: str, data: Dict[str, Any]) -> None:
    """
    Handle stop all eval requests via WebSocket
    Replaces /evals/stop/all endpoint
    """
    try:
        eval_run_id = data.get('eval_run_id')
        
        if not eval_run_id:
            await emit_eval_error(sid, "Missing eval_run_id")
            return

        # Create a new session for this operation
        db_session = next(get_session())
        
        try:
            # Verify the eval run exists
            eval_run = db_session.exec(
                select(EvalRuns).where(EvalRuns.id == eval_run_id)
            ).one_or_none()
            if not eval_run:
                await emit_eval_error(sid, "Eval run not found")
                return
            
            # Get all chats for this eval run
            eval_chats = db_session.exec(
                select(EvalChats).where(EvalChats.eval_run_id == eval_run_id)
            ).all()
            
            # Cancel all active chats
            cancelled_count = 0
            for chat in eval_chats:
                success = cancel_eval_run(chat.id)
                if success:
                    cancelled_count += 1
            
            sio_instance = get_sio_instance()
            
            # Emit stop signal for all cancelled chats
            await sio_instance.emit('eval_all_stopped', {
                'eval_run_id': eval_run_id,
                'success': True,
                'message': f'Cancelled {cancelled_count} evaluation runs',
                'cancelled_count': cancelled_count,
                'total_chats': len(eval_chats)
            }, room=f"eval_{eval_run_id}")
            
            logger.info(f"Successfully cancelled {cancelled_count} eval runs for eval run {eval_run_id}")

        finally:
            db_session.close()

    except Exception as e:
        logger.error(f"Error stopping all evals for {sid}: {str(e)}")
        await emit_eval_error(sid, f"Failed to stop all evals: {str(e)}")


async def process_eval_run_websocket(
    eval_run_id: str,
    eval_chats_not_completed: list[EvalChats],
    eval_obj: Evals,
    session: Optional[Session] = None
) -> None:
    """
    Process an evaluation run and stream the response via WebSocket
    """
    
    # Create a new session for this async operation
    from app.db import get_session
    db_session = next(get_session())
    
    try:
        sio_instance = get_sio_instance()
        
        # Process chats sequentially
        for i, chat in enumerate(eval_chats_not_completed):
            await sio_instance.emit('eval_chat_start', {
                'eval_run_id': eval_run_id,
                'chat_id': str(chat.id),
                'chat_index': i + 1,
                'total_chats': len(eval_chats_not_completed),
                'message': f'Starting chat {i + 1} of {len(eval_chats_not_completed)}: {chat.title}'
            }, room=f"eval_{eval_run_id}")
            
            try:
                # Process multiple turns until max_turns is reached
                for turn in range(eval_obj.max_turns):
                    await sio_instance.emit('eval_turn_start', {
                        'eval_run_id': eval_run_id,
                        'chat_id': str(chat.id),
                        'turn': turn + 1,
                        'max_turns': eval_obj.max_turns,
                        'message': f'Starting turn {turn + 1} of {eval_obj.max_turns}'
                    }, room=f"eval_{eval_run_id}")
                    
                    # Check if we have reached max turns by checking existing messages
                    existing_messages = db_session.exec(
                        select(EvalMessages).where(EvalMessages.chat_id == chat.id)
                    ).all()
                    
                    if len(existing_messages) >= eval_obj.max_turns:
                        break
                    
                    # Before running the agent, create a placeholder message and emit new_message event
                    turn_number = len(existing_messages)
                    message_type = "response" if turn_number % 2 == 0 else "query"
                    
                    # Create placeholder message
                    placeholder_message = EvalMessages(
                        chat_id=chat.id,
                        content="",
                        type=message_type,
                        completed=False
                    )
                    db_session.add(placeholder_message)
                    db_session.commit()
                    db_session.refresh(placeholder_message)
                    
                    # Emit new_message event for the placeholder
                    await sio_instance.emit('new_message', {
                        'message_id': str(placeholder_message.id),
                        'chat_id': str(chat.id),
                        'role': 'assistant' if message_type == "response" else 'user',
                        'content': '',
                        'completed': False,
                        'created_at': placeholder_message.created_at.isoformat()
                    }, room=f"eval_{eval_run_id}")
                    
                    # Run the generic agent for this turn
                    accumulated_content = ""
                    async for token in run_eval_agent(chat.id, session=db_session):
                        accumulated_content += token
                        
                        # Update the message in database
                        placeholder_message.content = accumulated_content
                        db_session.add(placeholder_message)
                        db_session.commit()
                        
                        # Emit both eval_token and message_token events
                        await sio_instance.emit('eval_token', {
                            'eval_run_id': eval_run_id,
                            'chat_id': str(chat.id),
                            'token': token
                        }, room=f"eval_{eval_run_id}")
                        
                        await sio_instance.emit('message_token', {
                            'message_id': str(placeholder_message.id),
                            'chat_id': str(chat.id),
                            'token': token,
                            'accumulated_content': accumulated_content
                        }, room=f"eval_{eval_run_id}")
                    
                    # Mark message as completed and emit message_complete event
                    placeholder_message.completed = True
                    db_session.add(placeholder_message)
                    db_session.commit()
                    
                    await sio_instance.emit('message_complete', {
                        'message_id': str(placeholder_message.id),
                        'chat_id': str(chat.id),
                        'final_content': accumulated_content
                    }, room=f"eval_{eval_run_id}")
                    
                    await sio_instance.emit('eval_turn_complete', {
                        'eval_run_id': eval_run_id,
                        'chat_id': str(chat.id),
                        'turn': turn + 1,
                        'message': f'Turn {turn + 1} completed'
                    }, room=f"eval_{eval_run_id}")
                
                await sio_instance.emit('eval_chat_complete', {
                    'eval_run_id': eval_run_id,
                    'chat_id': str(chat.id),
                    'message': f'Completed chat: {chat.title}'
                }, room=f"eval_{eval_run_id}")
                
                # Mark chat as completed
                chat.completed = True
                chat.completed_at = datetime.now()
                db_session.add(chat)
                db_session.commit()
                
            except Exception as chat_error:
                logger.error(f"Error processing chat {chat.id}: {str(chat_error)}")
                await sio_instance.emit('eval_chat_error', {
                    'eval_run_id': eval_run_id,
                    'chat_id': str(chat.id),
                    'error': str(chat_error)
                }, room=f"eval_{eval_run_id}")
            
            # Run evaluation for this completed chat
            try:
                eval_grade_id = await run_evaluate_agent(chat.id, session=db_session)
                await sio_instance.emit('eval_evaluation_complete', {
                    'eval_run_id': eval_run_id,
                    'chat_id': str(chat.id),
                    'eval_grade_id': eval_grade_id
                }, room=f"eval_{eval_run_id}")
            except Exception as eval_error:
                logger.error(f"Error evaluating chat {chat.id}: {str(eval_error)}")
                await sio_instance.emit('eval_evaluation_error', {
                    'eval_run_id': eval_run_id,
                    'chat_id': str(chat.id),
                    'error': str(eval_error)
                }, room=f"eval_{eval_run_id}")
        
        await sio_instance.emit('eval_run_complete', {
            'eval_run_id': eval_run_id,
            'message': 'Eval run completed successfully'
        }, room=f"eval_{eval_run_id}")
        
    except Exception as e:
        logger.error(f"Error in process_eval_run_websocket: {str(e)}")
        sio_instance = get_sio_instance()
        await sio_instance.emit('eval_run_error', {
            'eval_run_id': eval_run_id,
            'error': str(e)
        }, room=f"eval_{eval_run_id}")
    finally:
        db_session.close()


async def emit_eval_error(sid: str, message: str) -> None:
    """Helper function to emit eval error messages to a specific client"""
    sio_instance = get_sio_instance()
    await sio_instance.emit('eval_error', {
        'success': False,
        'message': message
    }, room=sid)
    logger.error(f"Emitted eval error to {sid}: {message}")


def register_eval_events(sio: socketio.AsyncServer) -> None:
    """Register all eval WebSocket event handlers"""
    
    logger.info("Starting registration of eval WebSocket event handlers")
    
    @sio.event  # type: ignore
    async def start_eval(sid: str, data: Dict[str, Any]) -> None:
        """Start a new evaluation"""
        logger.info(f"start_eval event triggered for sid={sid} with data keys: {list(data.keys())}")
        await handle_start_eval(sid, data)
    
    @sio.event  # type: ignore
    async def run_eval(sid: str, data: Dict[str, Any]) -> None:
        """Run an evaluation"""
        await handle_run_eval(sid, data)
    
    @sio.event  # type: ignore
    async def stop_eval(sid: str, data: Dict[str, Any]) -> None:
        """Stop an active evaluation"""
        await handle_stop_eval(sid, data)
    
    @sio.event  # type: ignore
    async def stop_all_evals(sid: str, data: Dict[str, Any]) -> None:
        """Stop all active evaluations for a run"""
        await handle_stop_all_evals(sid, data)
    
    logger.info("Successfully registered eval WebSocket event handlers")