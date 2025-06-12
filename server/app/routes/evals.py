# app/routes/evals.py
from fastapi import APIRouter, Form, HTTPException, Depends
from app.models import (
    EvalRuns,
    EvalChats,
    EvalMessages,
    Agents,
    Scenarios,
    Evals,
    Rubrics,
)
from app.db import get_session
from sqlmodel import Session, select
import logging
import random
from app.services.agents.evaluate import run_evaluate_agent
from app.services.agents.generic import GenericAgent
from fastapi.responses import StreamingResponse
import json
from typing import AsyncIterator
from datetime import datetime
from agents import Runner, RunConfig
from openai.types.responses import ResponseTextDeltaEvent
from app.utils.scenario import randomly_fill_scenario_attributes
from app.services.agents.advanced import run_advanced_agent
from app.services.agents.scenario import run_scenario_agent
from app.services.agents.generic import run_generic_agent

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/start")
async def start_eval(
    eval_id: str = Form(...),
    session: Session = Depends(get_session),
):
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

                eval_chat = EvalChats(
                    title=chat_title,
                    eval_run_id=eval_run.id,
                    scenario_id=scenario_id,
                    completed=False,
                )

                session.add(eval_chat)
                session.commit()
                session.refresh(eval_chat)

            session.refresh(eval_run)

        # call the endpoint to run the first eval run
        await run_eval(eval_runs_created[0].id, session)

        logger.info(f"Created {len(eval_runs_created)} eval runs for eval {eval_id}")

        return {
            "success": True,
            "message": f"Created {len(eval_runs_created)} eval runs",
            "eval_run_ids": [str(run.id) for run in eval_runs_created],
            "total_runs": len(eval_runs_created),
        }

    except Exception as e:
        session.rollback()
        logger.error(f"Error starting eval: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to start eval: {str(e)}")

@router.post("/run")
async def run_eval(
    eval_run_id: str = Form(...),
    session: Session = Depends(get_session),
):
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

        # Find increment
        max_parallel_runs = min(eval_obj.max_parallel_runs, len(eval_chats_not_completed))

        # In groups of no more than max_parallel_runs, create simulation chats
        for i in range(0, len(eval_chats_not_completed), max_parallel_runs):
            eval_chats_to_run = eval_chats_not_completed[i:i+max_parallel_runs]

            # if length is greater than 1, run a batch of eval chats to the run_advanced_agent
            if len(eval_chats_to_run) > 1:

                async def eval_chat_stream() -> AsyncIterator[str]:
                    # initial heartbeat so proxies flush headers
                    yield ":\n\n"
                    try:
                        async for token in run_generic_agent(
                            chat_id=eval_chats_to_run[0].id,
                            session=session,
                        ):
                            yield f"data: {json.dumps({'text': token})}\n\n"
                        yield 'data: {"done": true}\n\n'
                    except Exception as exc:
                        err_msg = str(exc)
                        logger.exception("Streaming error: %s", err_msg)
                        yield f"data: {json.dumps({'error': err_msg})}\n\n"
                        raise
                eval_grade_id = await run_evaluate_agent(eval_chats_to_run[0].id, session)
            else:
                eval_grade_ids = []
                async def eval_chats_stream() -> AsyncIterator[str]:
                    # initial heartbeat so proxies flush headers
                    yield ":\n\n"
                    try:
                        async for token in run_advanced_agent(
                            chat_ids=eval_chats_to_run,
                            session=session,
                        ):
                            yield f"data: {json.dumps({'text': token})}\n\n"
                        yield 'data: {"done": true}\n\n'
                    except Exception as exc:
                        err_msg = str(exc)
                        logger.exception("Streaming error: %s", err_msg)
                        yield f"data: {json.dumps({'error': err_msg})}\n\n"
                        raise
                
                for eval_chat in eval_chats_to_run:
                    eval_grade_id = await run_evaluate_agent(eval_chat.id, session)
                    eval_grade_ids.append(eval_grade_id)

        
        if len(eval_chats_to_run) > 1:
            return StreamingResponse(
                eval_chats_stream(),
                media_type="text/event-stream; charset=utf-8",
                headers={"Cache-Control": "no-store"},
            )
        else:
            return StreamingResponse(
                eval_chats_stream(),
                media_type="text/event-stream; charset=utf-8",
                headers={"Cache-Control": "no-store"},
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in run eval endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to run eval: {str(e)}")
    