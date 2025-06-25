# app/routes/evals.py (OLD)
import asyncio
import json
import logging
from datetime import datetime
from typing import AsyncIterator, Optional

import socketio  # type: ignore
from app.db import get_session
from app.models import (Agents, EvalChats, EvalMessages, EvalRuns, Evals,
                        Rubrics, Scenarios)
from app.services.agents.collection.eval import cancel_eval_run, run_eval_agent
from app.services.agents.collection.evaluate import run_evaluate_agent
from app.services.agents.collection.scenario import run_scenario_agent
from agents import gen_trace_id
from app.utils.scenario import randomly_fill_scenario_attributes
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

router = APIRouter()


def get_sio_instance() -> socketio.AsyncServer:
    """Get the Socket.IO server instance from main.py"""
    from app.main import get_socketio_instance
    return get_socketio_instance()


@router.post("/stop")
async def stop_eval_run(
    chat_id: str = Form(...),
    session: Session = Depends(get_session),
) -> JSONResponse:
    """
    Stop an active evaluation run for a specific chat.
    """
    try:
        # Verify the chat exists
        chat = session.exec(
            select(EvalChats).where(EvalChats.id == chat_id)
        ).one_or_none()
        if not chat:
            raise HTTPException(status_code=404, detail="Chat not found")
        
        # Attempt to cancel the eval run
        import uuid
        success = cancel_eval_run(uuid.UUID(chat_id))
        
        if success:
            logger.info(f"Successfully cancelled eval run for chat {chat_id}")
            
            # Emit stop signal via WebSocket using unified function
            from app.main import emit_chat_stopped
            await emit_chat_stopped(chat_id, "eval", "Evaluation run cancelled successfully")
            
            return JSONResponse({
                "success": True,
                "message": "Evaluation run cancelled successfully"
            })
        else:
            logger.warning(f"No active eval run found for chat {chat_id}")
            return JSONResponse(
                status_code=404,
                content={
                    "success": False,
                    "message": "No active evaluation run found"
                }
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping evaluation: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to stop evaluation: {str(e)}"
        )


@router.post("/stop/all")
async def stop_all_eval_runs(
    eval_run_id: str = Form(...),
    session: Session = Depends(get_session),
) -> JSONResponse:
    """
    Stop all active evaluation runs for a specific eval run.
    """
    try:
        # Verify the eval run exists
        eval_run = session.exec(
            select(EvalRuns).where(EvalRuns.id == eval_run_id)
        ).one_or_none()
        if not eval_run:
            raise HTTPException(status_code=404, detail="Eval run not found")
        
        # Get all chats for this eval run
        eval_chats = session.exec(
            select(EvalChats).where(EvalChats.eval_run_id == eval_run_id)
        ).all()
        
        # Cancel all active chats
        cancelled_count = 0
        for chat in eval_chats:
            success = cancel_eval_run(chat.id)
            if success:
                cancelled_count += 1
                
                # Emit stop signal for each cancelled chat
                from app.main import emit_chat_stopped
                await emit_chat_stopped(str(chat.id), "eval", "Evaluation run cancelled successfully")
        
        logger.info(f"Successfully cancelled {cancelled_count} eval runs for eval run {eval_run_id}")
        
        return JSONResponse({
            "success": True,
            "message": f"Cancelled {cancelled_count} evaluation runs",
            "cancelled_count": cancelled_count,
            "total_chats": len(eval_chats)
        })
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error stopping all evaluations: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to stop all evaluations: {str(e)}"
        )


