"""Video generate questions endpoint - v3 API following DHH principles.

Note: This route uses 3 SQL queries, which is an exception to the "one query per route" principle:
1. get_question_run_context.sql - Gets context data (needed before agent run)
2. create_model_run_complete.sql - Creates model run (needed before agent execution)
3. update_model_run_tokens.sql - Updates tokens after agent run (needed after agent execution)

The queries are separated by agent execution logic, so they cannot be combined into a single query.
This is an acceptable exception per DHH principles - business logic separates the queries.
"""

import json
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from agents import (FunctionToolResult, RunContextWrapper, Runner,
                    ToolsToFinalOutputResult, gen_trace_id, trace)
from agents.items import TResponseInputItem
from app.main import get_db, question_progress, question_results
from app.utils.agents.generic_agent import GenericAgent
from app.utils.agents.tools.create_question_tools import create_question_tools
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from app.utils.logging.db_logger import get_logger
from app.utils.video.format_policy_info import format_policy_info
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

logger = get_logger(__name__)


# Inline request/response schemas
class QuestionOption(BaseModel):
    """Question option in response."""

    option_text: str
    type: str  # 'discrete' or 'freeform'
    is_correct: bool


class GeneratedQuestion(BaseModel):
    """Generated question in response."""

    question_text: str
    type: str  # 'choice' or 'frq'
    allow_multiple: bool
    options: list[QuestionOption]


class GenerateQuestionsRequest(BaseModel):
    """Request to generate AI questions."""

    departmentId: str
    policyIds: list[str] | None = None
    profileId: str | None = None
    videoId: str | None = None


class GenerateQuestionsResponse(BaseModel):
    """Response from AI question generation."""

    success: bool
    message: str
    questions: list[GeneratedQuestion]


router = APIRouter()


