"""Handler for generate_video_outline WebSocket event."""

import json
import uuid
from typing import Any

from agents import (
    FunctionToolResult,
    RunContextWrapper,
    Runner,
    ToolsToFinalOutputResult,
    gen_trace_id,
    trace,
)
from agents.items import TResponseInputItem
from pydantic import BaseModel, ValidationError

from app.main import get_outline_storage, get_pool, get_question_storage, sio
from app.utils.agents.generic_agent import GenericAgent
from app.utils.agents.tools.create_outline_tools import create_outline_tools
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.logging.db_logger import get_logger
from app.utils.scenario import format_parameter_item_info
from app.utils.sql_helper import load_sql
from app.utils.storage.request_storage import build_storage_key
from app.utils.video.format_policy_info import format_policy_info
from app.utils.video.format_question_info import format_question_info

logger = get_logger(__name__)


# Pydantic models for server-to-client events
class VideoOutlineGenerationProgressPayload(BaseModel):
    type: str  # "start", "complete"
    message: str | None = None
    trace_id: str | None = None


class QuestionOption(BaseModel):
    option_text: str
    type: str  # 'discrete' or 'freeform'
    is_correct: bool


class GeneratedQuestion(BaseModel):
    question_text: str
    allow_multiple: bool
    options: list[QuestionOption]


class VideoOutlineGenerationCompletePayload(BaseModel):
    success: bool
    message: str
    name: str
    outline: str
    outline_id: str | None = None
    video_name: str | None = None
    questions: list[GeneratedQuestion] | None = None
    question_timestamps: dict[str, list[int]] | None = None
    trace_id: str | None = None


class VideoOutlineGenerationErrorPayload(BaseModel):
    success: bool
    message: str
    trace_id: str | None = None


# Pydantic models for client-to-server event
class ExistingQuestionOption(BaseModel):
    option_text: str
    type: str  # 'discrete' or 'freeform'
    is_correct: bool


class ExistingQuestion(BaseModel):
    question_id: str | None = None
    question_text: str
    allow_multiple: bool
    times: list[int] = []
    options: list[ExistingQuestionOption] = []


class GenerateVideoOutlinePayload(BaseModel):
    departmentId: str
    documentIds: list[str] | None = None
    questionIds: list[str] | None = None
    parameterItemIds: list[str] | None = None
    existingQuestions: list[ExistingQuestion] | None = None
    profileId: str | None = None
    videoId: str | None = None
    videoLengthSeconds: int | None = None
    useQuestions: bool = True
    personaIds: list[str] | None = None


# Emit helper functions
async def video_outline_generation_progress(
    payload: VideoOutlineGenerationProgressPayload, room: str
) -> None:
    await sio.emit(
        "video_outline_generation_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def video_outline_generation_complete(
    payload: VideoOutlineGenerationCompletePayload, room: str
) -> None:
    await sio.emit("video_outline_generation_complete", payload.model_dump(), room=room)


async def video_outline_generation_error(
    payload: VideoOutlineGenerationErrorPayload, room: str
) -> None:
    await sio.emit("video_outline_generation_error", payload.model_dump(), room=room)