@router.post("/start")
async def start_eval(
    eval_id: str = Form(...),
    session: Session = Depends(get_session),
) -> JSONResponse:
    """
    Create eval runs for all combinations of agents, scenarios, and rubrics in the evaluation.
    This endpoint sets up all the eval runs that will be executed later.
    """
    try:
        # Get the eval
        eval_obj = session.exec(select(Evals).where(Evals.id == eval_id)).one_or_none()
        if not eval_obj:
            raise HTTPException(status_code=404, detail="Evaluation not found")

        # Get all required data
        scenario_ids = eval_obj.scenario_ids or []
        agent_ids = eval_obj.agent_ids or []
        rubric_ids = eval_obj.rubric_ids or []

        if not scenario_ids:
            raise HTTPException(
                status_code=400, detail="Eval has no scenarios configured"
            )
        if not agent_ids:
            raise HTTPException(status_code=400, detail="Eval has no agents configured")
        if not rubric_ids:
            raise HTTPException(
                status_code=400, detail="Eval has no rubrics configured"
            )

        # Validate that all referenced entities exist
        scenarios = session.exec(
            select(Scenarios).where(Scenarios.id.in_(scenario_ids))
        ).all()
        agents = session.exec(select(Agents).where(Agents.id.in_(agent_ids))).all()
        rubrics = session.exec(select(Rubrics).where(Rubrics.id.in_(rubric_ids))).all()

        if len(scenarios) != len(scenario_ids):
            raise HTTPException(status_code=400, detail="Some scenarios not found")
        if len(agents) != len(agent_ids):
            raise HTTPException(status_code=400, detail="Some agents not found")
        if len(rubrics) != len(rubric_ids):
            raise HTTPException(status_code=400, detail="Some rubrics not found")

        # Create eval runs for all combinations
        eval_runs_created = []

        for agent_id in agent_ids:
            for rubric_id in rubric_ids:
                eval_run = EvalRuns(
                    eval_id=eval_id,
                    agent_id=agent_id,
                    rubric_id=rubric_id,
                )
                session.add(eval_run)
                eval_runs_created.append(eval_run)

        session.commit()

        # Refresh all eval runs to get their IDs
        for i, eval_run in enumerate(eval_runs_created):
            for j, scenario_id in enumerate(scenario_ids):
                # Randomly fill scenario attributes if needed
                old_scenario = session.exec(
                    select(Scenarios).where(Scenarios.id == scenario_id)
                ).one_or_none()

                if not old_scenario:
                    logger.error(f"Scenario {scenario_id} not found")
                    continue

                scenario = await randomly_fill_scenario_attributes(old_scenario, session)

                if not scenario.description or scenario.description == "":
                    name, description, trace_id = await run_scenario_agent(
                        agent_id=scenario.agent_id,
                        class_id=scenario.class_id,
                        document_ids=scenario.documents,
                        seniority=scenario.seniority,
                        crowdedness=scenario.crowdedness,
                        intensity=scenario.intensity,
                        group_id=eval_run.id,
                        session=session,
                    )

                    scenario.name = name
                    scenario.description = description

                    session.add(scenario)
                    session.commit()
                    session.refresh(scenario)

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

                session.add(eval_chat)
                session.commit()
                session.refresh(eval_chat)

            session.refresh(eval_run)

        logger.info(f"Created {len(eval_runs_created)} eval runs for eval {eval_id}")

        return JSONResponse(
            status_code=200,
            content={
            "success": True,
            "message": f"Created {len(eval_runs_created)} eval runs",
            "eval_run_ids": [str(run.id) for run in eval_runs_created],
            "total_runs": len(eval_runs_created),
            }
        )

    except Exception as e:
        session.rollback()
        logger.error(f"Error starting eval: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start eval: {str(e)}")

