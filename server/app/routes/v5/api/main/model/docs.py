"""Model artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.routes.v5.tools.resources.names.get import get_names_internal
from app.infra.globals import get_db
from app.sql.types import GetModelDocsSqlParams, GetModelDocsSqlRow
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/models/get_model_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="model",
    plural_name="models",
    table_name="model_artifact",
    junction_prefix="model",
    fk_pattern="model_%",
    api_routing={
        "base_path": "/api/v5/models",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single model by ID",
                "request_model": "GetModelApiRequest",
                "response_model": "GetModelApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a model",
                "request_model": "SaveModelApiRequest",
                "response_model": "SaveModelApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List models with optional filters",
                "request_model": "GetModelsListApiRequest",
                "response_model": "GetModelsListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing model",
                "request_model": "DuplicateModelApiRequest",
                "response_model": "DuplicateModelApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a model",
                "request_model": "DeleteModelApiRequest",
                "response_model": "DeleteModelApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a model draft (autosave)",
                "request_model": "PatchModelDraftApiRequest",
                "response_model": "PatchModelDraftApiResponse",
            },
        },
    },
    glow_context={
        "description": (
            "Models represent AI models used in GLOW for various"
            " AI operations. They can be associated with"
            " providers and assigned to agents."
        ),
        "use_cases": [
            "Defining AI models for use in GLOW",
            "Associating models with providers",
            "Assigning models to agents",
        ],
        "related_concepts": [
            "Agents - Models can be assigned to agents",
            "Providers - Models are associated with providers",
            "Resources - Models use multiple resource types for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Models",
        list_description="Manage AI language models for teaching assistant training simulations. Configure and customize AI models to power realistic student personas and enhance simulation-based learning experiences for pedagogical development.",
        detail_title="Model",
        detail_description="AI language model configuration for teaching assistant training simulations. Customize model settings to power realistic student personas and enhance simulation-based learning experiences.",
        new_title="Create Model",
        new_description="Create a new AI language model configuration for teaching assistant training simulations. Set up custom models to power realistic student personas and enhance simulation-based learning experiences for pedagogical development.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_model_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetModelDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetModelDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names_internal(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_models_docs() -> dict[str, Any]:
    """Get model documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
