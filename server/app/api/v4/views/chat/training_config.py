"""Training config service — replaces subbundle_snapshot CTE from attempt_chats_mv."""

from uuid import UUID

import asyncpg
from pydantic import BaseModel

from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/views/chat/training_config/get_training_config_complete.sql"
)


class TrainingConfig(BaseModel):
    """Training department config flags + resource ID arrays."""

    training_department_id: UUID
    # Config flags
    copy_paste_allowed: bool = True
    text_enabled: bool = True
    audio_enabled: bool = True
    hints_enabled: bool = True
    show_images: bool = True
    show_objectives: bool = True
    show_problem_statement: bool = True
    time_limit_seconds: int = 0
    negative: bool = False
    # Singular picks
    scenario_id: UUID | None = None
    rubric_id: UUID | None = None
    problem_statement_id: UUID | None = None
    # Plural sets
    persona_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None
    option_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    video_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None


async def get_training_config_internal(
    conn: asyncpg.Connection,
    training_department_ids: list[UUID],
    bypass_cache: bool = False,
) -> dict[UUID, TrainingConfig]:
    """Fetch training config for a batch of training_department_ids.

    Returns a dict keyed by training_department_id for easy lookup.
    Cacheable — training config rarely changes.
    """
    if not training_department_ids:
        return {}

    from app.sql.types import GetTrainingConfigSqlParams

    cache_key_val = cache_key(
        "views/chat/training_config/get",
        {"ids": sorted(str(i) for i in training_department_ids)},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            configs: dict[UUID, TrainingConfig] = {}
            for key, val in cached.items():
                configs[UUID(key)] = TrainingConfig.model_validate(val)
            return configs

    params = GetTrainingConfigSqlParams(training_department_ids=training_department_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    configs = {}
    if result and result.items:
        for item in result.items:
            configs[item.training_department_id] = TrainingConfig(
                training_department_id=item.training_department_id,
                copy_paste_allowed=item.copy_paste_allowed
                if item.copy_paste_allowed is not None
                else True,
                text_enabled=item.text_enabled
                if item.text_enabled is not None
                else True,
                audio_enabled=item.audio_enabled
                if item.audio_enabled is not None
                else True,
                hints_enabled=item.hints_enabled
                if item.hints_enabled is not None
                else True,
                show_images=item.show_images if item.show_images is not None else True,
                show_objectives=item.show_objectives
                if item.show_objectives is not None
                else True,
                show_problem_statement=item.show_problem_statement
                if item.show_problem_statement is not None
                else True,
                time_limit_seconds=item.time_limit_seconds or 0,
                negative=item.negative or False,
                scenario_id=item.scenario_id,
                rubric_id=item.rubric_id,
                problem_statement_id=item.problem_statement_id,
                persona_ids=list(item.persona_ids) if item.persona_ids else None,
                objective_ids=list(item.objective_ids) if item.objective_ids else None,
                question_ids=list(item.question_ids) if item.question_ids else None,
                option_ids=list(item.option_ids) if item.option_ids else None,
                image_ids=list(item.image_ids) if item.image_ids else None,
                video_ids=list(item.video_ids) if item.video_ids else None,
                document_ids=list(item.document_ids) if item.document_ids else None,
                standard_group_ids=list(item.standard_group_ids)
                if item.standard_group_ids
                else None,
                standard_ids=list(item.standard_ids) if item.standard_ids else None,
            )

    # Cache with longer TTL — training config rarely changes
    await set_cached(
        cache_key_val,
        {str(k): v.model_dump(mode="json") for k, v in configs.items()},
        ttl=300,
        tags=["views", "chat", "training_config"],
    )

    return configs