async def _generate_video_outline_impl(
    sid: str, data: GenerateVideoOutlinePayload
) -> None:
    """Handle video outline generation requests via WebSocket."""
    trace_id = gen_trace_id()

    try:
        logger.info(
            f"Received generate_video_outline request from {sid} with data: {data}"
        )

        # Convert string IDs to UUIDs
        department_id = uuid.UUID(data.departmentId)
        document_ids = (
            [uuid.UUID(p) for p in data.documentIds] if data.documentIds else None
        )
        question_ids = (
            [uuid.UUID(q) for q in data.questionIds] if data.questionIds else None
        )
        parameter_item_ids = (
            [uuid.UUID(p) for p in data.parameterItemIds]
            if data.parameterItemIds
            else None
        )
        profile_id = uuid.UUID(data.profileId) if data.profileId else None

        # Filter out empty lists
        if document_ids and len(document_ids) == 0:
            document_ids = None
        if question_ids and len(question_ids) == 0:
            question_ids = None
        if parameter_item_ids and len(parameter_item_ids) == 0:
            parameter_item_ids = None

        # Get connection pool
        pool = get_pool()
        if not pool:
            await video_outline_generation_error(
                VideoOutlineGenerationErrorPayload(
                    success=False,
                    message="Database connection pool not available",
                    trace_id=trace_id,
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Clear previous results (now handled by storage with keys)

            # Emit start event
            await video_outline_generation_progress(
                VideoOutlineGenerationProgressPayload(
                    type="start",
                    message="Starting video outline generation",
                    trace_id=trace_id,
                ),
                room=sid,
            )

            # Get all context data in a single optimized query using SQL file
            document_ids_str = [str(p) for p in document_ids] if document_ids else []
            question_ids_str = [str(q) for q in question_ids] if question_ids else []
            parameter_item_ids_str = (
                [str(p) for p in parameter_item_ids] if parameter_item_ids else []
            )
            video_id = uuid.UUID(data.videoId) if data.videoId else None

            sql = load_sql("sql/v3/agents/get_outline_run_context.sql")
            context_row = await conn.fetchrow(
                sql,
                str(department_id),
                document_ids_str if document_ids_str else None,
                question_ids_str if question_ids_str else None,
                parameter_item_ids_str if parameter_item_ids_str else None,
                str(profile_id) if profile_id else None,
                str(video_id) if video_id else None,
            )

            if not context_row:
                await video_outline_generation_error(
                    VideoOutlineGenerationErrorPayload(
                        success=False,
                        message=f"No outline agent configured for department {data.departmentId}",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

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
            parameter_items = (
                json.loads(context_row["parameter_items"])
                if isinstance(context_row["parameter_items"], str)
                else context_row["parameter_items"]
            )
            personas = (
                json.loads(context_row["personas"])
                if isinstance(context_row["personas"], str)
                else context_row.get("personas", [])
            )

            # Use provided videoLengthSeconds or fall back to video length from DB or default to 4
            video_length_seconds = (
                data.videoLengthSeconds
                if data.videoLengthSeconds is not None
                else context_row.get("video_length_seconds") or 4
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

            # Format document info if documents were provided
            if not document_ids or len(document_ids) == 0:
                policy_info = None
            else:
                documents = context.get("documents") or context.get("policies", [])
                policy_info = format_policy_info(documents, video_length_seconds)

            # Format parameter item info if parameter items were provided
            parameter_item_info = None
            if not parameter_item_ids or len(parameter_item_ids) == 0:
                parameter_item_info = None
            else:
                parameter_item_info = format_parameter_item_info(parameter_items)

            # Format persona info if personas were provided
            persona_info: TResponseInputItem | None = None
            effective_personas = (
                personas if isinstance(personas, list) and len(personas) > 0 else []
            )
            if effective_personas and len(effective_personas) > 0:
                from app.utils.personas import format_persona_info

                persona_contents: list[str] = []
                for persona in effective_personas:
                    if isinstance(persona, dict):
                        persona_data = {
                            "name": persona.get("name", ""),
                            "description": persona.get("description", ""),
                        }
                        formatted_item = format_persona_info(persona_data)
                        # format_persona_info returns TResponseInputItem with "content" as string
                        if isinstance(formatted_item, dict):
                            content_value = formatted_item.get("content")
                            if isinstance(content_value, str):
                                persona_contents.append(content_value)  # type: ignore[arg-type]
                if persona_contents:
                    persona_info = {
                        "role": "user",
                        "content": "\n\n".join(persona_contents),
                    }

            # Format existing questions if provided to inform outline generation
            question_info = None
            question_id_mapping: dict[str, str] = {}
            if data.existingQuestions and len(data.existingQuestions) > 0:
                existing_questions_formatted = [
                    {
                        "id": q.question_id or f"temp-{idx}",
                        "question_text": q.question_text,
                        "allow_multiple": q.allow_multiple,
                    }
                    for idx, q in enumerate(data.existingQuestions)
                ]
                question_info, question_id_mapping = format_question_info(
                    existing_questions_formatted, video_length_seconds
                )

            # Use default guest profile from context if no profile_id provided
            final_profile_id = (
                profile_id if profile_id else context["default_guest_profile_id"]
            )

            # Create outline generation tools
            group_id = None
            use_questions = data.useQuestions if hasattr(data, "useQuestions") else True

            # Use video_id as primary_id if available, otherwise trace_id
            primary_id = str(video_id) if video_id else trace_id

            outline_tools = create_outline_tools(
                group_id=group_id,
                include_questions=use_questions,
                profile_id=str(final_profile_id) if final_profile_id else None,
                primary_id=primary_id,
            )
            outline_tools.append(debug_info_tool)

            # Create tool use behavior to check when all required tools are called
            # Note: Progress checking happens synchronously, but storage is async
            # For now, we'll check progress after tool execution completes
            def tool_use_behavior(
                tool_context: RunContextWrapper[Any],
                tool_results: list[FunctionToolResult],
            ) -> ToolsToFinalOutputResult:
                # This is a limitation of the current tool_use_behavior pattern
                # Progress will be checked after execution completes
                completed_required = True  # Will be checked after execution
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
                persona_info,  # type: ignore[list-item]
                parameter_item_info,
                question_info,
            ]

            clean_input_items = [item for item in input_items if item is not None]

            # Use default guest profile from context if no profile_id provided
            final_profile_id = (
                profile_id if profile_id else context["default_guest_profile_id"]
            )

            # Check rate limit
            profile_id_uuid = final_profile_id if final_profile_id else None
            if not profile_id_uuid:
                await video_outline_generation_error(
                    VideoOutlineGenerationErrorPayload(
                        success=False,
                        message="Profile not found. Please contact support.",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

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
                await video_outline_generation_error(
                    VideoOutlineGenerationErrorPayload(
                        success=False, message=error_message, trace_id=trace_id
                    ),
                    room=sid,
                )
                return

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
                trace_id=trace_id,
            ):
                result = await Runner.run(
                    agent_instance,
                    input=clean_input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Extract results from request-scoped storage
            outline_storage = get_outline_storage()
            outline_storage_key = build_storage_key(
                operation_type="outline_generation",
                profile_id=str(final_profile_id),
                primary_id=primary_id,
            )
            outline_result = await outline_storage.get_all(outline_storage_key)

            usage = result.context_wrapper.usage
            assistant_output = getattr(result, "final_output", None) or ""

            # Emit async pricing event (non-blocking)
            # This handles token updates and message logging in background
            await sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "video_outline",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": context["system_prompt"],
                    "inputItems": clean_input_items,  # Serialized TResponseInputItem list
                    "assistantOutput": assistant_output,
                    "departmentId": str(department_id),
                },
            )

            # Get result values
            name = outline_result.get("name", "Video Outline")
            outline = outline_result.get("outline", "")
            question_timestamps = outline_result.get("question_timestamps")
            video_name = outline_result.get("video_name")

            if not outline:
                await video_outline_generation_error(
                    VideoOutlineGenerationErrorPayload(
                        success=False,
                        message="Outline generation failed - no outline content returned",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            # Extract questions from storage (only if useQuestions was True)
            questions_data: list[GeneratedQuestion] = []

            if use_questions:
                question_storage = get_question_storage()
                question_storage_key = build_storage_key(
                    operation_type="question_generation",
                    profile_id=str(final_profile_id),
                    primary_id=primary_id,
                )
                question_result = await question_storage.get_all(question_storage_key)
                multiple_choice = question_result.get("multiple_choice")
                multi_select = question_result.get("multi_select")

                if multiple_choice:
                    questions_data.append(
                        GeneratedQuestion(
                            question_text=multiple_choice["question_text"],
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
                if multi_select:
                    questions_data.append(
                        GeneratedQuestion(
                            question_text=multi_select["question_text"],
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

                if len(questions_data) != 2:
                    await video_outline_generation_error(
                        VideoOutlineGenerationErrorPayload(
                            success=False,
                            message=(
                                f"Expected 2 questions but got {len(questions_data)}. "
                                "Please ensure both question types (multiple choice and multi-select) are generated."
                            ),
                            trace_id=trace_id,
                        ),
                        room=sid,
                    )
                    return

            outline_id: str | None = None

            # Update video name if video_name was set and videoId is provided
            if data.videoId and video_name:
                try:
                    video_id_uuid = uuid.UUID(data.videoId)
                    sql_update_name = load_sql("sql/v3/videos/update_video_name.sql")
                    name_row = await conn.fetchrow(
                        sql_update_name,
                        str(video_id_uuid),
                        video_name,
                    )
                    if name_row:
                        logger.info(
                            f"Updated video name to '{video_name}' for video {data.videoId}"
                        )
                except Exception as e:
                    logger.warning(f"Failed to update video name: {e}")

            # Save outline to database if videoId is provided
            if data.videoId:
                try:
                    video_id_uuid = uuid.UUID(data.videoId)

                    sql_create_outline = load_sql(
                        "sql/v3/videos/create_outline_for_video.sql"
                    )
                    outline_row = await conn.fetchrow(
                        sql_create_outline,
                        str(video_id_uuid),
                        name,
                        outline,
                        str(model_run_id),  # run_id for linking to run
                    )

                    if outline_row:
                        outline_id = str(outline_row["outline_id"])
                        logger.info(
                            f"Created outline {outline_id} and linked to video {data.videoId}"
                        )
                except Exception as e:
                    logger.warning(f"Failed to save outline: {e}")

            # Convert question IDs to simple numbers (1, 2, 3) for timestamps mapping
            converted_timestamps: dict[str, list[int]] | None = None
            if question_timestamps and isinstance(question_timestamps, dict):
                converted_timestamps = question_timestamps

            # Save question timestamps if videoId is provided and timestamps exist
            if data.videoId and converted_timestamps:
                try:
                    video_id_uuid = uuid.UUID(data.videoId)

                    timestamps_json = json.dumps(converted_timestamps)

                    sql_save_timestamps = load_sql(
                        "sql/v3/videos/save_question_timestamps.sql"
                    )
                    await conn.execute(
                        sql_save_timestamps,
                        str(video_id_uuid),
                        timestamps_json,
                    )
                    logger.info(f"Saved question timestamps for video {data.videoId}")
                except Exception as e:
                    logger.warning(f"Failed to save question timestamps: {e}")

            # Emit completion event
            await video_outline_generation_complete(
                VideoOutlineGenerationCompletePayload(
                    success=True,
                    message=(
                        "Outline and questions generated successfully"
                        if use_questions
                        else "Outline generated successfully"
                    ),
                    name=name,
                    outline=outline,
                    outline_id=outline_id,
                    video_name=video_name,
                    questions=questions_data if questions_data else None,
                    question_timestamps=converted_timestamps if use_questions else None,
                    trace_id=trace_id,
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(
            f"Error in generate_video_outline for {sid}: {str(e)}", exc_info=True
        )
        await video_outline_generation_error(
            VideoOutlineGenerationErrorPayload(
                success=False, message=str(e), trace_id=trace_id
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def generate_video_outline(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = GenerateVideoOutlinePayload(**data)
        await _generate_video_outline_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in generate_video_outline for {sid}: {e}")
        await video_outline_generation_error(
            VideoOutlineGenerationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}", trace_id=None
            ),
            room=sid,
        )
