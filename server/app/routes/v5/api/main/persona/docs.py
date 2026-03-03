"""Persona artifact documentation."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends

from app.routes.v5.api.main.persona import permissions
from app.routes.v5.tools.resources.names.get import get_names_internal
from app.infra.globals import get_db
from app.sql.types import GetPersonaDocsSqlParams, GetPersonaDocsSqlRow
from app.utils.docs_helper import (
    ArtifactDocsConfig,
    DocsApiRequest,
    DocsApiResponse,
    PageMetadataConfig,
    build_artifact_docs_static,
    compute_docs_metadata,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/personas/get_persona_docs_complete.sql"

CONFIG = ArtifactDocsConfig(
    name="persona",
    plural_name="personas",
    table_name="persona_artifact",
    junction_prefix="persona",
    fk_pattern="persona_%",
    permissions_module=permissions,
    permission_functions=[
        "compute_can_edit",
        "compute_can_delete",
        "compute_can_duplicate",
        "compute_can_create",
        "compute_can_draft",
        "has_access",
    ],
    api_routing={
        "base_path": "/api/v5/personas",
        "endpoints": {
            "get": {
                "path": "/get",
                "method": "POST",
                "description": "Get a single persona by ID",
                "request_model": "GetPersonaApiRequest",
                "response_model": "GetPersonaApiResponse",
            },
            "save": {
                "path": "/save",
                "method": "POST",
                "description": "Create or update a persona",
                "request_model": "SavePersonaApiRequest",
                "response_model": "SavePersonaApiResponse",
            },
            "list": {
                "path": "/list",
                "method": "POST",
                "description": "List personas with optional filters",
                "request_model": "GetPersonasListApiRequest",
                "response_model": "GetPersonasListApiResponse",
            },
            "duplicate": {
                "path": "/duplicate",
                "method": "POST",
                "description": "Duplicate an existing persona",
                "request_model": "DuplicatePersonaApiRequest",
                "response_model": "DuplicatePersonaApiResponse",
            },
            "delete": {
                "path": "/delete",
                "method": "POST",
                "description": "Delete a persona",
                "request_model": "DeletePersonaApiRequest",
                "response_model": "DeletePersonaApiResponse",
            },
            "draft": {
                "path": "/draft",
                "method": "PATCH",
                "description": "Create or patch a persona draft (autosave)",
                "request_model": "PatchPersonaDraftApiRequest",
                "response_model": "PatchPersonaDraftApiResponse",
            },
            "docs": {
                "path": "/docs",
                "method": "POST",
                "description": "Get comprehensive persona documentation",
            },
        },
    },
    glow_context={
        "description": (
            "Personas represent AI characters used in scenarios to provide "
            "different perspectives, roles, or personalities. They are central "
            "to GLOW's simulation and practice features, allowing students to "
            "interact with various AI characters in realistic scenarios."
        ),
        "use_cases": [
            "Creating AI characters for scenario-based learning",
            "Defining different roles in simulations (e.g., patient, doctor, administrator)",
            "Customizing AI behavior through instructions and examples",
            "Organizing personas by department or field",
            "Using personas in messages and model runs for consistent character representation",
        ],
        "related_concepts": [
            "Scenarios - Personas are assigned to scenarios to define available characters",
            "Messages - Messages can be associated with personas to indicate which character is speaking",
            "Runs - Model runs reference personas to track which character generated responses",
            "Parameters - Personas can be linked to parameters for configuration",
            "Resources - Personas use multiple resource types for rich representation",
        ],
    },
    page_metadata=PageMetadataConfig(
        list_title="Personas",
        list_description="Manage AI-powered student personas for teaching assistant training. Create and organize realistic student profiles with diverse personalities and learning styles to enhance simulation-based pedagogical practice and student interaction training.",
        detail_title="Persona",
        detail_description="AI-powered student persona for simulation-based teaching assistant training. Practice pedagogical techniques and student interaction strategies in realistic educational scenarios.",
        new_title="New Persona",
        new_description="Create a new AI-powered student persona for teaching assistant training. Design realistic student profiles with unique personalities and learning styles to practice pedagogical techniques and improve student interaction skills through simulation-based learning.",
    ),
)

router = APIRouter()


@router.post("/docs", response_model=DocsApiResponse)
async def get_persona_docs_endpoint(
    request: DocsApiRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DocsApiResponse:
    entity_name: str | None = None
    if request.entity_id:
        params = GetPersonaDocsSqlParams(p_entity_id=request.entity_id)
        row = cast(
            GetPersonaDocsSqlRow | None,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )
        if row and row.name_id:
            names = await get_names_internal(conn, [row.name_id])
            if names:
                entity_name = names[0].name
    return compute_docs_metadata(CONFIG.page_metadata, entity_name)


def get_personas_docs() -> dict[str, Any]:
    """Get persona documentation (static portions only, for MCP)."""
    return build_artifact_docs_static(CONFIG)
