"""Rubric artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.v5.api.resources.names.get import get_names_internal
from app.main import get_db
from app.v5.sql.types import GetRubricDocsSqlParams, GetRubricDocsSqlRow
from app.v5.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/rubrics/get_rubric_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="rubric",
    plural_name="rubrics",
    table_name="rubric_artifact",
    junction_prefix="rubric",
    fk_pattern="rubric_%",
    api_routing={
        "base_path": "/api/v5/rubrics",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single rubric by ID",
                "request_model": "GetRubricApiRequest",
                "response_model": "GetRubricApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a rubric",
                "request_model": "SaveRubricApiRequest",
                "response_model": "SaveRubricApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List rubrics with optional filters",
                "request_model": "GetRubricsListApiRequest",
                "response_model": "GetRubricsListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing rubric",
                "request_model": "DuplicateRubricApiRequest",
                "response_model": "DuplicateRubricApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a rubric",
                "request_model": "DeleteRubricApiRequest",
                "response_model": "DeleteRubricApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a rubric draft (autosave)",
                "request_model": "PatchRubricDraftApiRequest",
                "response_model": "PatchRubricDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": "Rubrics represent assessment and grading criteria used in GLOW for evaluating student performance.",
        "use_cases": [
            "Defining assessment criteria",
            "Creating grading rubrics",
            "Organizing rubrics by department",
            "Associating points and standard groups with rubrics",
        ],
        "related_concepts": [
            "Points - Rubrics can be associated with points for scoring",
            "Standard Groups - Rubrics can be associated with standard groups",
            "Resources - Rubrics use multiple resource types for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Rubrics",
        list_description="Manage assessment rubrics for teaching assistant evaluation. Create and customize rubric-based evaluation criteria to assess pedagogical performance, teaching effectiveness, and student interaction skills.",
        detail_title="Rubric",
        detail_description="Assessment rubric for teaching assistant evaluation. Customize rubric-based evaluation criteria to assess pedagogical performance, teaching effectiveness, and student interaction skills.",
        new_title="New Rubric",
        new_description="Create a new assessment rubric for teaching assistant evaluation. Design rubric-based evaluation criteria to assess pedagogical performance, teaching effectiveness, and student interaction skills through structured assessment frameworks.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_rubric_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetRubricDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetRubricDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names_internal(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_rubrics_docs() -> dict[str, Any]:
    """Get rubric documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
