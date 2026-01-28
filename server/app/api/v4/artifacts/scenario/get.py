"""Scenario get endpoint - v4 API following DHH principles.
Unified endpoint that handles both new (scenario_id = NULL) and detail (scenario_id provided).
Two-pass architecture with Python-computed permissions.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.api.v4.artifacts.scenario.types import (
    GetScenarioApiRequest,
    GetScenarioApiResponse,
    GetScenarioSqlParams,
    GetScenarioSqlRow,
)
from app.sql.types import load_sql_query
from app.sql.types import (
    GetScenarioAccessSqlParams,
    GetScenarioAccessSqlRow,
)
from app.api.v4.artifacts.scenario.permissions import (
    has_access,
    compute_can_edit,
    compute_disabled_reason,
    compute_show_name,
    compute_show_description,
    compute_show_flag,
    compute_show_departments,
    compute_show_personas,
    compute_show_documents,
    compute_show_parameters,
    compute_show_fields,
    compute_show_objectives,
    compute_show_images,
    compute_show_videos,
    compute_show_questions,
    compute_show_templates,
    compute_show_problem_statement,
    compute_name_required,
    compute_description_required,
    compute_flag_required,
    compute_departments_required,
    compute_personas_required,
    compute_documents_required,
    compute_parameters_required,
    compute_fields_required,
    compute_objectives_required,
    compute_images_required,
    compute_videos_required,
    compute_questions_required,
    compute_templates_required,
    compute_problem_statement_required,
)
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.problem_statements.get import get_problem_statement_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.personas.get import get_persona_internal
from app.api.v4.resources.documents.get import get_document_internal
from app.api.v4.resources.parameters.get import get_parameters_internal
from app.api.v4.resources.fields.get import get_fields_internal
from app.api.v4.resources.objectives.get import get_objective_internal
from app.api.v4.resources.images.get import get_image_internal
from app.api.v4.resources.videos.get import get_video_internal
from app.api.v4.resources.questions.get import get_question_internal
from app.api.v4.resources.templates.get import get_template_internal
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/scenarios/get_scenario_complete.sql"
ACCESS_SQL_PATH = "app/sql/v4/queries/scenarios/get_scenario_access_complete.sql"


router = APIRouter()


@router.post(
    "/get",
    response_model=GetScenarioApiResponse,
    dependencies=[
        audit_activity(
            "scenario.get",
            "{{ actor.name }} {% if scenario %}viewed{% else %}opened new{% endif %} scenario{% if scenario %} '{{ scenario.name }}'{% endif %}",
        )
    ],
)
async def get_scenario(
    request: GetScenarioApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetScenarioApiResponse:
    """Get scenario information - handles both new (scenario_id = NULL) and detail (scenario_id provided).
    
    Validation Logic:
    - New mode: Check for valid departments
    - Detail mode: Check scenario_exists and access
    """
    tags = ["scenarios"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    # Use mode='json' to serialize UUIDs to strings for JSON compatibility
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetScenarioApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Get mcp flag from header (set by router-level dependency)
        mcp = getattr(http_request.state, "mcp", False) or False

        scenario_id = request.scenario_id  # Used for audit/context decisions

        # === QUERY 1: Access Check ===
        access_params = GetScenarioAccessSqlParams(
            profile_id=profile_id,
            scenario_id=scenario_id,
            draft_id=request.draft_id,
        )
        access_result = cast(
            GetScenarioAccessSqlRow,
            await execute_sql_typed(
                conn,
                ACCESS_SQL_PATH,
                params=access_params,
            ),
        )

        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
        scenario_department_ids = access_result.scenario_department_ids or []

        # Convert API request to SQL params (double star pattern)
        # Add profile_id and mcp from header; SQL signature is the source of truth
        request_dict = request.model_dump()
        request_dict["profile_id"] = profile_id
        request_dict["mcp"] = mcp
        params = GetScenarioSqlParams(**request_dict)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            GetScenarioSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        scenario_name = (
            result.name_resource.name if result.name_resource else None
        )

        if result.actor_name:
            audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
            # Only add scenario to audit context if scenario_id was provided (detail mode)
            if scenario_id and scenario_name:
                audit_ctx["scenario"] = {
                    "name": scenario_name,
                    "id": str(scenario_id),
                }
            audit_set(http_request, **audit_ctx)

        # Conditional validation based on mode
        if scenario_id is None:
            # New mode: check for valid departments (derive from departments array)
            departments_list = result.departments or []
            valid_department_ids = [
                d.department_id for d in departments_list if d.department_id
            ]
            if user_role == "superadmin":
                valid_department_ids = valid_department_ids or user_department_ids
            if not valid_department_ids and user_department_ids:
                valid_department_ids = user_department_ids
            if not valid_department_ids:
                raise HTTPException(
                    status_code=400, detail="No accessible departments found for user"
                )
        else:
            # Detail mode: check if scenario exists and has access
            if access_result.scenario_exists is False:
                raise HTTPException(
                    status_code=404, detail=f"Scenario {scenario_id} not found"
                )

            if not has_access(user_role, user_department_ids, scenario_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this scenario. It may be restricted to other departments.",
                )

        # === PYTHON PERMISSIONS & UI FLAGS ===
        usage_count = getattr(result, "active_usage_count", 0) or 0
        can_edit = compute_can_edit(user_role, scenario_department_ids, usage_count)
        disabled_reason = compute_disabled_reason(
            user_role, scenario_department_ids, usage_count
        )

        # Counts for show flags
        departments_count = len(result.departments or [])
        personas_count = len(result.personas or [])
        documents_count = len(result.documents or [])
        parameters_count = len(result.parameters or [])
        persona_fields_count = len(result.persona_fields or [])
        document_fields_count = len(result.document_fields or [])
        parameter_fields_count = len(result.parameter_fields or [])
        objectives_count = len(result.objectives or [])
        images_count = len(result.images or [])
        videos_count = len(result.videos or [])
        questions_count = len(result.questions or [])
        templates_count = len(result.templates or [])

        show_name = compute_show_name()
        show_description = compute_show_description()
        show_flag = compute_show_flag()
        show_departments = compute_show_departments(departments_count)
        show_personas = compute_show_personas(personas_count)
        show_documents = compute_show_documents(documents_count)
        show_parameters = compute_show_parameters(parameters_count)
        show_persona_fields = compute_show_fields(persona_fields_count)
        show_document_fields = compute_show_fields(document_fields_count)
        show_parameter_fields = compute_show_fields(parameter_fields_count)
        show_objectives = compute_show_objectives(objectives_count)
        show_images = compute_show_images(images_count)
        show_videos = compute_show_videos(videos_count)
        show_questions = compute_show_questions(questions_count)
        show_templates = compute_show_templates(templates_count)
        show_problem_statement = compute_show_problem_statement()

        # Required flags
        name_required = compute_name_required()
        description_required = compute_description_required()
        flag_required = compute_flag_required()
        departments_required = compute_departments_required()
        personas_required = compute_personas_required()
        documents_required = compute_documents_required()
        parameters_required = compute_parameters_required()
        fields_required = compute_fields_required()
        objectives_required = compute_objectives_required()
        images_required = compute_images_required()
        videos_required = compute_videos_required()
        questions_required = compute_questions_required()
        templates_required = compute_templates_required()
        problem_statement_required = compute_problem_statement_required()

        # === RESOURCE FETCHING (by IDs for cache reuse) ===
        pool = await get_pool()

        def _ids_from_resource_list(items: list[Any] | None, id_attr: str) -> list[UUID]:
            if not items:
                return []
            return [getattr(item, id_attr) for item in items if getattr(item, id_attr, None)]

        def _order_by_ids(items: list[Any], id_attr: str, ordered_ids: list[UUID]) -> list[Any]:
            by_id = {getattr(item, id_attr): item for item in items if getattr(item, id_attr, None)}
            return [by_id[i] for i in ordered_ids if i in by_id]

        async def _run_with_pool(fn, *args):
            async with pool.acquire() as pooled_conn:
                return await fn(pooled_conn, *args, bypass_cache=bypass_cache)

        async def _gather_single(fn, ids: list[UUID], id_attr: str) -> list[Any]:
            if not ids:
                return []
            items = await asyncio.gather(*[_run_with_pool(fn, _id) for _id in ids])
            return [item for item in items if item is not None]

        # Selected resource IDs
        name_ids = [result.name_id] if result.name_id else []
        description_ids = [result.description_id] if result.description_id else []
        problem_statement_ids = [result.problem_statement_id] if result.problem_statement_id else []
        flag_ids = [result.active_flag_id] if result.active_flag_id else []
        objectives_enabled_flag_ids = [result.objectives_enabled_flag_id] if result.objectives_enabled_flag_id else []
        images_enabled_flag_ids = [result.images_enabled_flag_id] if result.images_enabled_flag_id else []
        video_enabled_flag_ids = [result.video_enabled_flag_id] if result.video_enabled_flag_id else []
        questions_enabled_flag_ids = [result.questions_enabled_flag_id] if result.questions_enabled_flag_id else []
        problem_statement_enabled_flag_ids = [result.problem_statement_enabled_flag_id] if result.problem_statement_enabled_flag_id else []
        use_templates_flag_ids = [result.use_templates_flag_id] if result.use_templates_flag_id else []
        department_ids = result.department_ids or []
        if scenario_id is None and not department_ids and user_department_ids:
            department_ids = user_department_ids
        persona_field_ids = result.persona_field_ids or []
        document_field_ids = result.document_field_ids or []
        parameter_field_ids = result.parameter_field_ids or []
        objective_ids = result.objective_ids or []
        image_ids = result.image_ids or []
        video_ids = result.video_ids or []
        question_ids = result.question_ids or []
        template_ids = result.template_ids or []
        persona_ids = result.persona_ids or []
        document_ids = result.document_ids or []
        parameter_ids = result.parameter_ids or []
        # Search result IDs from SQL (for options lists)
        name_option_ids = _ids_from_resource_list(result.names, "id")
        description_option_ids = _ids_from_resource_list(result.descriptions, "id")
        problem_statement_option_ids = _ids_from_resource_list(result.problem_statements, "id")
        department_option_ids = _ids_from_resource_list(result.departments, "department_id")
        if scenario_id is None and not department_option_ids and user_department_ids:
            department_option_ids = user_department_ids
        persona_option_ids = _ids_from_resource_list(result.personas, "persona_id")
        document_option_ids = _ids_from_resource_list(result.documents, "document_id")
        parameter_option_ids = _ids_from_resource_list(result.parameters, "parameter_id")
        objective_option_ids = _ids_from_resource_list(result.objectives, "id")
        image_option_ids = _ids_from_resource_list(result.images, "id")
        video_option_ids = _ids_from_resource_list(result.videos, "id")
        question_option_ids = _ids_from_resource_list(result.questions, "id")
        template_option_ids = _ids_from_resource_list(result.templates, "id")

        (
            name_items,
            description_items,
            problem_statement_items,
            flag_items,
            objectives_enabled_flag_items,
            images_enabled_flag_items,
            video_enabled_flag_items,
            questions_enabled_flag_items,
            problem_statement_enabled_flag_items,
            use_templates_flag_items,
            department_items,
            persona_field_items,
            document_field_items,
            parameter_field_items,
            objective_items,
            image_items,
            video_items,
            question_items,
            template_items,
            persona_items,
            document_items,
            parameter_items,
            name_options,
            description_options,
            problem_statement_options,
            department_options,
            persona_options,
            document_options,
            parameter_options,
            objective_options,
            image_options,
            video_options,
            question_options,
            template_options,
        ) = await asyncio.gather(
            _run_with_pool(get_names_internal, name_ids),
            _run_with_pool(get_descriptions_internal, description_ids),
            _gather_single(get_problem_statement_internal, problem_statement_ids, "id"),
            _run_with_pool(get_flags_internal, flag_ids),
            _run_with_pool(get_flags_internal, objectives_enabled_flag_ids),
            _run_with_pool(get_flags_internal, images_enabled_flag_ids),
            _run_with_pool(get_flags_internal, video_enabled_flag_ids),
            _run_with_pool(get_flags_internal, questions_enabled_flag_ids),
            _run_with_pool(get_flags_internal, problem_statement_enabled_flag_ids),
            _run_with_pool(get_flags_internal, use_templates_flag_ids),
            _run_with_pool(get_departments_internal, department_ids),
            _run_with_pool(get_fields_internal, persona_field_ids),
            _run_with_pool(get_fields_internal, document_field_ids),
            _run_with_pool(get_fields_internal, parameter_field_ids),
            _gather_single(get_objective_internal, objective_ids, "id"),
            _gather_single(get_image_internal, image_ids, "id"),
            _gather_single(get_video_internal, video_ids, "id"),
            _gather_single(get_question_internal, question_ids, "id"),
            _gather_single(get_template_internal, template_ids, "id"),
            _gather_single(get_persona_internal, persona_ids, "persona_id"),
            _gather_single(get_document_internal, document_ids, "document_id"),
            _run_with_pool(get_parameters_internal, parameter_ids),
            _run_with_pool(get_names_internal, name_option_ids),
            _run_with_pool(get_descriptions_internal, description_option_ids),
            _gather_single(get_problem_statement_internal, problem_statement_option_ids, "id"),
            _run_with_pool(get_departments_internal, department_option_ids),
            _gather_single(get_persona_internal, persona_option_ids, "persona_id"),
            _gather_single(get_document_internal, document_option_ids, "document_id"),
            _run_with_pool(get_parameters_internal, parameter_option_ids),
            _gather_single(get_objective_internal, objective_option_ids, "id"),
            _gather_single(get_image_internal, image_option_ids, "id"),
            _gather_single(get_video_internal, video_option_ids, "id"),
            _gather_single(get_question_internal, question_option_ids, "id"),
            _gather_single(get_template_internal, template_option_ids, "id"),
        )

        def _to_dict(item: Any) -> dict[str, Any]:
            if hasattr(item, "model_dump"):
                return item.model_dump()
            return dict(item)

        # Normalize single-resource selections
        name_resource = _to_dict(name_items[0]) if name_items else None
        description_resource = _to_dict(description_items[0]) if description_items else None
        problem_statement_resource = (
            _to_dict(problem_statement_items[0]) if problem_statement_items else None
        )
        active_flag_resource = _to_dict(flag_items[0]) if flag_items else None
        objectives_enabled_flag_resource = (
            _to_dict(objectives_enabled_flag_items[0])
            if objectives_enabled_flag_items
            else None
        )
        images_enabled_flag_resource = (
            _to_dict(images_enabled_flag_items[0]) if images_enabled_flag_items else None
        )
        video_enabled_flag_resource = (
            _to_dict(video_enabled_flag_items[0]) if video_enabled_flag_items else None
        )
        questions_enabled_flag_resource = (
            _to_dict(questions_enabled_flag_items[0])
            if questions_enabled_flag_items
            else None
        )
        problem_statement_enabled_flag_resource = (
            _to_dict(problem_statement_enabled_flag_items[0])
            if problem_statement_enabled_flag_items
            else None
        )
        use_templates_flag_resource = (
            _to_dict(use_templates_flag_items[0]) if use_templates_flag_items else None
        )

        # Ordered option lists
        names = [_to_dict(item) for item in _order_by_ids(name_options, "id", name_option_ids)]
        descriptions = [
            _to_dict(item)
            for item in _order_by_ids(description_options, "id", description_option_ids)
        ]
        problem_statements = [
            _to_dict(item)
            for item in _order_by_ids(
                problem_statement_options, "id", problem_statement_option_ids
            )
        ]
        departments = [
            _to_dict(item)
            for item in _order_by_ids(
                department_options, "department_id", department_option_ids
            )
        ]
        personas = [
            _to_dict(item)
            for item in _order_by_ids(persona_options, "persona_id", persona_option_ids)
        ]
        documents = [
            _to_dict(item)
            for item in _order_by_ids(
                document_options, "document_id", document_option_ids
            )
        ]
        parameters = [
            _to_dict(item)
            for item in _order_by_ids(
                parameter_options, "parameter_id", parameter_option_ids
            )
        ]
        objectives = [
            _to_dict(item)
            for item in _order_by_ids(objective_options, "id", objective_option_ids)
        ]
        images = [_to_dict(item) for item in _order_by_ids(image_options, "id", image_option_ids)]
        videos = [_to_dict(item) for item in _order_by_ids(video_options, "id", video_option_ids)]
        questions = [
            _to_dict(item)
            for item in _order_by_ids(question_options, "id", question_option_ids)
        ]
        templates = [
            _to_dict(item)
            for item in _order_by_ids(template_options, "id", template_option_ids)
        ]

        # Build response with Python-computed permissions and fetched resources
        result_dict = result.model_dump(mode="json")
        result_dict.update(
            {
                "can_edit": can_edit,
                "disabled_reason": disabled_reason,
                "show_name": show_name,
                "show_description": show_description,
                "show_active_flag": show_flag,
                "show_objectives_enabled_flag": show_flag,
                "show_images_enabled_flag": show_flag,
                "show_video_enabled_flag": show_flag,
                "show_questions_enabled_flag": show_flag,
                "show_problem_statement_enabled_flag": show_flag,
                "show_use_templates_flag": show_flag,
                "show_departments": show_departments,
                "show_personas": show_personas,
                "show_documents": show_documents,
                "show_parameters": show_parameters,
                "show_persona_fields": show_persona_fields,
                "show_document_fields": show_document_fields,
                "show_parameter_fields": show_parameter_fields,
                "show_objectives": show_objectives,
                "show_images": show_images,
                "show_videos": show_videos,
                "show_questions": show_questions,
                "show_templates": show_templates,
                "show_problem_statement": show_problem_statement,
                "name_required": name_required,
                "description_required": description_required,
                "active_flag_required": flag_required,
                "objectives_enabled_flag_required": flag_required,
                "images_enabled_flag_required": flag_required,
                "video_enabled_flag_required": flag_required,
                "questions_enabled_flag_required": flag_required,
                "problem_statement_enabled_flag_required": flag_required,
                "use_templates_flag_required": flag_required,
                "departments_required": departments_required,
                "personas_required": personas_required,
                "documents_required": documents_required,
                "parameters_required": parameters_required,
                "persona_fields_required": fields_required,
                "document_fields_required": fields_required,
                "parameter_fields_required": fields_required,
                "objectives_required": objectives_required,
                "images_required": images_required,
                "videos_required": videos_required,
                "questions_required": questions_required,
                "templates_required": templates_required,
                "problem_statement_required": problem_statement_required,
                "name_resource": name_resource,
                "description_resource": description_resource,
                "problem_statement_resource": problem_statement_resource,
                "active_flag_resource": active_flag_resource,
                "objectives_enabled_flag_resource": objectives_enabled_flag_resource,
                "images_enabled_flag_resource": images_enabled_flag_resource,
                "video_enabled_flag_resource": video_enabled_flag_resource,
                "questions_enabled_flag_resource": questions_enabled_flag_resource,
                "problem_statement_enabled_flag_resource": problem_statement_enabled_flag_resource,
                "use_templates_flag_resource": use_templates_flag_resource,
                "department_resources": [
                    _to_dict(item)
                    for item in _order_by_ids(
                        department_items, "department_id", department_ids
                    )
                ],
                "persona_field_resources": [
                    _to_dict(item)
                    for item in _order_by_ids(
                        persona_field_items, "field_id", persona_field_ids
                    )
                ],
                "document_field_resources": [
                    _to_dict(item)
                    for item in _order_by_ids(
                        document_field_items, "field_id", document_field_ids
                    )
                ],
                "parameter_field_resources": [
                    _to_dict(item)
                    for item in _order_by_ids(
                        parameter_field_items, "field_id", parameter_field_ids
                    )
                ],
                "objective_resources": [
                    _to_dict(item)
                    for item in _order_by_ids(objective_items, "id", objective_ids)
                ],
                "image_resources": [
                    _to_dict(item) for item in _order_by_ids(image_items, "id", image_ids)
                ],
                "video_resources": [
                    _to_dict(item) for item in _order_by_ids(video_items, "id", video_ids)
                ],
                "question_resources": [
                    _to_dict(item)
                    for item in _order_by_ids(question_items, "id", question_ids)
                ],
                "template_resources": [
                    _to_dict(item)
                    for item in _order_by_ids(template_items, "id", template_ids)
                ],
                "persona_resources": [
                    _to_dict(item)
                    for item in _order_by_ids(persona_items, "persona_id", persona_ids)
                ],
                "document_resources": [
                    _to_dict(item)
                    for item in _order_by_ids(document_items, "document_id", document_ids)
                ],
                "parameter_resources": [
                    _to_dict(item)
                    for item in _order_by_ids(
                        parameter_items, "parameter_id", parameter_ids
                    )
                ],
                "names": names,
                "descriptions": descriptions,
                "problem_statements": problem_statements,
                "departments": departments,
                "personas": personas,
                "documents": documents,
                "parameters": parameters,
                "objectives": objectives,
                "images": images,
                "videos": videos,
                "questions": questions,
                "templates": templates,
            }
        )

        response_data = GetScenarioApiResponse.model_validate(result_dict)

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_scenario",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
