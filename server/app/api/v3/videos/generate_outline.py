"""Video generate outline endpoint - v3 API following DHH principles.

Note: This route uses 3 SQL queries, which is an exception to the "one query per route" principle:
1. get_outline_run_context.sql - Gets context data (needed before agent run)
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
from app.main import get_db, outline_progress, outline_results
from app.utils.agents.generic_agent import GenericAgent
from app.utils.agents.tools.create_outline_tools import create_outline_tools
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from app.utils.video.format_policy_info import format_policy_info
from app.utils.video.format_question_info import format_question_info
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

logger = get_logger(__name__)


# Inline request/response schemas
class GenerateOutlineRequest(BaseModel):
    """Request to generate AI outline."""

    departmentId: str
    policyIds: list[str] | None = None
    questionIds: list[str] | None = None
    profileId: str | None = None
    videoId: str | None = None


class GenerateOutlineResponse(BaseModel):
    """Response from AI outline generation."""

    success: bool
    message: str
    name: str
    outline: str
    outline_id: str | None = None
    video_name: str | None = None
    question_timestamps: dict[str, list[int]] | None = None


router = APIRouter()


@router.post("/generate-outline", response_model=GenerateOutlineResponse)
async def generate_outline(
    request: GenerateOutlineRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GenerateOutlineResponse:
    """Generate AI outline from policies and questions."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Convert string IDs to UUIDs
        department_id = uuid.UUID(request.departmentId)
        policy_ids = (
            [uuid.UUID(p) for p in request.policyIds] if request.policyIds else None
        )
        question_ids = (
            [uuid.UUID(q) for q in request.questionIds] if request.questionIds else None
        )
        profile_id = uuid.UUID(request.profileId) if request.profileId else None

        # Filter out empty lists
        if policy_ids and len(policy_ids) == 0:
            policy_ids = None
        if question_ids and len(question_ids) == 0:
            question_ids = None

        # Generate outline
        # Clear previous results
        outline_results.clear()
        outline_progress.clear()

        # Get all context data in a single optimized query using SQL file
        policy_ids_str = [str(p) for p in policy_ids] if policy_ids else []
        question_ids_str = [str(q) for q in question_ids] if question_ids else []
        video_id = uuid.UUID(request.videoId) if request.videoId else None

        sql = load_sql("sql/v3/agents/get_outline_run_context.sql")
        context_row = await conn.fetchrow(
            sql,
            str(department_id),
            policy_ids_str if policy_ids_str else None,
            question_ids_str if question_ids_str else None,
            str(profile_id) if profile_id else None,
            str(video_id) if video_id else None,
        )

        if not context_row:
            raise ValueError(
                f"No outline agent configured for department {request.departmentId}"
            )

        # Parse JSON arrays
        policies = (
            json.loads(context_row["policies"])
            if isinstance(context_row["policies"], str)
            else context_row["policies"]
        )
        questions = (
            json.loads(context_row["questions"])
            if isinstance(context_row["questions"], str)
            else context_row["questions"]
        )

        video_length_seconds = context_row.get("video_length_seconds")
        
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
            "provider": context_row["provider"],
            "provider_id": context_row["provider_id"],
            "provider_name": context_row["provider_name"],
            "base_url": context_row["base_url"],
            "api_key": context_row["api_key"],
            "policies": policies,
            "questions": questions,
            "video_length_seconds": video_length_seconds,
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

        # Format question info if questions were provided
        question_id_mapping: dict[str, str] = {}
        if not questions or len(questions) == 0:
            question_info = None
        else:
            question_info, question_id_mapping = format_question_info(
                context["questions"], 
                context.get("video_length_seconds")
            )

        # Create outline generation tools
        group_id = None
        outline_tools = create_outline_tools(group_id)
        outline_tools.append(debug_info_tool)
        logger.info(
            f"Created {len(outline_tools)} outline tools (including debug_info)"
        )

        # Create tool use behavior to check when all required tools are called
        def tool_use_behavior(
            tool_context: RunContextWrapper[Any],
            tool_results: list[FunctionToolResult],
        ) -> ToolsToFinalOutputResult:
            required_tools = ["outline"]

            completed_required = all(
                outline_progress.get(tool, False) for tool in required_tools
            )

            logger.info(
                f"Tool use check: required={required_tools}, completed={completed_required}, progress={outline_progress}"
            )
            return ToolsToFinalOutputResult(is_final_output=completed_required)

        outline_agent_generic = GenericAgent(
            agent_name=context["agent_name"],
            system_prompt=context["system_prompt"],
            temperature=context["temperature"],
            model_name=context["model_name"],
            provider=context["provider"],
            base_url=context["base_url"],
            api_key=context["api_key"],
            reasoning=context["reasoning"],
            tools=outline_tools,
            parallel_tool_calls=False,
            tool_use_behavior=tool_use_behavior,
        )

        agent_instance = outline_agent_generic.agent()

        input_items: list[TResponseInputItem | None] = [
            policy_info,
            question_info,
        ]

        clean_input_items = [item for item in input_items if item is not None]

        # Generate a trace id for the outline generation
        outline_trace_id = gen_trace_id()

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
            "Outline Agent",
            group_id=str(group_id) if group_id else None,
            trace_id=outline_trace_id,
        ):
            result = await Runner.run(
                agent_instance,
                input=clean_input_items,
                context=DebugContext(conn=conn, run_id=model_run_id),
            )

        # Extract results from the global storage
        outline_result = outline_results

        usage = result.context_wrapper.usage

        # Update model run with token usage using SQL file
        sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
        await conn.execute(
            sql_update_tokens,
            str(model_run_id),
            usage.input_tokens,
            usage.output_tokens,
        )

        # Get result values
        name = outline_result.get("name", "Video Outline")
        outline = outline_result.get("outline", "")
        question_timestamps = outline_result.get("question_timestamps")
        video_name = outline_result.get("video_name")

        if not outline:
            raise ValueError("Outline generation failed - no outline content returned")

        outline_id: str | None = None
        
        # Update video name if video_name was set and videoId is provided
        if request.videoId and video_name:
            try:
                video_id = uuid.UUID(request.videoId)
                sql_update_name = load_sql("sql/v3/videos/update_video_name.sql")
                name_row = await conn.fetchrow(
                    sql_update_name,
                    str(video_id),
                    video_name,
                )
                if name_row:
                    logger.info(f"Updated video name to '{video_name}' for video {request.videoId}")
                else:
                    logger.warning(f"Failed to update video name for video {request.videoId}")
            except Exception as e:
                logger.warning(f"Failed to update video name: {e}")
                # Don't fail the request if video name update fails, but log the error
        
        # Save outline to database if videoId is provided
        if request.videoId:
            try:
                video_id = uuid.UUID(request.videoId)
                
                # Create outline and link it to video
                sql_create_outline = load_sql("sql/v3/videos/create_outline_for_video.sql")
                outline_row = await conn.fetchrow(
                    sql_create_outline,
                    str(video_id),
                    name,
                    outline,
                )
                
                if outline_row:
                    outline_id = str(outline_row["outline_id"])
                    logger.info(f"Created outline {outline_id} and linked to video {request.videoId}")
                else:
                    logger.warning(f"Failed to create outline for video {request.videoId}")
            except Exception as e:
                logger.warning(f"Failed to save outline: {e}")
                # Don't fail the request if outline saving fails, but log the error

        # Convert simple number keys back to UUIDs if mapping exists (for both saving and response)
        converted_timestamps: dict[str, list[int]] | None = None
        if question_timestamps and isinstance(question_timestamps, dict):
            converted_timestamps = {}
            if question_id_mapping:
                for key, timestamps in question_timestamps.items():
                    # Check if key is a simple number (needs conversion) or already a UUID
                    if key in question_id_mapping:
                        # Convert simple number to UUID
                        uuid_key = question_id_mapping[key]
                        converted_timestamps[uuid_key] = timestamps
                    else:
                        # Already a UUID (backward compatibility), use as-is
                        converted_timestamps[key] = timestamps
            else:
                # No mapping available, use as-is
                converted_timestamps = question_timestamps

        # Save question timestamps if videoId is provided and timestamps exist
        if request.videoId and converted_timestamps:
            try:
                video_id = uuid.UUID(request.videoId)
                
                # Convert question_timestamps dict to JSONB format
                timestamps_json = json.dumps(converted_timestamps)
                
                sql_save_timestamps = load_sql("sql/v3/videos/save_question_timestamps.sql")
                await conn.execute(
                    sql_save_timestamps,
                    str(video_id),
                    timestamps_json,
                )
                logger.info(f"Saved question timestamps for video {request.videoId}")
            except Exception as e:
                logger.warning(f"Failed to save question timestamps: {e}")
                # Don't fail the request if timestamp saving fails
        
        return GenerateOutlineResponse(
            success=True,
            message="Outline generated successfully",
            name=name,
            outline=outline,
            outline_id=outline_id,
            video_name=video_name,
            question_timestamps=converted_timestamps,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="generate_outline",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
        raise