@router.post("/generate-questions", response_model=GenerateQuestionsResponse)
async def generate_questions(
    request: GenerateQuestionsRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GenerateQuestionsResponse:
    """Generate AI questions (multiple choice, free response, multi-select)."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Convert string IDs to UUIDs
        department_id = uuid.UUID(request.departmentId)
        policy_ids = (
            [uuid.UUID(p) for p in request.policyIds] if request.policyIds else None
        )
        profile_id = uuid.UUID(request.profileId) if request.profileId else None

        # Filter out empty lists
        if policy_ids and len(policy_ids) == 0:
            policy_ids = None

        # Generate questions
        # Clear previous results
        question_results.clear()
        question_progress.clear()

        # Get all context data in a single optimized query using SQL file
        policy_ids_str = [str(p) for p in policy_ids] if policy_ids else []

        sql = load_sql("sql/v3/agents/get_question_run_context.sql")
        context_row = await conn.fetchrow(
            sql,
            str(department_id),
            policy_ids_str if policy_ids_str else None,
            str(profile_id) if profile_id else None,
        )

        if not context_row:
            raise ValueError(
                f"No question agent configured for department {request.departmentId}"
            )

        # Parse JSON arrays
        policies = (
            json.loads(context_row["policies"])
            if isinstance(context_row["policies"], str)
            else context_row["policies"]
        )

        context = {
            "agent_id": context_row["agent_id"],
            "agent_name": context_row["agent_name"],
            "system_prompt": context_row["system_prompt"],
            "temperature": float(context_row["temperature"])
            if context_row["temperature"] is not None
            else 0.0,
            "reasoning": context_row["reasoning"],
            "model_id": context_row["model_id"],
            "model_name": context_row["model_name"],
            "custom_model": context_row["custom_model"],
            "provider_id": context_row["provider_id"],
            "provider_name": context_row["provider_name"],
            "base_url": context_row["base_url"],
            "api_key": context_row["api_key"],
            "policies": policies,
            "default_guest_profile_id": context_row["default_guest_profile_id"],
            "req_per_day": context_row["req_per_day"],
            "runs_today_count": context_row["runs_today_count"],
            "earliest_run_created_at": context_row["earliest_run_created_at"],
        }

        # Format policy info if policies were provided
        if not policy_ids or len(policy_ids) == 0:
            policy_info = None
        else:
            policy_info = format_policy_info(context["policies"])

        # Create question generation tools
        group_id = None
        question_tools = create_question_tools(group_id)
        question_tools.append(debug_info_tool)
        logger.info(
            f"Created {len(question_tools)} question tools (including debug_info)"
        )

        # Create tool use behavior to check when all required tools are called
        def tool_use_behavior(
            tool_context: RunContextWrapper[Any],
            tool_results: list[FunctionToolResult],
        ) -> ToolsToFinalOutputResult:
            required_tools = ["multiple_choice", "free_response", "multi_select"]

            completed_required = all(
                question_progress.get(tool, False) for tool in required_tools
            )

            logger.info(
                f"Tool use check: required={required_tools}, completed={completed_required}, progress={question_progress}"
            )
            return ToolsToFinalOutputResult(is_final_output=completed_required)

        question_agent_generic = GenericAgent(
            agent_name=context["agent_name"],
            system_prompt=context["system_prompt"],
            temperature=context["temperature"],
            model_name=context["model_name"],
            provider=context["provider"],
            base_url=context["base_url"],
            api_key=context["api_key"],
            reasoning=context["reasoning"],
            tools=question_tools,
            parallel_tool_calls=False,
            tool_use_behavior=tool_use_behavior,
        )

        agent_instance = question_agent_generic.agent()

        input_items: list[TResponseInputItem | None] = [
            policy_info,
        ]

        clean_input_items = [item for item in input_items if item is not None]

        # Generate a trace id for the question generation
        question_trace_id = gen_trace_id()

        # Use default guest profile from context if no profile_id provided
        final_profile_id = (
            profile_id if profile_id else context["default_guest_profile_id"]
        )

        # Check rate limit
        profile_id_uuid = final_profile_id if final_profile_id else None
        if not profile_id_uuid:
            raise ValueError("Profile not found. Please contact support.")

        req_per_day = context["req_per_day"]
        runs_today_count = context["runs_today_count"]

        if req_per_day is not None and runs_today_count >= req_per_day:
            from datetime import timedelta
            from zoneinfo import ZoneInfo

            earliest_run_created_at = context["earliest_run_created_at"]
            if earliest_run_created_at:
                next_allowed_utc = earliest_run_created_at + timedelta(days=1)
                eastern_tz = ZoneInfo("America/New_York")
                next_allowed_et = next_allowed_utc.astimezone(eastern_tz)
                error_message = (
                    f"Daily request limit of {req_per_day} reached. "
                    f"Next request allowed after {next_allowed_et.strftime('%I:%M %p %Z')} on "
                    f"{next_allowed_et.strftime('%B %d, %Y')}."
                )
            else:
                error_message = f"Daily request limit of {req_per_day} reached. Please try again tomorrow."
            raise ValueError(error_message)

        # Create model run with all junction records using SQL file
        sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
        model_run_row = await conn.fetchrow(
            sql_create_run,
            str(department_id),
            context["model_id"],
            context["agent_id"],
            "agent",
            final_profile_id,
            None,  # key_id
            str(context["agent_id"]),  # agent_id
        )
        model_run_id = uuid.UUID(model_run_row["run_id"])

        with trace(
            "Question Agent",
            group_id=str(group_id) if group_id else None,
            trace_id=question_trace_id,
        ):
            result = await Runner.run(
                agent_instance,
                input=clean_input_items,
                context=DebugContext(conn=conn, run_id=model_run_id),
            )

        # Extract results from the global storage
        question_result = question_results

        usage = result.context_wrapper.usage

        # Update model run with token usage using SQL file
        sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
        await conn.execute(
            sql_update_tokens,
            str(model_run_id),
            usage.input_tokens,
            usage.output_tokens,
        )

        # Get result values - should have exactly 3 questions
        multiple_choice = question_result.get("multiple_choice")
        free_response = question_result.get("free_response")
        multi_select = question_result.get("multi_select")

        questions_list = []
        if multiple_choice:
            questions_list.append(
                GeneratedQuestion(
                    question_text=multiple_choice["question_text"],
                    type=multiple_choice["type"],
                    allow_multiple=multiple_choice["allow_multiple"],
                    options=[
                        QuestionOption(
                            option_text=opt["option_text"],
                            type=opt["type"],
                            is_correct=opt["is_correct"],
                        )
                        for opt in multiple_choice["options"]
                    ],
                )
            )
        if free_response:
            questions_list.append(
                GeneratedQuestion(
                    question_text=free_response["question_text"],
                    type=free_response["type"],
                    allow_multiple=free_response["allow_multiple"],
                    options=[],
                )
            )
        if multi_select:
            questions_list.append(
                GeneratedQuestion(
                    question_text=multi_select["question_text"],
                    type=multi_select["type"],
                    allow_multiple=multi_select["allow_multiple"],
                    options=[
                        QuestionOption(
                            option_text=opt["option_text"],
                            type=opt["type"],
                            is_correct=opt["is_correct"],
                        )
                        for opt in multi_select["options"]
                    ],
                )
            )

        if len(questions_list) != 3:
            raise ValueError(
                f"Expected 3 questions but got {len(questions_list)}. "
                "Please ensure all three question types are generated."
            )

        return GenerateQuestionsResponse(
            success=True,
            message="Questions generated successfully",
            questions=questions_list,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="generate_questions",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
        raise

