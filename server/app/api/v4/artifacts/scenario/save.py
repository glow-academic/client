"""Scenario save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (input_scenario_id = NULL) and update (input_scenario_id provided).
Supports bulk operations and dual-mode fields (ID or value).
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.scenario.permissions import (
    compute_can_create,
    compute_can_edit,
    has_access,
)
from app.api.v4.artifacts.scenario.types import (
    SaveScenarioApiRequest,
    SaveScenarioApiResponse,
    SaveScenarioFieldError,
    SaveScenarioItem,
    SaveScenarioResult,
    SaveScenarioSqlParams,
    SaveScenarioSqlRow,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.resources.descriptions.create import create_descriptions_internal
from app.api.v4.resources.names.create import create_names_internal
from app.api.v4.resources.scenarios.create import create_scenarios_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetScenarioAccessSqlParams,
    GetScenarioAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
SQL_PATH = "app/sql/v4/queries/scenarios/save_scenario_complete.sql"
ACCESS_SQL_PATH = "app/sql/v4/queries/scenarios/get_scenario_access_complete.sql"


router = APIRouter()


async def save_scenario_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None,
    resource_actions: dict[str, Any],
    scenario_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save a scenario from resource actions dict (used by generation complete handler).

    Extracts flat resource IDs from resource_actions, creates the denormalized
    scenarios_resource, then executes the save SQL in a transaction.

    Returns the scenario_id on success, None on failure.
    """
    try:

        def _id(key: str) -> uuid.UUID | None:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return val.get("resource_id")
            return None

        def _ids(key: str) -> list[uuid.UUID] | None:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return val.get("resource_ids")
            return None

        name_id = _id("names")
        description_id = _id("descriptions")
        problem_statement_id = _id("problem_statements")
        flag_ids = _ids("flags")
        department_ids = _ids("departments")
        persona_ids = _ids("personas")
        document_ids = _ids("documents")
        parameter_ids = _ids("parameters")
        parameter_field_ids = _ids("parameter_fields")
        image_ids = _ids("images")
        objective_ids = _ids("objectives")
        video_ids = _ids("videos")
        question_ids = _ids("questions")
        option_ids = _ids("options")

        async with conn.transaction():
            # Create denormalized scenarios_resource
            scenarios_resource_id = await create_scenarios_internal(
                conn,
                name_id=name_id,
                description_id=description_id,
                department_ids=department_ids,
                persona_ids=persona_ids,
                parameter_ids=parameter_ids,
                parameter_field_ids=parameter_field_ids,
            )

            params = SaveScenarioSqlParams(
                profile_id=profile_id,
                input_scenario_id=scenario_id,
                name_id=name_id,
                description_id=description_id,
                problem_statement_id=problem_statement_id,
                flag_ids=flag_ids,
                department_ids=department_ids,
                persona_ids=persona_ids,
                document_ids=document_ids,
                parameter_ids=parameter_ids,
                parameter_field_ids=parameter_field_ids,
                image_ids=image_ids,
                objective_ids=objective_ids,
                video_ids=video_ids,
                question_ids=question_ids,
                option_ids=option_ids,
                scenarios_resource_id=scenarios_resource_id,
            )

            result = cast(
                SaveScenarioSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.scenario_id:
                return None

        await invalidate_tags(["scenarios"])
        return result.scenario_id

    except Exception as e:
        logger.exception(f"save_scenario_internal failed: {e}")
        return None


async def _resolve_scenario_values(
    conn: asyncpg.Connection,
    item: SaveScenarioItem,
) -> list[SaveScenarioFieldError]:
    """Resolve value fields to IDs on the item (mutates in place).

    For 'create' resources (name, description, problem_statement):
      Creates a new resource and sets the *_id field.

    Returns a list of errors (empty if all resolved successfully).
    """
    errors: list[SaveScenarioFieldError] = []

    # --- Create resources (always create new) ---

    if item.name is not None and item.name_id is None:
        item.name_id = await create_names_internal(conn, item.name)

    if item.description is not None and item.description_id is None:
        item.description_id = await create_descriptions_internal(conn, item.description)

    if item.problem_statement is not None and item.problem_statement_id is None:
        from app.api.v4.resources.problem_statements.create import (
            create_problem_statements_internal,
        )

        item.problem_statement_id = await create_problem_statements_internal(
            conn, item.problem_statement
        )

    # --- Validate required fields have IDs after resolution ---

    if item.name_id is None and item.input_scenario_id is None:
        errors.append(SaveScenarioFieldError(field="name", message="Name is required"))

    return errors


@router.post(
    "/save",
    response_model=SaveScenarioApiResponse,
    dependencies=[
        audit_activity(
            "scenario.saved",
            "{{ actor.name }} saved {{ count }} scenario(s)",
        )
    ],
)
async def save_scenario(
    request: SaveScenarioApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveScenarioApiResponse:
    """Bulk save scenarios — all-or-nothing single transaction.

    Each item can provide resource IDs directly or raw values that get
    resolved to IDs (create or match). If any item has resolution errors,
    the entire batch fails with per-item error details — no mutation occurs.
    """
    tags = ["scenarios"]

    sql_query = load_sql_query(SQL_PATH)

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch user context once for the whole batch
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
                user_department_ids = [
                    d.department_id for d in profile_ctx.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Phase 1: Per-item access + permission checks (outside transaction, fail fast)
        for idx, item in enumerate(request.scenarios):
            if not item.input_scenario_id:
                # Create mode
                request_department_ids = (
                    [str(d) for d in (item.department_ids or [])]
                    if item.department_ids
                    else []
                )
                can_save = compute_can_create(user_role, request_department_ids)
            else:
                # Update mode
                access_params = GetScenarioAccessSqlParams(
                    profile_id=profile_id,
                    scenario_id=item.input_scenario_id,
                    draft_id=None,
                )
                access_result = cast(
                    GetScenarioAccessSqlRow,
                    await execute_sql_typed(
                        conn, ACCESS_SQL_PATH, params=access_params
                    ),
                )

                if not access_result:
                    raise HTTPException(
                        status_code=401,
                        detail=f"Item {idx}: Unable to verify user permissions.",
                    )

                scenario_department_ids = (
                    getattr(access_result, "scenario_department_ids", None) or []
                )

                if access_result.scenario_exists is False:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Item {idx}: Scenario {item.input_scenario_id} not found",
                    )

                if not has_access(
                    user_role, user_department_ids, scenario_department_ids
                ):
                    raise HTTPException(
                        status_code=403,
                        detail=f"Item {idx}: You don't have access to this scenario.",
                    )

                can_save = compute_can_edit(
                    user_role=user_role,
                    scenario_department_ids=scenario_department_ids,
                    active_simulation_count=getattr(
                        access_result, "active_simulation_count", 0
                    ),
                    user_department_ids=user_department_ids,
                )

            if not can_save:
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to save this scenario.",
                )

        # Phase 2: Resolve value fields → IDs (outside transaction)
        has_errors = False
        error_results: list[SaveScenarioResult] = []

        for idx, item in enumerate(request.scenarios):
            item_errors = await _resolve_scenario_values(conn, item)
            if item_errors:
                has_errors = True
                error_results.append(
                    SaveScenarioResult(
                        success=False,
                        message=f"Item {idx}: Validation errors",
                        errors=item_errors,
                    )
                )
            else:
                error_results.append(
                    SaveScenarioResult(
                        success=True,
                        message="Validated",
                    )
                )

        if has_errors:
            return SaveScenarioApiResponse(results=error_results)

        # Phase 3: Single transaction — create resources + save junctions
        results: list[SaveScenarioResult] = []

        async with conn.transaction():
            for idx, item in enumerate(request.scenarios):
                # Create denormalized scenarios_resource
                scenarios_resource_id = await create_scenarios_internal(
                    conn,
                    name_id=item.name_id,
                    description_id=item.description_id,
                    department_ids=item.department_ids,
                    persona_ids=item.persona_ids,
                    parameter_ids=item.parameter_ids,
                    parameter_field_ids=item.parameter_field_ids,
                )

                params = SaveScenarioSqlParams.from_request(
                    item,
                    profile_id=profile_id,
                    scenarios_resource_id=scenarios_resource_id,
                )

                result = cast(
                    SaveScenarioSqlRow,
                    await execute_sql_typed(
                        conn,
                        SQL_PATH,
                        params=params,
                    ),
                )

                if not result or not result.scenario_id:
                    if item.input_scenario_id:
                        raise ValueError(
                            f"Item {idx}: Scenario not found: {item.input_scenario_id}"
                        )
                    else:
                        raise ValueError(f"Item {idx}: Failed to create scenario")

                is_update = item.input_scenario_id is not None
                results.append(
                    SaveScenarioResult(
                        success=True,
                        scenario_id=result.scenario_id,
                        message="Scenario updated successfully"
                        if is_update
                        else "Scenario created successfully",
                    )
                )

        # Audit context
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                count=len(results),
            )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return SaveScenarioApiResponse(results=results)
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
            sql_params=None,
            request=http_request,
        )
