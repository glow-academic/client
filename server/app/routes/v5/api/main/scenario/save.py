"""Scenario save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (input_scenario_id = NULL) and update (input_scenario_id provided).
Supports bulk operations and dual-mode fields (ID or value).
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_pool, get_redis_client
from app.routes.auth.profile import get_auth_profile_internal
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.main.scenario.permissions import (
    SCENARIO_RESOURCES,
    compute_can_create,
    compute_can_edit,
    has_access,
)
from app.routes.v5.api.main.scenario.types import (
    SaveScenarioApiRequest,
    SaveScenarioApiResponse,
    SaveScenarioFieldError,
    SaveScenarioItem,
    SaveScenarioResult,
    SaveScenarioSqlParams,
    SaveScenarioSqlRow,
)
from app.routes.v5.api.permissions import resolve_agents_for_artifact
from app.routes.v5.tools.resources.descriptions.create import (
    create_descriptions_internal,
)
from app.routes.v5.tools.resources.names.create import create_name
from app.routes.v5.tools.resources.scenarios.create import create_scenarios_internal
from app.sql.types import (
    GetScenarioAccessSqlParams,
    GetScenarioAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
SQL_PATH = "app/sql/queries/scenarios/save_scenario_complete.sql"
ACCESS_SQL_PATH = "app/sql/queries/scenarios/get_scenario_access_complete.sql"

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

        await invalidate_tags(["scenarios"], redis=get_redis_client())
        return result.scenario_id

    except Exception as e:
        logger.exception(f"save_scenario_internal failed: {e}")
        return None


async def _resolve_scenario_values(
    conn: asyncpg.Connection,
    item: SaveScenarioItem,
    group_id: uuid.UUID | None = None,
    create_tool_ids: dict[str, uuid.UUID | None] | None = None,
) -> list[SaveScenarioFieldError]:
    """Resolve value fields to IDs on the item (mutates in place).

    For 'create' resources (name, description, problem_statement):
      Creates a new resource and sets the *_id field.
      When group_id and create_tool_ids are provided, tool tracking is recorded.

    Returns a list of errors (empty if all resolved successfully).
    """
    errors: list[SaveScenarioFieldError] = []

    # Tool tracking args (only active when both group_id and tool_id are present)
    def _tool_args(resource_key: str) -> dict:
        if group_id and create_tool_ids:
            tool_id = create_tool_ids.get(resource_key)
            if tool_id:
                return {"group_id": group_id, "tool_id": tool_id}
        return {}

    # --- Create resources (always create new) ---

    if item.name is not None and item.name_id is None:
        item.name_id = (
            await create_name(conn, item.name, **_tool_args("names"))
        ).name_id

    if item.description is not None and item.description_id is None:
        item.description_id = await create_descriptions_internal(
            conn, item.description, **_tool_args("descriptions")
        )

    if item.problem_statement is not None and item.problem_statement_id is None:
        from app.routes.v5.tools.resources.problem_statements.create import (
            create_problem_statements_internal,
        )

        item.problem_statement_id = await create_problem_statements_internal(
            conn, item.problem_statement, **_tool_args("problem_statements")
        )

    # --- Match-by-name resolution for multi-select fields (CSV import) ---

    if item.active_flag is not None and item.active_flag_id is None:
        from app.routes.v5.tools.resources.flags.search import search_flags

        all_flags = await search_flags(
            conn, get_redis_client(), search=None, limit_count=1000,
            flag_type="scenario_active", scenario=True,
        )
        match = next((f for f in all_flags if f.type == "scenario_active"), None)
        if match and match.id:
            if item.active_flag:
                item.active_flag_id = match.id
        elif item.active_flag:
            errors.append(
                SaveScenarioFieldError(
                    field="active_flag", message="Active flag resource not found"
                )
            )

    if item.departments is not None and item.department_ids is None:
        from app.infra.globals import get_redis_client
        from app.routes.v5.tools.resources.departments.search import (
            search_departments,
        )

        all_depts = await search_departments(
            conn, get_redis_client(), search=None, limit_count=1000, scenario=True
        )
        dept_name_map = {
            d.name.lower(): d.id
            for d in all_depts
            if d.name and d.id
        }
        resolved_ids = []
        for dept_name in item.departments:
            dept_id = dept_name_map.get(dept_name.lower())
            if dept_id:
                resolved_ids.append(dept_id)
            else:
                errors.append(
                    SaveScenarioFieldError(
                        field="departments",
                        message=f'Department "{dept_name}" not found',
                    )
                )
        if not any(e.field == "departments" for e in errors):
            item.department_ids = resolved_ids

    if item.personas is not None and item.persona_ids is None:
        from app.routes.v5.tools.resources.personas.search import (
            search_personas_internal,
        )

        all_personas = await search_personas_internal(
            conn, search=None, limit_count=1000, scenario=True
        )
        persona_name_map = {
            p.name.lower(): p.persona_id
            for p in all_personas
            if p.name and p.persona_id
        }
        resolved_ids = []
        for persona_name in item.personas:
            pid = persona_name_map.get(persona_name.lower())
            if pid:
                resolved_ids.append(pid)
            else:
                errors.append(
                    SaveScenarioFieldError(
                        field="personas",
                        message=f'Persona "{persona_name}" not found',
                    )
                )
        if not any(e.field == "personas" for e in errors):
            item.persona_ids = resolved_ids

    if item.documents is not None and item.document_ids is None:
        from app.routes.v5.tools.resources.documents.search import (
            search_documents_internal,
        )

        all_docs = await search_documents_internal(
            conn, search=None, limit_count=1000, scenario=True
        )
        doc_name_map = {
            d.name.lower(): d.document_id for d in all_docs if d.name and d.document_id
        }
        resolved_ids = []
        for doc_name in item.documents:
            did = doc_name_map.get(doc_name.lower())
            if did:
                resolved_ids.append(did)
            else:
                errors.append(
                    SaveScenarioFieldError(
                        field="documents",
                        message=f'Document "{doc_name}" not found',
                    )
                )
        if not any(e.field == "documents" for e in errors):
            item.document_ids = resolved_ids

    if item.parameter_fields is not None and item.parameter_field_ids is None:
        from app.routes.v5.tools.resources.parameter_fields.search import (
            search_parameter_fields_internal,
        )

        all_pf = await search_parameter_fields_internal(
            conn, parameter_ids=[], scenario=True
        )
        pf_name_map = {pf.name.lower(): pf.id for pf in all_pf if pf.name and pf.id}
        resolved_ids = []
        for pf_name in item.parameter_fields:
            pf_id = pf_name_map.get(pf_name.lower())
            if pf_id:
                resolved_ids.append(pf_id)
            else:
                errors.append(
                    SaveScenarioFieldError(
                        field="parameter_fields",
                        message=f'Parameter field "{pf_name}" not found',
                    )
                )
        if not any(e.field == "parameter_fields" for e in errors):
            item.parameter_field_ids = resolved_ids

    if item.objectives is not None and item.objective_ids is None:
        from app.routes.v5.tools.resources.objectives.search import (
            search_objectives_internal,
        )

        all_objectives = await search_objectives_internal(
            conn, search=None, limit_count=1000, scenario=True
        )
        obj_name_map = {
            o.objective.lower(): o.objective_id
            for o in all_objectives
            if o.objective and o.objective_id
        }
        resolved_ids = []
        for obj_name in item.objectives:
            oid = obj_name_map.get(obj_name.lower())
            if oid:
                resolved_ids.append(oid)
            else:
                errors.append(
                    SaveScenarioFieldError(
                        field="objectives",
                        message=f'Objective "{obj_name}" not found',
                    )
                )
        if not any(e.field == "objectives" for e in errors):
            item.objective_ids = resolved_ids

    if item.images is not None and item.image_ids is None:
        from app.routes.v5.tools.resources.images.search import search_images_internal

        all_images = await search_images_internal(
            conn, search=None, limit_count=1000, scenario=True
        )
        img_name_map = {
            i.name.lower(): i.image_id for i in all_images if i.name and i.image_id
        }
        resolved_ids = []
        for img_name in item.images:
            iid = img_name_map.get(img_name.lower())
            if iid:
                resolved_ids.append(iid)
            else:
                errors.append(
                    SaveScenarioFieldError(
                        field="images",
                        message=f'Image "{img_name}" not found',
                    )
                )
        if not any(e.field == "images" for e in errors):
            item.image_ids = resolved_ids

    if item.videos is not None and item.video_ids is None:
        from app.routes.v5.tools.resources.videos.search import search_videos_internal

        all_videos = await search_videos_internal(
            conn, search=None, limit_count=1000, scenario=True
        )
        vid_name_map = {
            v.name.lower(): v.video_id for v in all_videos if v.name and v.video_id
        }
        resolved_ids = []
        for vid_name in item.videos:
            vid = vid_name_map.get(vid_name.lower())
            if vid:
                resolved_ids.append(vid)
            else:
                errors.append(
                    SaveScenarioFieldError(
                        field="videos",
                        message=f'Video "{vid_name}" not found',
                    )
                )
        if not any(e.field == "videos" for e in errors):
            item.video_ids = resolved_ids

    if item.questions is not None and item.question_ids is None:
        from app.routes.v5.tools.resources.questions.search import (
            search_questions_internal,
        )

        all_questions = await search_questions_internal(
            conn, search=None, limit_count=1000, scenario=True
        )
        q_name_map = {
            q.question_text.lower(): q.question_id
            for q in all_questions
            if q.question_text and q.question_id
        }
        resolved_ids = []
        for q_name in item.questions:
            qid = q_name_map.get(q_name.lower())
            if qid:
                resolved_ids.append(qid)
            else:
                errors.append(
                    SaveScenarioFieldError(
                        field="questions",
                        message=f'Question "{q_name}" not found',
                    )
                )
        if not any(e.field == "questions" for e in errors):
            item.question_ids = resolved_ids

    if item.options is not None and item.option_ids is None:
        from app.routes.v5.tools.resources.options.search import search_options_internal

        all_options = await search_options_internal(
            conn, search=None, limit_count=1000, scenario=True
        )
        opt_name_map = {
            o.option_text.lower(): o.option_id
            for o in all_options
            if o.option_text and o.option_id
        }
        resolved_ids = []
        for opt_name in item.options:
            oid = opt_name_map.get(opt_name.lower())
            if oid:
                resolved_ids.append(oid)
            else:
                errors.append(
                    SaveScenarioFieldError(
                        field="options",
                        message=f'Option "{opt_name}" not found',
                    )
                )
        if not any(e.field == "options" for e in errors):
            item.option_ids = resolved_ids

    # --- Validate required fields have IDs after resolution ---

    if item.name_id is None and item.input_scenario_id is None:
        errors.append(SaveScenarioFieldError(field="name", message="Name is required"))

    return errors


@router.post("/save", response_model=SaveScenarioApiResponse)
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

        # Resolve create tool IDs from settings (for tool tracking on freeform creates)
        create_tool_ids: dict[str, uuid.UUID | None] | None = None
        if request.group_id and pool:
            async with pool.acquire() as settings_conn:
                settings_data = await get_auth_settings_internal(
                    settings_conn, profile_id, bypass_cache=False
                )
            _, create_tool_ids, _ = resolve_agents_for_artifact(
                settings_data.agent_tool_entries, SCENARIO_RESOURCES
            )

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
            item_errors = await _resolve_scenario_values(
                conn,
                item,
                group_id=request.group_id,
                create_tool_ids=create_tool_ids,
            )
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
        # Invalidate cache after mutation
        await invalidate_tags(tags, redis=get_redis_client())
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
