"""Scenario save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (input_scenario_id = NULL) and update (input_scenario_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    SaveScenarioApiRequest,
    SaveScenarioApiResponse,
    SaveScenarioSqlParams,
    SaveScenarioSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/scenarios/save_scenario_complete.sql"


router = APIRouter()


@router.post(
    "/save",
    response_model=SaveScenarioApiResponse,
    dependencies=[
        audit_activity(
            "scenario.saved",
            "{{ actor.name }} {% if scenario %}updated{% else %}created{% endif %} scenario{% if scenario %} '{{ scenario.name }}'{% endif %}",
        )
    ],
)
async def save_scenario(
    request: SaveScenarioApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveScenarioApiResponse:
    """Save scenario - handles both create (input_scenario_id = NULL) and update (input_scenario_id provided)."""
    tags = ["scenarios"]  # From router tags

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Server-side validation: enforce fixed limits (server is source of truth)
        # Only validate for create mode (input_scenario_id = NULL)
        if request.input_scenario_id is None:
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

        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            # Convert API request to SQL params (add profile_id from header)
            # Map input_scenario_id from API request (already correct field name)
            params = SaveScenarioSqlParams(
                **request.model_dump(),
                profile_id=profile_id,
            )
            sql_params = params.to_tuple()

            # Execute SQL with typed helper - automatically detects and calls function if present
            result = cast(
                SaveScenarioSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

            if not result or not result.scenario_id:
                if request.input_scenario_id:
                    raise ValueError(f"Scenario not found: {request.input_scenario_id}")
                else:
                    raise ValueError("Failed to create scenario")

            # Set audit context with data from SQL query
            if result.actor_name:
                audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
                # Only add scenario to audit context if input_scenario_id was provided (update mode)
                # For create mode, we'll use the request name if available
                if request.input_scenario_id:
                    # Update mode: use request name (from request body)
                    audit_ctx["scenario"] = {
                        "name": getattr(request, "name", "Scenario"),
                        "id": str(result.scenario_id),
                    }
                else:
                    # Create mode: use request name
                    audit_ctx["scenario"] = {
                        "name": getattr(request, "name", "Scenario"),
                        "id": str(result.scenario_id),
                    }
                audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = SaveScenarioApiResponse.model_validate(
            {
                "scenario_id": str(result.scenario_id),
                "actor_name": result.actor_name,
            }
        )

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
            operation="save_scenario",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
