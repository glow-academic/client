"""Scenario create endpoint - v3 API following DHH principles."""

import json
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.infra.activity.audit import audit_activity, audit_set
from utils.cache.invalidate_tags import invalidate_tags
from app.infra.error.handle_route_error import handle_route_error
from utils.sql_helper import load_sql


# Inline request/response schemas
class CreateScenarioRequest(BaseModel):
    """Request to create a scenario."""

    name: str
    description: str | None = None
    problem_statement: str
    problem_statement_name: str | None = None  # Optional, defaults to scenario name
    problem_statement_versions: list[str] | None = None
    department_ids: list[str] | None
    active: bool
    persona_ids: list[str] | None
    document_ids: list[str]
    template_document_ids: list[str] | None = None
    objective_ids: list[str]
    upload_ids: list[str] | None = None
    image_names: list[str] | None = None
    parameters: dict[str, list[str]]
    objectives_enabled: bool = True
    images_enabled: bool = False
    video_enabled: bool = False
    questions_enabled: bool = False
    problem_statement_enabled: bool = True
    video_agent_id: str | None = None
    video_ids: list[str] | None = None
    active_video_id: str | None = None
    question_ids: list[str] | None = None
    question_timestamps: dict[str, dict[str, list[int]]] | None = None
    video_length: int | None = None  # Optional: Video length in seconds (4, 8, or 12)
    # profileId removed - comes from X-Profile-Id header


class CreateScenarioResponse(BaseModel):
    """Response from create operation."""

    success: bool
    scenarioId: str
    message: str


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateScenarioResponse,
    dependencies=[
        audit_activity(
            "scenario.created",
            "{{ actor.name }} created scenario '{{ scenario.name }}'",
        )
    ],
)
async def create_scenario(
    request: CreateScenarioRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateScenarioResponse:
    """Create a new scenario."""
    tags = ["scenarios"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Prepare data for consolidated SQL
        # Filter out composite objective IDs (references to existing objectives)
        filtered_objective_ids = [
            obj_id
            for obj_id in request.objective_ids
            if not ("_" in obj_id and len(obj_id.split("_")) == 2)
        ]

        # Flatten parameters dict into array of parameter_item_ids
        parameter_item_ids = [
            param_item_id
            for param_item_ids in request.parameters.values()
            for param_item_id in param_item_ids
        ]
        # Extract parameter IDs from parameters dict keys
        parameter_ids = list(request.parameters.keys()) if request.parameters else []

        # Prepare problem statement versions
        # If versions provided, ensure problem_statement is included and will be marked active
        problem_statement_versions = None
        if (
            request.problem_statement_versions
            and len(request.problem_statement_versions) > 0
        ):
            # Clean and include all versions
            versions_list = [
                v.strip() for v in request.problem_statement_versions if v and v.strip()
            ]
            # Ensure problem_statement is in the list (it will be marked active in SQL)
            if (
                request.problem_statement
                and request.problem_statement.strip() not in versions_list
            ):
                versions_list.append(request.problem_statement.strip())
            problem_statement_versions = versions_list if versions_list else None

        # Ensure arrays are not None (use empty arrays)
        department_ids = request.department_ids or []
        persona_ids = request.persona_ids or []
        document_ids = request.document_ids or []
        template_document_ids = request.template_document_ids or []
        objective_ids = filtered_objective_ids or []
        upload_ids = request.upload_ids or []
        image_names = request.image_names or []
        parameter_item_ids = parameter_item_ids or []
        parameter_ids = parameter_ids or []

        # Server-side validation: enforce fixed limits (server is source of truth)
        # Personas: 1-3 (must have at least 1)
        persona_count = len(persona_ids)
        if persona_count < 1 or persona_count > 3:
            raise ValueError(
                f"Personas must be between 1 and 3. Received {persona_count}."
            )

        # Documents: 0-3
        document_count = len(document_ids)
        if document_count > 3:
            raise ValueError(
                f"Documents must be between 0 and 3. Received {document_count}."
            )

        # Parameters: 0-3
        parameter_count = len(parameter_ids)
        if parameter_count > 3:
            raise ValueError(
                f"Parameters must be between 0 and 3. Received {parameter_count}."
            )

        # Each parameter's fields: 1-3 per parameter
        for param_id, field_ids in request.parameters.items():
            field_count = len(field_ids)
            if field_count < 1 or field_count > 3:
                raise ValueError(
                    f"Fields for parameter {param_id} must be between 1 and 3. "
                    f"Received {field_count}."
                )

        # Objectives: 0-3
        objective_count = len(objective_ids)
        if objective_count > 3:
            raise ValueError(
                f"Objectives must be between 0 and 3. Received {objective_count}."
            )

        # Validate upload_ids and image_names match in length
        if len(upload_ids) != len(image_names):
            raise ValueError("upload_ids and image_names must have the same length")

        # Prepare upload images JSON (array of objects with upload_id and name)
        upload_images_json = (
            json.dumps(
                [
                    {"upload_id": upload_id, "name": name}
                    for upload_id, name in zip(upload_ids, image_names)
                ]
            )
            if upload_ids and image_names
            else "[]"
        )

        # Prepare video/question data
        video_ids = request.video_ids or []
        active_video_id = request.active_video_id
        question_ids = request.question_ids or []
        question_timestamps_json = (
            json.dumps(request.question_timestamps)
            if request.question_timestamps
            else None
        )

        # Validate video_agent_id is provided if video_enabled
        if request.video_enabled and not request.video_agent_id:
            raise ValueError("video_agent_id is required when video_enabled is true")

        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Create scenario with all relationships in a single SQL file
        sql_query = load_sql("app/sql/v3/scenarios/create_scenario_complete.sql")
        sql_params = (
            request.name,
            request.description,  # description
            request.active,
            request.objectives_enabled,
            request.images_enabled,
            request.video_enabled,
            request.questions_enabled,
            request.problem_statement_enabled,
            request.video_agent_id,  # video_agent_id (required if video_enabled)
            request.problem_statement,
            request.problem_statement_name,  # Optional problem statement name
            problem_statement_versions,
            department_ids if department_ids else None,
            persona_ids if persona_ids else None,
            document_ids,
            template_document_ids if template_document_ids else None,
            objective_ids,
            parameter_item_ids,
            upload_images_json,
            video_ids if video_ids else None,
            active_video_id,
            question_ids if question_ids else None,
            question_timestamps_json,
            None,  # run_id (for linking AI-generated problem_statements and objectives to runs)
            parameter_ids if parameter_ids else None,
            profile_id,
        )
        result = await conn.fetchrow(sql_query, *sql_params)

        if not result:
            raise ValueError("Failed to create scenario")

        scenario_id = result["scenario_id"]
        actor_name = result.get("actor_name")

        # Set audit context with data from SQL query
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                scenario={"name": request.name, "id": scenario_id},
            )

        result_data = CreateScenarioResponse(
            success=True,
            scenarioId=scenario_id,
            message=f"Scenario '{request.name}' created successfully",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_scenario",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
