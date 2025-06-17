# app/routes/evals.py
import json
import logging
import random
from datetime import datetime
from typing import AsyncIterator

from agents import RunConfig, Runner
from app.db import get_session
from app.models import (Agents, EvalChats, EvalMessages, EvalRuns, Evals,
                        Rubrics, Scenarios)
from app.services.agents.evaluate import run_evaluate_agent
from app.services.agents.generic import GenericAgent, run_generic_agent
from app.services.agents.scenario import run_scenario_agent
from app.utils.scenario import randomly_fill_scenario_attributes
from fastapi import APIRouter, Depends, Form, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from openai.types.responses import ResponseTextDeltaEvent
from sqlmodel import Session, select

logger = logging.getLogger(__name__)

router = APIRouter()


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

                agent = session.exec(
                    select(Agents).where(Agents.id == scenario.agent_id)
                ).one_or_none()
                if agent:
                    chat_title = f"{agent.name} - {scenario.name}"
                else:
                    chat_title = f"Eval Run {i+1} - Scenario {j+1}"

                if not scenario.description or scenario.description == "":
                    name, description, trace_id = await run_scenario_agent(
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
) -> StreamingResponse:
    """
    Execute a specific eval run by running an agent-to-agent conversation
    followed by evaluation. Streams the conversation progress back to the client.
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
            return StreamingResponse(
                content="All chats in this eval run are already completed",
                media_type="text/event-stream; charset=utf-8",
                headers={
                    "Cache-Control": "no-store",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no"  # Disable nginx buffering
                },
            )

        async def eval_stream() -> AsyncIterator[str]:
            """Stream the evaluation process"""
            # initial heartbeat so proxies flush headers
            yield ":\n\n"
            
            try:
                # Process chats sequentially
                for i, chat in enumerate(eval_chats_not_completed):
                    yield f"data: {json.dumps({'type': 'chat_start', 'chat_id': chat.id, 'chat_index': i + 1, 'total_chats': len(eval_chats_not_completed), 'message': f'Starting chat {i + 1} of {len(eval_chats_not_completed)}: {chat.title}'})}\n\n"
                    
                    try:
                        # Process multiple turns until max_turns is reached
                        for turn in range(eval_obj.max_turns):
                            yield f"data: {json.dumps({'type': 'turn_start', 'turn': turn + 1, 'max_turns': eval_obj.max_turns, 'chat_id': chat.id, 'message': f'Starting turn {turn + 1} of {eval_obj.max_turns}'})}\n\n"
                            
                            # Check if we have reached max turns by checking existing messages
                            existing_messages = session.exec(
                                select(EvalMessages).where(EvalMessages.chat_id == chat.id)
                            ).all()
                            
                            if len(existing_messages) >= eval_obj.max_turns:
                                break
                            
                            # Run the generic agent for this turn
                            async for token in run_generic_agent(chat.id, session=session):
                                yield f"data: {json.dumps({'type': 'token', 'chat_id': chat.id, 'token': token})}\n\n"
                            
                            yield f"data: {json.dumps({'type': 'turn_complete', 'turn': turn + 1, 'chat_id': chat.id, 'message': f'Turn {turn + 1} completed'})}\n\n"
                        
                        yield f"data: {json.dumps({'type': 'chat_complete', 'chat_id': chat.id, 'message': f'Completed chat: {chat.title}'})}\n\n"
                        
                        # Mark chat as completed
                        chat.completed = True
                        chat.completed_at = datetime.now()
                        session.add(chat)
                        session.commit()
                        
                    except Exception as chat_error:
                        logger.error(f"Error processing chat {chat.id}: {str(chat_error)}")
                        yield f"data: {json.dumps({'type': 'chat_error', 'chat_id': chat.id, 'error': str(chat_error)})}\n\n"
                    
                    # Run evaluation for this completed chat
                    try:
                        eval_grade_id = await run_evaluate_agent(chat.id, session)
                        yield f"data: {json.dumps({'type': 'evaluation_complete', 'chat_id': chat.id, 'eval_grade_id': eval_grade_id})}\n\n"
                    except Exception as eval_error:
                        logger.error(f"Error evaluating chat {chat.id}: {str(eval_error)}")
                        yield f"data: {json.dumps({'type': 'evaluation_error', 'chat_id': chat.id, 'error': str(eval_error)})}\n\n"
                
                yield f"data: {json.dumps({'type': 'run_complete', 'message': 'Eval run completed successfully'})}\n\n"
                yield 'data: {"done": true}\n\n'
                
            except Exception as exc:
                err_msg = str(exc)
                logger.exception("Streaming error: %s", err_msg)
                yield f"data: {json.dumps({'type': 'error', 'error': err_msg})}\n\n"
                raise

        return StreamingResponse(
            eval_stream(),
            media_type="text/event-stream; charset=utf-8",
            headers={
                "Cache-Control": "no-store",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"  # Disable nginx buffering
            },
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in run eval endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to run eval: {str(e)}")

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
    