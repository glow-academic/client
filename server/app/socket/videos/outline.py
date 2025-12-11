"""Handler for video_outline WebSocket event."""

import json
import uuid
from typing import Any

from agents import (
    FunctionToolResult,
    RunContextWrapper,
    Runner,
    Tool,
    ToolsToFinalOutputResult,
    function_tool,
    gen_trace_id,
    trace,
)
from agents.items import TResponseInputItem
from pydantic import BaseModel, ValidationError

from app.main import (
    get_internal_sio,
    get_outline_storage,
    get_pool,
    get_question_storage,
    sio,
)
from app.utils.agents.generic_agent import GenericAgent
from app.utils.debug_info import DebugContext
from app.utils.debug_info import debug_info as debug_info_tool
from app.utils.logging.db_logger import get_logger
from app.utils.scenario import format_parameter_item_info
from app.utils.sql_helper import load_sql
from app.utils.storage.request_storage import build_storage_key
from app.utils.video.format_policy_info import format_policy_info
from app.utils.video.format_question_info import format_question_info

logger = get_logger(__name__)
internal_sio = get_internal_sio()


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
    questionsMin: int | None = None
    questionsMax: int | None = None
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


async def _video_outline_impl(sid: str, data: GenerateVideoOutlinePayload) -> None:
    """Handle video outline generation requests via WebSocket."""
    trace_id = gen_trace_id()

    try:
        logger.info(f"Received video_outline request from {sid} with data: {data}")

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

            # Get all context data AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            document_ids_str = [str(p) for p in document_ids] if document_ids else []
            question_ids_str = [str(q) for q in question_ids] if question_ids else []
            parameter_item_ids_str = (
                [str(p) for p in parameter_item_ids] if parameter_item_ids else []
            )
            video_id = uuid.UUID(data.videoId) if data.videoId else None

            sql = load_sql("sql/v3/agents/get_outline_run_context_and_create_run.sql")
            try:
                context_row = await conn.fetchrow(
                    sql,
                    str(department_id),
                    document_ids_str if document_ids_str else None,
                    question_ids_str if question_ids_str else None,
                    parameter_item_ids_str if parameter_item_ids_str else None,
                    str(profile_id) if profile_id else None,
                    str(video_id) if video_id else None,
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                # Check if it's a rate limit error from SQL (PostgreSQL exception)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    # Extract the user-friendly message (everything after "RATE_LIMIT_EXCEEDED: ")
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await video_outline_generation_error(
                        VideoOutlineGenerationErrorPayload(
                            success=False,
                            message=user_msg,
                            trace_id=trace_id,
                        ),
                        room=sid,
                    )
                    return
                # Log other errors
                logger.error(
                    f"Failed to get context and create run for {sid}: {str(e)}",
                    exc_info=True,
                )
                await video_outline_generation_error(
                    VideoOutlineGenerationErrorPayload(
                        success=False,
                        message=f"Failed to initialize outline generation: {str(e)}",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

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

            agent_role = context_row.get("agent_role", "outline")

            context = {
                "agent_id": context_row["agent_id"],
                "agent_name": context_row["agent_name"],
                "agent_role": agent_role,
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

            # Determine which tools to enable based on agent role
            group_id = None

            # Determine tool availability based on agent role
            # Base 'outline' role supports all tools (backward compatibility)
            # Fine-grained roles indicate specific capabilities
            agent_role_str = str(agent_role).lower()
            # Check if questions should be generated based on questionsMax
            questions_requested = (
                (data.questionsMax is not None and data.questionsMax > 0)
                if hasattr(data, "questionsMax")
                else False
            )
            questions_enabled = questions_requested and (
                agent_role_str == "outline"  # Base role supports all
                or "questions" in agent_role_str
            )
            images_enabled = (
                agent_role_str == "outline"  # Base role supports all
                or "image" in agent_role_str
            )
            # Documents enabled if agent supports templates AND template documents exist
            # For now, videos don't have template documents like scenarios, so this is False
            has_template_documents = (
                False  # TODO: Add template document support for videos if needed
            )
            documents_enabled = has_template_documents and (
                agent_role_str == "outline"  # Base role supports all
                or "document" in agent_role_str
            )
            # Note: video tool doesn't have separate role flag - it's triggered conditionally

            logger.info(
                f"Agent role: {agent_role}, questions_enabled: {questions_enabled}, "
                f"images_enabled: {images_enabled}, documents_enabled: {documents_enabled}"
            )

            # Use video_id as primary_id if available, otherwise trace_id
            primary_id = str(video_id) if video_id else trace_id

            # Create video outline generation tools inline
            from pydantic import Field

            outline_tools: list[Tool] = []

            # 1. Outline Tool (always included - replaces create_outline_tools)
            async def set_outline(
                name: str = Field(
                    description="Short, descriptive name for the outline (e.g., 'Video Outline v1')"
                ),
                outline: str = Field(
                    description="The detailed outline content for the video"
                ),
                question_timestamps: Any | None = Field(
                    default=None,
                    description="REQUIRED if questions were provided - Dictionary mapping question IDs (use exact IDs from the questions section: 1, 2, 3, etc.) to lists of timestamps (in seconds) where each question should appear. Timestamps must be integers between 0 and video_length_seconds (inclusive). Format as JSON object. Example for 4-second video: {'1': [0, 2], '2': [3]}. Example for 60-second video: {'1': [10, 30], '2': [45]}. You MUST assign timestamps to ALL questions that were provided.",
                ),
            ) -> str:
                """Set the outline for the video.

                Args:
                    name: Short descriptive name for the outline
                    outline: The detailed outline content
                    question_timestamps: Optional dictionary mapping question IDs to lists of timestamps

                Returns:
                    Confirmation message
                """
                # Emit to internal bus for outline creation
                await internal_sio.emit(
                    "video_tool_outline",
                    {
                        "sid": sid,
                        "trace_id": trace_id,
                        "name": name,
                        "outline": outline,
                        "video_id": data.videoId if data.videoId else None,
                        "question_timestamps": question_timestamps,
                    },
                )

                logger.info(
                    f"[video_outline] Emitted outline to internal bus: "
                    f"name={name}, outline_length={len(outline)}"
                )
                return "Set outline successfully"

            outline_tools.append(function_tool(set_outline))
            logger.info("Created outline tool")

            # 2. Questions Tool (if enabled)
            if questions_enabled:

                async def create_questions(
                    questions: list[dict[str, Any]] = Field(
                        description="List of question objects. Each question should have 'question_text', 'allow_multiple' (bool), and 'options' (list of dicts with 'option_text', 'type' ('discrete' or 'freeform'), 'is_correct' (bool)). For multiple choice: allow_multiple=False, one correct option. For multi-select: allow_multiple=True, multiple correct options."
                    ),
                    question_timestamps: dict[str, list[int]] | None = Field(
                        default=None,
                        description="Dictionary mapping question IDs (use '1', '2', etc. based on question order) to lists of timestamps (in seconds) where each question should appear.",
                    ),
                ) -> str:
                    """Create questions for the video.

                    Args:
                        questions: List of question objects with text, options, and correct answers
                        question_timestamps: Optional dictionary mapping question IDs to timestamps

                    Returns:
                        Confirmation message
                    """
                    # Emit to internal bus for questions creation
                    await internal_sio.emit(
                        "video_tool_questions",
                        {
                            "sid": sid,
                            "trace_id": trace_id,
                            "questions": questions,
                            "video_id": data.videoId if data.videoId else None,
                            "question_timestamps": question_timestamps,
                        },
                    )

                    logger.info(
                        f"[video_outline] Emitted questions to internal bus: "
                        f"{len(questions)} questions"
                    )
                    return f"Created {len(questions)} questions successfully"

                outline_tools.append(function_tool(create_questions))
                logger.info("Created questions tool")
            else:
                logger.info("Questions tool skipped (questions_enabled=False)")

            # 3. Image Generation Tool (if enabled)
            if images_enabled:
                if not final_profile_id:
                    logger.warning(
                        "profile_id required for image generation, skipping tool"
                    )
                else:

                    async def generate_image(
                        name: str = Field(
                            description="Descriptive name for the generated image"
                        ),
                        prompt: str = Field(
                            description="Detailed, descriptive prompt for image generation"
                        ),
                    ) -> str:
                        """Generate an image from a detailed prompt.

                        This tool creates an image using AI image generation based on your detailed prompt.
                        The image will be saved and linked to the video after generation completes.

                        Args:
                            name: Descriptive name for the image (required)
                            prompt: Detailed, descriptive prompt describing what the image should look like (required)

                        Returns:
                            Confirmation message
                        """
                        # Emit to internal bus for image creation
                        await internal_sio.emit(
                            "video_tool_image",
                            {
                                "sid": sid,
                                "trace_id": trace_id,
                                "name": name,
                                "prompt": prompt,
                                "agent_id": str(context["agent_id"]),
                                "department_id": str(department_id)
                                if department_id
                                else None,
                                "profile_id": str(final_profile_id)
                                if final_profile_id
                                else None,
                                "video_id": data.videoId if data.videoId else None,
                            },
                        )

                        logger.info(
                            f"[video_outline] Emitted image to internal bus: "
                            f"name={name}, prompt_length={len(prompt)}"
                        )
                        return f"Image generation initiated for '{name}'. Image will be created and linked when ready."

                    outline_tools.append(function_tool(generate_image))
                    logger.info("Created image generation tool")
            else:
                logger.info("Image generation tool skipped (images_enabled=False)")

            # 4. Video Generation Tool (always available, but conditionally triggered)
            async def generate_video(
                prompt: str = Field(
                    description="The video generation prompt based on the outline"
                ),
                image_ids: list[str] | None = Field(
                    default=None,
                    description="Optional list of image IDs to use for video generation. If provided, video generation will wait for all images to complete before starting.",
                ),
            ) -> str:
                """Generate a video from the outline prompt.

                If image_ids are provided, video generation will wait for all images to complete
                before starting. Otherwise, video generation starts immediately.

                Args:
                    prompt: The video generation prompt
                    image_ids: Optional list of image IDs (if images are required)

                Returns:
                    Confirmation message
                """
                # Emit to internal bus for video generation
                await internal_sio.emit(
                    "video_tool_video",
                    {
                        "sid": sid,
                        "trace_id": trace_id,
                        "prompt": prompt,
                        "video_id": data.videoId if data.videoId else "",
                        "image_ids": image_ids,
                        "agent_id": str(context["agent_id"]),
                        "department_id": str(department_id) if department_id else None,
                    },
                )

                logger.info(
                    f"[video_outline] Emitted video generation to internal bus: "
                    f"prompt_length={len(prompt)}, image_ids={image_ids}"
                )
                if image_ids:
                    return f"Video generation queued. Waiting for {len(image_ids)} image(s) to complete."
                return "Video generation started."

            outline_tools.append(function_tool(generate_video))
            logger.info("Created video generation tool")

            # 5. Dynamic Document Tool (if enabled)
            if documents_enabled:
                # TODO: Implement document tool for videos when template documents are supported
                logger.info("Document tool skipped (not yet implemented for videos)")
            else:
                logger.info("Dynamic document tool skipped (documents_enabled=False)")

            # Add debug info tool
            outline_tools.append(debug_info_tool)

            logger.info(f"Total video outline tools created: {len(outline_tools)}")

            # Create tool use behavior to check when all required tools are called
            def tool_use_behavior(
                tool_context: RunContextWrapper[Any],
                tool_results: list[FunctionToolResult],
            ) -> ToolsToFinalOutputResult:
                """Check if all required tools have been called.

                Required tools:
                - set_outline (always required)
                - create_questions (if questions_enabled)
                """
                required_tools = ["set_outline"]
                if questions_enabled:
                    required_tools.append("create_questions")

                # Check which tools have been called
                completed_tools = []
                logger.info(
                    f"tool_use_behavior called with {len(tool_results)} tool results"
                )

                for idx, result in enumerate(tool_results):
                    # Try multiple ways to get tool name
                    tool_name = None

                    # Try direct attribute access
                    if hasattr(result, "tool_name"):
                        tool_name = result.tool_name  # type: ignore[attr-defined]
                    else:
                        tool_name = getattr(result, "tool_name", None)  # type: ignore[misc]
                        if not tool_name:
                            tool_name = getattr(result, "name", None)  # type: ignore[misc]

                    # Try to get tool name from tool object if result has one
                    if not tool_name:
                        tool_obj = getattr(result, "tool", None)  # type: ignore[misc]
                        if tool_obj:
                            tool_name = getattr(tool_obj, "name", None)  # type: ignore[misc]

                    if tool_name and isinstance(tool_name, str):
                        # Normalize tool names
                        normalized_name = tool_name
                        if "outline" in tool_name.lower():
                            normalized_name = "set_outline"
                        elif "question" in tool_name.lower():
                            normalized_name = "create_questions"
                        completed_tools.append(normalized_name)
                        logger.info(
                            f"Tool result {idx}: Normalized to {normalized_name}"
                        )
                    else:
                        logger.warning(
                            f"Tool result {idx}: Could not extract tool name"
                        )

                # Check if all required tools have been completed
                all_completed = all(tool in completed_tools for tool in required_tools)

                logger.info(
                    f"Tool use behavior check: required={required_tools}, "
                    f"completed={completed_tools}, all_completed={all_completed}"
                )

                return ToolsToFinalOutputResult(is_final_output=all_completed)

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

            # Rate limit validation and run creation are now handled in SQL
            # (get_outline_run_context_and_create_run.sql) - both happen atomically
            # If we get here, rate limit check passed and run was created successfully

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(context_row["run_id"])

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

            # Emit async pricing event via internal bus (non-blocking)
            # This handles token updates and message logging in background
            await internal_sio.emit(
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
        logger.error(f"Error in video_outline for {sid}: {str(e)}", exc_info=True)
        await video_outline_generation_error(
            VideoOutlineGenerationErrorPayload(
                success=False, message=str(e), trace_id=trace_id
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def video_outline(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = GenerateVideoOutlinePayload(**data)
        await _video_outline_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in video_outline for {sid}: {e}")
        await video_outline_generation_error(
            VideoOutlineGenerationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}", trace_id=None
            ),
            room=sid,
        )
