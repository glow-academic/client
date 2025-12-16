"""Handler for scenario_tool_questions WebSocket event."""

import json
import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_internal_sio, get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class QuestionOption(BaseModel):
    """Option for a question."""

    option_text: str
    is_correct: bool


class QuestionItem(BaseModel):
    """Question item for scenario questions tool."""

    question_text: str
    allow_multiple: bool
    options: list[QuestionOption]


class ScenarioQuestionsToolPayload(BaseModel):
    """Request to create questions from scenario generation tool."""

    trace_id: str
    questions: list[QuestionItem]
    scenario_id: str
    video_id: str | None = (
        None  # Optional: if provided, link question timestamps to video
    )
    question_timestamps: dict[str, list[int]] | None = (
        None  # Maps question IDs to timestamps (requires video_id)
    )


class ScenarioQuestionsToolCompletePayload(BaseModel):
    """Response indicating questions tool completed successfully."""

    success: bool
    question_ids: list[str]
    trace_id: str
    message: str | None = None


class ScenarioQuestionsToolErrorPayload(BaseModel):
    """Response indicating an error occurred in questions tool."""

    success: bool
    message: str
    trace_id: str


async def scenario_questions_tool_complete(
    payload: ScenarioQuestionsToolCompletePayload, room: str
) -> None:
    logger.info(
        f"[scenario_tool_questions_complete] Emitting complete event: "
        f"room={room}, trace_id={payload.trace_id}, "
        f"question_ids={len(payload.question_ids)} questions"
    )
    await sio.emit(
        "scenarios_tools_questions_complete", payload.model_dump(), room=room
    )
    logger.info(f"[scenario_tool_questions_complete] Emitted to room={room}")


async def scenario_questions_tool_error(
    payload: ScenarioQuestionsToolErrorPayload, room: str
) -> None:
    await sio.emit("scenarios_tools_questions_error", payload.model_dump(), room=room)


async def _scenario_tool_questions_impl(sid: str, data: dict[str, Any]) -> None:
    """Internal implementation for questions creation in scenario context."""
    logger.info(
        f"[scenario_tool_questions] Handler received event: sid={sid}, "
        f"data={data}, trace_id={data.get('trace_id', 'unknown')}"
    )
    try:
        validated = ScenarioQuestionsToolPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in scenario_tool_questions for {sid}: {e}")
        await scenario_questions_tool_error(
            ScenarioQuestionsToolErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                trace_id=data.get("trace_id", "unknown"),
            ),
            room=sid,
        )
        return

    trace_id = validated.trace_id
    pool = get_pool()

    if not pool:
        await scenario_questions_tool_error(
            ScenarioQuestionsToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
        return

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with pool.acquire() as conn:
            scenario_id_uuid = uuid.UUID(validated.scenario_id)
            video_id_uuid = (
                uuid.UUID(validated.video_id) if validated.video_id else None
            )

            # Convert questions to JSON format expected by SQL
            questions_dicts = [q.model_dump() for q in validated.questions]
            questions_json = json.dumps(questions_dicts)

            # Create questions and link to scenario
            sql = load_sql("sql/v3/questions/create_questions_with_options.sql")
            sql_query = sql
            sql_params = (questions_json,)

            question_rows = await conn.fetch(sql, *sql_params)

            if not question_rows or len(question_rows) == 0:
                await scenario_questions_tool_error(
                    ScenarioQuestionsToolErrorPayload(
                        success=False,
                        message="Failed to create questions",
                        trace_id=trace_id,
                    ),
                    room=sid,
                )
                return

            question_ids = [str(row["question_id"]) for row in question_rows]

            # Link questions to scenario
            link_questions_sql = load_sql(
                "sql/v3/scenarios/link_questions_to_scenario.sql"
            )
            try:
                for question_id in question_ids:
                    await conn.execute(
                        link_questions_sql,
                        str(scenario_id_uuid),
                        question_id,
                        True,  # active
                    )
                logger.info(
                    f"✓ Linked {len(question_ids)} questions to scenario {scenario_id_uuid}"
                )
            except Exception as e:
                logger.warning(
                    f"Failed to link questions to scenario (may need to create SQL file): {e}"
                )

            # Save question timestamps if provided (requires video_id)
            if validated.question_timestamps and video_id_uuid:
                # Link timestamps to scenario_question_times
                save_timestamps_sql = load_sql(
                    "sql/v3/scenarios/save_question_timestamps.sql"
                )
                try:
                    timestamps_json = json.dumps(validated.question_timestamps)
                    await conn.execute(
                        save_timestamps_sql,
                        str(scenario_id_uuid),
                        str(video_id_uuid),
                        timestamps_json,
                    )
                    logger.info(
                        f"✓ Saved question timestamps for scenario {scenario_id_uuid} and video {video_id_uuid}"
                    )
                except Exception as e:
                    logger.warning(f"Failed to save question timestamps: {e}")

            logger.info(
                f"✓ Created {len(question_ids)} questions for scenario {scenario_id_uuid} "
                f"(video_id={validated.video_id}, trace_id={trace_id})"
            )

            await scenario_questions_tool_complete(
                ScenarioQuestionsToolCompletePayload(
                    success=True,
                    question_ids=question_ids,
                    trace_id=trace_id,
                    message=f"Created {len(question_ids)} questions successfully",
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(
            f"Error in scenario_tool_questions for {sid}: {str(e)}", exc_info=True
        )
        await scenario_questions_tool_error(
            ScenarioQuestionsToolErrorPayload(
                success=False, message=str(e), trace_id=trace_id
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def scenario_tool_questions(sid: str, data: dict[str, Any]) -> None:
    """Handle questions creation event from scenario generation tool (client-to-server)."""
    await _scenario_tool_questions_impl(sid, data)


@internal_sio.on("scenario_tool_questions")
async def scenario_tool_questions_internal(data: dict[str, Any]) -> None:
    """Handle questions creation event from internal bus (server-to-server)."""
    sid = data.get("sid")
    if not sid:
        logger.error("[scenario_tool_questions_internal] Missing 'sid' in payload")
        return
    # Remove sid from data before passing to implementation
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _scenario_tool_questions_impl(sid, payload)


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/questions", response_model=dict[str, bool])
async def scenario_tool_questions_api(
    request: ScenarioQuestionsToolPayload,
) -> dict[str, bool]:
    """Client-to-server event: Create questions from scenario generation tool."""
    return {"success": True}


@server_router.post("/questions_complete", response_model=dict[str, bool])
async def scenario_questions_tool_complete_api(
    request: ScenarioQuestionsToolCompletePayload,
) -> dict[str, bool]:
    """Server-to-client event: Questions tool completed successfully."""
    return {"success": True}


@server_router.post("/questions_error", response_model=dict[str, bool])
async def scenario_questions_tool_error_api(
    request: ScenarioQuestionsToolErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in questions tool."""
    return {"success": True}
