"""Scenario create endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    CreateScenarioApiRequest,
    CreateScenarioApiResponse,
    CreateScenarioSqlParams,
    CreateScenarioSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/scenario/create_scenario_complete.sql"


router = APIRouter()


@router.post(
    "/create",
    response_model=CreateScenarioApiResponse,
    dependencies=[
        audit_activity(
            "scenario.created",
            "{{ actor.name }} created scenario '{{ scenario.name }}'",
        )
    ],
)
async def create_scenario(
    request: CreateScenarioApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateScenarioApiResponse:
    """Create a new scenario."""
    tags = ["scenarios"]  # From router tags

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Server-side validation: enforce fixed limits (server is source of truth)
        # Personas: 1-3 (must have at least 1)
        persona_count = len(request.persona_ids or [])
        if persona_count < 1 or persona_count > 3:
            raise ValueError(
                f"Personas must be between 1 and 3. Received {persona_count}."
            )

        # Documents: 0-3
        document_count = len(request.document_ids or [])
        if document_count > 3:
            raise ValueError(
                f"Documents must be between 0 and 3. Received {document_count}."
            )

        # Parameters: 0-3
        parameter_count = len(request.parameters or [])
        if parameter_count > 3:
            raise ValueError(
                f"Parameters must be between 0 and 3. Received {parameter_count}."
            )

        # Each parameter's fields: 1-3 per parameter
        for param in request.parameters or []:
            field_ids = param.field_ids or []
            field_count = len(field_ids)
            if field_count < 1 or field_count > 3:
                raise ValueError(
                    f"Fields for parameter {param.parameter_id} must be between 1 and 3. "
                    f"Received {field_count}."
                )

        # Objectives: 0-3 (SQL will filter composite IDs)
        objective_count = len(request.objective_ids or [])
        if objective_count > 3:
            raise ValueError(
                f"Objectives must be between 0 and 3. Received {objective_count}."
            )

        # Validate upload_ids and image_names match in length
        if len(request.upload_ids or []) != len(request.image_names or []):
            raise ValueError("upload_ids and image_names must have the same length")

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

        # Convert API request to SQL params (use double star pattern)
        # SQL handles preprocessing (objective filtering, parameter flattening, problem statement processing, upload_images_json construction)
        params = CreateScenarioSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper (single row result)
        result = cast(
            CreateScenarioSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not result.scenario_id:
            raise ValueError("Failed to create scenario")

        actor_name = result.actor_name

        # Set audit context with data from SQL query
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                scenario={"name": request.name, "id": str(result.scenario_id)},
            )

        # Convert SQL result to API response
        api_response = CreateScenarioApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
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
