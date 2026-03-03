"""Eval artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.routes.v5.tools.resources.names.get import get_names_internal
from app.infra.globals import get_db
from app.sql.types import GetEvalDocsSqlParams, GetEvalDocsSqlRow
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/evals/get_eval_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="eval",
    plural_name="evals",
    table_name="eval_artifact",
    junction_prefix="eval",
    fk_pattern="eval_%",
    api_routing={
        "base_path": "/api/v5/evals",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single eval by ID",
                "request_model": "GetEvalApiRequest",
                "response_model": "GetEvalApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update an eval",
                "request_model": "SaveEvalApiRequest",
                "response_model": "SaveEvalApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List evals with optional filters",
                "request_model": "GetEvalsListApiRequest",
                "response_model": "GetEvalsListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing eval",
                "request_model": "DuplicateEvalApiRequest",
                "response_model": "DuplicateEvalApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete an eval",
                "request_model": "DeleteEvalApiRequest",
                "response_model": "DeleteEvalApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch an eval draft (autosave)",
                "request_model": "PatchEvalDraftApiRequest",
                "response_model": "PatchEvalDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Evals represent evaluation and assessment configurations in GLOW. They are used to define evaluation criteria, link to agents and groups, and track evaluation runs.",
        "use_cases": [
            "Creating evaluation configurations",
            "Linking evals to agents for evaluation workflows",
            "Organizing evals by department",
            "Tracking evaluation runs and results",
            "Using evals in assessment scenarios",
        ],
        "related_concepts": [
            "Agents - Evals can be linked to multiple agents",
            "Groups - Evals can be linked to groups",
            "Runs - Evals track evaluation runs",
            "Rubrics - Evals can reference rubrics for grading",
            "Resources - Evals use multiple resource types for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Evals",
        list_description="Manage automated evaluation runs for teaching assistant assessments. Configure and execute batch evaluations to analyze pedagogical performance, teaching effectiveness, and student interaction quality across multiple practice sessions.",
        detail_title="Eval",
        detail_description="View and edit automated evaluation runs for teaching assistant assessments. Monitor batch evaluation progress, review pedagogical performance metrics, and analyze teaching effectiveness across multiple practice sessions.",
        new_title="Create Eval",
        new_description="Create a new automated evaluation run for teaching assistant assessments. Configure batch evaluations to analyze pedagogical performance, teaching effectiveness, and student interaction quality across multiple practice sessions.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_eval_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetEvalDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetEvalDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names_internal(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_evals_docs() -> dict[str, Any]:
    """Get eval documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