@router.post("/run")
async def run_eval(
    eval_run_id: str = Form(...),
    session: Session = Depends(get_session),
) -> JSONResponse:
    """
    Execute a specific eval run by running an agent-to-agent conversation
    followed by evaluation. Streams the conversation progress back to the client via WebSocket.
    """
    try:
        # Get the eval run
        eval_run = session.exec(
            select(EvalRuns).where(EvalRuns.id == eval_run_id)
        ).one_or_none()
        if not eval_run:
            raise HTTPException(status_code=404, detail="Eval run not found")
        
        # get the agent for this eval run
        agent = session.exec(
            select(Agents).where(Agents.id == eval_run.agent_id)
        ).one_or_none()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")
        
        # get the rubric for this eval run
        rubric = session.exec(
            select(Rubrics).where(Rubrics.id == eval_run.rubric_id)
        ).one_or_none()
        if not rubric:
            raise HTTPException(status_code=404, detail="Rubric not found")
        
        # get the eval for this eval run
        eval_obj = session.exec(select(Evals).where(Evals.id == eval_run.eval_id)).one()
        if not eval_obj:
            raise HTTPException(status_code=404, detail="Eval not found")

        # find the eval chats for this eval run
        eval_chats = session.exec(
            select(EvalChats).where(EvalChats.eval_run_id == eval_run_id)
        ).all()

        # find the eval chats that are not completed
        eval_chats_not_completed = [chat for chat in eval_chats if not chat.completed]

        if not eval_chats_not_completed:
            return JSONResponse({
                "status": "completed",
                "message": "All chats in this eval run are already completed"
            })

        # Process the evaluation via WebSocket
        asyncio.create_task(process_eval_run_websocket(
            eval_run_id=eval_run_id,
            eval_chats_not_completed=eval_chats_not_completed,
            eval_obj=eval_obj,
            session=None  # We create our own session in the function
        ))
        
        return JSONResponse({
            "status": "processing",
            "message": "Evaluation is being processed"
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in run eval endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to run eval: {str(e)}")


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
                'chat_id': chat.id,
                'chat_index': i + 1,
                'total_chats': len(eval_chats_not_completed),
                'message': f'Starting chat {i + 1} of {len(eval_chats_not_completed)}: {chat.title}'
            }, room=f"eval_{eval_run_id}")
            
            try:
                # Process multiple turns until max_turns is reached
                for turn in range(eval_obj.max_turns):
                    await sio_instance.emit('eval_turn_start', {
                        'eval_run_id': eval_run_id,
                        'chat_id': chat.id,
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
                            'chat_id': chat.id,
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
                        'chat_id': chat.id,
                        'turn': turn + 1,
                        'message': f'Turn {turn + 1} completed'
                    }, room=f"eval_{eval_run_id}")
                
                await sio_instance.emit('eval_chat_complete', {
                    'eval_run_id': eval_run_id,
                    'chat_id': chat.id,
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
                    'chat_id': chat.id,
                    'error': str(chat_error)
                }, room=f"eval_{eval_run_id}")
            
            # Run evaluation for this completed chat
            try:
                eval_grade_id = await run_evaluate_agent(chat.id, session=db_session)
                await sio_instance.emit('eval_evaluation_complete', {
                    'eval_run_id': eval_run_id,
                    'chat_id': chat.id,
                    'eval_grade_id': eval_grade_id
                }, room=f"eval_{eval_run_id}")
            except Exception as eval_error:
                logger.error(f"Error evaluating chat {chat.id}: {str(eval_error)}")
                await sio_instance.emit('eval_evaluation_error', {
                    'eval_run_id': eval_run_id,
                    'chat_id': chat.id,
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

@router.get("/run/{eval_run_id}/status")
async def get_eval_run_status(
    eval_run_id: str,
    session: Session = Depends(get_session),
) -> JSONResponse:
    """
    Get the current status of an eval run
    """
    try:
        # Get the eval run
        eval_run = session.exec(
            select(EvalRuns).where(EvalRuns.id == eval_run_id)
        ).one_or_none()
        if not eval_run:
            raise HTTPException(status_code=404, detail="Eval run not found")

        # Get all chats for this eval run
        eval_chats = session.exec(
            select(EvalChats).where(EvalChats.eval_run_id == eval_run_id)
        ).all()

        total_chats = len(eval_chats)
        completed_chats = len([chat for chat in eval_chats if chat.completed])
        
        # Get message counts for each chat
        chat_statuses = []
        for chat in eval_chats:
            messages = session.exec(
                select(EvalMessages).where(EvalMessages.chat_id == chat.id)
            ).all()
            
            chat_statuses.append({
                "chat_id": chat.id,
                "title": chat.title,
                "completed": chat.completed,
                "completed_at": chat.completed_at.isoformat() if chat.completed_at else None,
                "message_count": len(messages),
                "scenario_id": chat.scenario_id
            })

        return JSONResponse(
            status_code=200,
            content={
            "eval_run_id": eval_run_id,
            "total_chats": total_chats,
            "completed_chats": completed_chats,
            "progress_percentage": (completed_chats / total_chats * 100) if total_chats > 0 else 0,
            "chat_statuses": chat_statuses
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting eval run status: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get eval run status: {str(e)}")
    