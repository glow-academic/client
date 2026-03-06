"""Scenario GET endpoint — composable infra architecture.

Uses composable infra layers:
  1. resolve_common_context — profile + tool graph + runs
  2. resolve_scenario_permissions_context — access check (404, 403, fail fast)
  3. resolve_scenario_context — artifact + draft → merged + hydrated resources
  4. score_tools — tool graph + artifact resources → per-resource tool picks
  5. Pure Python — permissions, show/required flags, response assembly
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from redis.asyncio import Redis

from app.infra.common_context import resolve_common_context
from app.infra.globals import get_db, get_redis_client
from app.infra.helpers import dedupe_by_id
from app.infra.scenario_context import SCENARIO_FLAG_TYPES, resolve_scenario_context
from app.infra.scenario_permissions_context import resolve_scenario_permissions_context
from app.infra.tool_graph import score_tools
from app.routes.v5.api.main.scenario.permissions import (
    SCENARIO_BASIC_RESOURCES,
    SCENARIO_CONTENT_RESOURCES,
    SCENARIO_RESOURCES,
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_documents_required,
    compute_fields_required,
    compute_flag_required,
    compute_images_required,
    compute_name_required,
    compute_objectives_required,
    compute_parameters_required,
    compute_personas_required,
    compute_problem_statement_required,
    compute_questions_required,
    compute_show_departments,
    compute_show_description,
    compute_show_documents,
    compute_show_fields,
    compute_show_flag,
    compute_show_images,
    compute_show_name,
    compute_show_objectives,
    compute_show_parameters,
    compute_show_personas,
    compute_show_problem_statement,
    compute_show_questions,
    compute_show_videos,
    compute_videos_required,
    has_access,
)
from app.routes.v5.api.main.scenario.types import (
    GetScenarioApiRequest,
    GetScenarioApiResponse,
    ScenarioDepartment,
    ScenarioDepartmentSection,
    ScenarioDescriptionResource,
    ScenarioDescriptionSection,
    ScenarioDocument,
    ScenarioDocumentSection,
    ScenarioField,
    ScenarioFlagConfig,
    ScenarioFlagSection,
    ScenarioImage,
    ScenarioImageSection,
    ScenarioNameResource,
    ScenarioNameSection,
    ScenarioObjective,
    ScenarioObjectiveSection,
    ScenarioOption,
    ScenarioOptionSection,
    ScenarioParameter,
    ScenarioParameterFieldSection,
    ScenarioParameterSection,
    ScenarioPersona,
    ScenarioPersonaSection,
    ScenarioProblemStatement,
    ScenarioProblemStatementSection,
    ScenarioQuestion,
    ScenarioQuestionSection,
    ScenarioVideo,
    ScenarioVideoSection,
)
from app.routes.v5.tools.entries.scenario_drafts.get import get_scenario_drafts
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


# ---------------------------------------------------------------------------
# get_scenario_client — composable infra architecture
# ---------------------------------------------------------------------------


async def get_scenario_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    scenario_id: UUID | None,
    draft_id: UUID | None = None,
    group_id: UUID,
    parameter_ids: list[UUID] | None = None,
    # Search filters (threaded from client)
    description_search: str | None = None,
    persona_search: str | None = None,
    document_search: str | None = None,
    parameter_search: str | None = None,
    problem_statement_search: str | None = None,
    image_search: str | None = None,
    video_search: str | None = None,
    question_search: str | None = None,
    option_search: str | None = None,
    persona_show_selected: bool | None = None,
    document_show_selected: bool | None = None,
    parameter_show_selected: bool | None = None,
    bypass_cache: bool = False,
) -> GetScenarioApiResponse:
    """Scenario GET using composable infra functions.

    Flow:
      1. resolve_common_context(profile_id) → profile, tool_graph, runs
      2. resolve_scenario_permissions_context → access check (404, 403, fail fast)
      3. resolve_scenario_context(scenario_id, draft_id, ...) → hydrated resources
      4. score_tools(tool_graph, SCENARIO_RESOURCES) → per-resource tool picks
      5. Pure Python: permissions, show/required/AI flags, response assembly
    """

    # ── Step 1: Common context (profile → tool_graph + runs) ──────────────

    common = await resolve_common_context(
        conn,
        redis,
        profile_id=profile_id,
        group_id=group_id,
        bypass_cache=bypass_cache,
    )

    if common is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    profile = common.profile

    # ── Step 2: Permissions check (fail fast before full hydration) ────────

    perms = None
    if scenario_id is not None:
        perms = await resolve_scenario_permissions_context(conn, scenario_id)

        if not perms.exists:
            raise HTTPException(
                status_code=404,
                detail=f"Scenario {scenario_id} not found",
            )

        if not has_access(profile.role, profile.department_ids, perms.department_ids):
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this scenario. "
                "It may be restricted to other departments.",
            )

    # ── Step 3: Scenario artifact context ─────────────────────────────────

    scenario = await resolve_scenario_context(
        conn,
        redis,
        scenario_id=scenario_id,
        group_id=group_id,
        draft_id=draft_id,
        user_department_ids=profile.department_ids,
        parameter_ids=parameter_ids,
        description_search=description_search,
        persona_search=persona_search,
        document_search=document_search,
        parameter_search=parameter_search,
        problem_statement_search=problem_statement_search,
        image_search=image_search,
        video_search=video_search,
        question_search=question_search,
        option_search=option_search,
        persona_show_selected=persona_show_selected,
        document_show_selected=document_show_selected,
        parameter_show_selected=parameter_show_selected,
        bypass_cache=bypass_cache,
    )

    # ── Step 4: Tool scoring ──────────────────────────────────────────────

    scores = score_tools(common.tool_graph, SCENARIO_RESOURCES)

    agent_ids: dict[str, UUID | None] = {
        r: (scores.best[r].agent_id if scores.best.get(r) else None)
        for r in SCENARIO_RESOURCES
    }

    tool_ids_map: dict[str, UUID | None] = {
        r: (scores.best[r].tool_id if scores.best.get(r) else None)
        for r in SCENARIO_RESOURCES
    }

    # ── Step 5: Permissions ───────────────────────────────────────────────

    scenario_department_ids = [
        d.id for d in scenario.resources["departments"].selected
    ]
    active_simulation_count = perms.active_simulation_count if perms else 0

    can_edit = compute_can_edit(
        user_role=profile.role,
        scenario_department_ids=scenario_department_ids,
        active_simulation_count=active_simulation_count,
        user_department_ids=profile.department_ids,
    )

    disabled_reason = compute_disabled_reason(
        user_role=profile.role,
        scenario_department_ids=scenario_department_ids,
        active_simulation_count=active_simulation_count,
        user_department_ids=profile.department_ids,
    )

    # ── Step 6: Show / Required / AI flags ────────────────────────────────

    all_departments = dedupe_by_id(
        scenario.resources["departments"].selected
        + scenario.resources["departments"].suggestions
    )
    all_personas = dedupe_by_id(
        scenario.resources["personas"].selected
        + scenario.resources["personas"].suggestions
    )
    all_documents = dedupe_by_id(
        scenario.resources["documents"].selected
        + scenario.resources["documents"].suggestions
    )
    all_parameters = dedupe_by_id(
        scenario.resources["parameters"].selected
        + scenario.resources["parameters"].suggestions
    )
    all_parameter_fields = dedupe_by_id(
        scenario.resources["parameter_fields"].selected
        + scenario.resources["parameter_fields"].suggestions
    )
    all_objectives = scenario.resources["objectives"].selected
    all_images = dedupe_by_id(
        scenario.resources["images"].selected
        + scenario.resources["images"].suggestions
    )
    all_videos = dedupe_by_id(
        scenario.resources["videos"].selected
        + scenario.resources["videos"].suggestions
    )
    all_questions = dedupe_by_id(
        scenario.resources["questions"].selected
        + scenario.resources["questions"].suggestions
    )
    all_options = dedupe_by_id(
        scenario.resources["options"].selected
        + scenario.resources["options"].suggestions
    )

    show_flags_map = {
        "names": compute_show_name(),
        "descriptions": compute_show_description(),
        "problem_statements": compute_show_problem_statement(),
        "flags": compute_show_flag(),
        "departments": compute_show_departments(len(all_departments)),
        "personas": compute_show_personas(len(all_personas)),
        "documents": compute_show_documents(len(all_documents)),
        "parameters": compute_show_parameters(len(all_parameters)),
        "fields": compute_show_fields(len(all_parameter_fields)),
        "objectives": compute_show_objectives(len(all_objectives)),
        "images": compute_show_images(len(all_images)),
        "videos": compute_show_videos(len(all_videos)),
        "questions": compute_show_questions(len(all_questions)),
        "options": len(all_options) > 0,
    }

    required_flags_map = {
        "names": compute_name_required(),
        "descriptions": compute_description_required(),
        "problem_statements": compute_problem_statement_required(),
        "flags": compute_flag_required(),
        "departments": compute_departments_required(),
        "personas": compute_personas_required(),
        "documents": compute_documents_required(),
        "parameters": compute_parameters_required(),
        "fields": compute_fields_required(),
        "objectives": compute_objectives_required(),
        "images": compute_images_required(),
        "videos": compute_videos_required(),
        "questions": compute_questions_required(),
        "options": False,
    }

    show_ai_generate_map = {
        r: agent_ids.get(r) is not None for r in SCENARIO_RESOURCES
    }

    basic_show_ai_generate = any(
        show_ai_generate_map.get(r, False) for r in SCENARIO_BASIC_RESOURCES
    )
    content_show_ai_generate = any(
        show_ai_generate_map.get(r, False) for r in SCENARIO_CONTENT_RESOURCES
    )

    suggestions_map: dict[str, list[UUID]] = {
        "names": [n.id for n in scenario.resources["names"].suggestions],
        "descriptions": [d.id for d in scenario.resources["descriptions"].suggestions],
        "problem_statements": [
            ps.id for ps in scenario.resources["problem_statements"].suggestions
        ],
        "departments": [d.id for d in scenario.resources["departments"].suggestions],
        "personas": [p.id for p in scenario.resources["personas"].suggestions],
        "documents": [d.id for d in scenario.resources["documents"].suggestions],
        "parameters": [p.id for p in scenario.resources["parameters"].suggestions],
        "objectives": [],
        "images": [i.id for i in scenario.resources["images"].suggestions],
        "videos": [v.id for v in scenario.resources["videos"].suggestions],
        "questions": [q.id for q in scenario.resources["questions"].suggestions],
        "options": [o.id for o in scenario.resources["options"].suggestions],
    }

    def _section(resource_key: str) -> dict:
        return {
            "show": show_flags_map.get(resource_key, False),
            "required": required_flags_map.get(resource_key, False),
            "suggestions": suggestions_map.get(resource_key),
            "show_ai_generate": show_ai_generate_map.get(resource_key, False),
            "tool_id": tool_ids_map.get(resource_key),
        }

    # ── Step 7: Resource conversion + response assembly ───────────────────

    # Video param computation (pure Python from hydrated resources)
    # Chain: parameter_field_ids → field.parameter_id → parameter.video_parameter
    video_param_ids = {p.id for p in all_parameters if p.video_parameter}
    field_to_param = {
        pf.id: pf.parameter_id
        for pf in all_parameter_fields
        if pf.parameter_id
    }

    def _video_flags_for_field_ids(
        field_ids: list[UUID] | None,
    ) -> tuple[bool, bool]:
        param_ids = {
            field_to_param[fid]
            for fid in (field_ids or [])
            if fid in field_to_param
        }
        has_video = bool(param_ids & video_param_ids)
        has_non_video = bool(param_ids - video_param_ids) or not param_ids
        return has_video, has_non_video

    # Build lookup dicts from entry MV results (keyed by resource ID)
    file_map = {f.files_id: f for f in scenario.entries["files"]}
    image_entry_map = {i.images_id: i for i in scenario.entries["images"]}
    video_entry_map = {v.videos_id: v for v in scenario.entries["videos"]}

    # Converters: resource types → scenario-specific response types
    def _to_name(n) -> ScenarioNameResource:
        return ScenarioNameResource(id=n.id, name=n.name, generated=n.generated)

    def _to_description(d) -> ScenarioDescriptionResource:
        return ScenarioDescriptionResource(
            id=d.id, description=d.description, generated=d.generated
        )

    def _to_problem_statement(ps) -> ScenarioProblemStatement:
        return ScenarioProblemStatement(
            problem_statement_id=ps.id,
            name=ps.name,
            problem_statement=ps.problem_statement,
            generated=ps.generated,
        )

    def _to_department(d) -> ScenarioDepartment:
        return ScenarioDepartment(
            department_id=d.id,
            name=d.name,
            description=d.description,
            generated=d.generated,
        )

    def _to_persona(p) -> ScenarioPersona:
        video_persona, non_video_persona = _video_flags_for_field_ids(p.parameter_field_ids)
        return ScenarioPersona(
            persona_id=p.id,
            name=p.name,
            description=p.description,
            color=p.color,
            icon=p.icon,
            parameter_ids=None,
            field_ids=p.parameter_field_ids,
            example=p.examples[0] if p.examples else None,
            video_persona=video_persona,
            non_video_persona=non_video_persona,
        )

    def _to_document(d) -> ScenarioDocument:
        video_document, non_video_document = _video_flags_for_field_ids(d.parameter_field_ids)
        file_entry = file_map.get(d.file_id) if d.file_id else None
        return ScenarioDocument(
            document_id=d.id,
            name=d.name,
            description=d.description,
            upload_id=file_entry.upload_id if file_entry else None,
            file_path=file_entry.file_path if file_entry else None,
            mime_type=file_entry.mime_type if file_entry else None,
            html=d.template,
            parameter_ids=None,
            field_ids=d.parameter_field_ids,
            parent_document_id=None,
            video_document=video_document,
            non_video_document=non_video_document,
        )

    def _to_parameter(p) -> ScenarioParameter:
        return ScenarioParameter(
            parameter_id=p.id,
            name=p.name,
            description=p.description,
            document_parameter=p.document_parameter,
            persona_parameter=p.persona_parameter,
            scenario_parameter=p.scenario_parameter,
            video_parameter=p.video_parameter,
            non_video_parameter=not p.video_parameter
            if p.video_parameter is not None
            else True,
        )

    def _to_field(f) -> ScenarioField:
        return ScenarioField(
            field_id=getattr(f, "field_id", None) or f.id,
            parameter_id=f.parameter_id,
            generated=f.generated,
        )

    def _to_objective(o) -> ScenarioObjective:
        return ScenarioObjective(
            id=o.id, objective=o.objective, generated=o.generated
        )

    def _to_image(i) -> ScenarioImage:
        entry = image_entry_map.get(i.id)
        return ScenarioImage(
            image_id=i.id,
            name=i.name,
            file_path=entry.file_path if entry else None,
            mime_type=entry.mime_type if entry else None,
            upload_id=entry.upload_id if entry else None,
            generated=i.generated,
        )

    def _to_video(v) -> ScenarioVideo:
        entry = video_entry_map.get(v.id)
        return ScenarioVideo(
            video_id=v.id,
            name=v.name,
            file_path=entry.file_path if entry else None,
            mime_type=entry.mime_type if entry else None,
            upload_id=entry.upload_id if entry else None,
            generated=v.generated,
        )

    def _to_question(q) -> ScenarioQuestion:
        return ScenarioQuestion(
            question_id=q.id,
            question_text=q.question_text,
            allow_multiple=q.allow_multiple,
            generated=q.generated,
        )

    def _to_option(o) -> ScenarioOption:
        return ScenarioOption(
            option_id=o.id,
            option_text=o.option_text,
            is_correct=o.is_correct,
            question_id=o.question_id,
            generated=o.generated,
        )

    # Build flag configs
    all_flags = dedupe_by_id(
        scenario.resources["flags"].selected
        + scenario.resources["flags"].suggestions
    )
    scenario_flags = [
        ScenarioFlagConfig(
            key=f.type,
            label=f.name,
            description=f.description,
            icon_id=f.icon,
            flag_option_id=f.id,
            generated=f.generated,
            video_flag=f.type == "questions_enabled",
        )
        for f in all_flags
        if f.id and f.type and f.type != "scenario_parameter"
    ]
    scenario_flags.sort(key=lambda f: f.video_flag or False)

    current_flag_ids = {f.id for f in scenario.resources["flags"].selected}

    # Convert all resources
    all_names = [_to_name(n) for n in dedupe_by_id(
        scenario.resources["names"].selected
        + scenario.resources["names"].suggestions
    )]
    all_descriptions_conv = [_to_description(d) for d in dedupe_by_id(
        scenario.resources["descriptions"].selected
        + scenario.resources["descriptions"].suggestions
    )]
    all_problem_statements = [_to_problem_statement(ps) for ps in dedupe_by_id(
        scenario.resources["problem_statements"].selected
        + scenario.resources["problem_statements"].suggestions
    )]
    all_departments_conv = [_to_department(d) for d in all_departments]
    all_personas_conv = [_to_persona(p) for p in all_personas]
    all_documents_conv = [_to_document(d) for d in all_documents]
    all_parameters_conv = [_to_parameter(p) for p in all_parameters]
    all_fields_conv = [_to_field(f) for f in all_parameter_fields]
    all_objectives_conv = [_to_objective(o) for o in all_objectives]
    all_images_conv = [_to_image(i) for i in all_images]
    all_videos_conv = [_to_video(v) for v in all_videos]
    all_questions_conv = [_to_question(q) for q in all_questions]
    all_options_conv = [_to_option(o) for o in all_options]

    # Current (selected) resources
    current_departments = [_to_department(d) for d in scenario.resources["departments"].selected]
    current_personas = [_to_persona(p) for p in scenario.resources["personas"].selected]
    current_documents = [_to_document(d) for d in scenario.resources["documents"].selected]
    current_parameters = [_to_parameter(p) for p in scenario.resources["parameters"].selected]
    current_fields = [_to_field(f) for f in scenario.resources["parameter_fields"].selected]
    current_objectives = [_to_objective(o) for o in scenario.resources["objectives"].selected]
    current_images = [_to_image(i) for i in scenario.resources["images"].selected]
    current_videos = [_to_video(v) for v in scenario.resources["videos"].selected]
    current_questions = [_to_question(q) for q in scenario.resources["questions"].selected]
    current_options = [_to_option(o) for o in scenario.resources["options"].selected]

    # Resolved parameter IDs from saved parameter_fields
    resolved_parameter_ids = list(
        {
            str(pf.parameter_id)
            for pf in scenario.resources["parameter_fields"].selected
            if pf.parameter_id
        }
    )

    return GetScenarioApiResponse(
        # Context
        actor_name=profile.name,
        scenario_exists=scenario.artifact_id is not None,
        can_edit=can_edit,
        disabled_reason=disabled_reason,
        draft_version=scenario.draft_version,
        group_id=group_id,
        # Step-level AI generation flags
        basic_show_ai_generate=basic_show_ai_generate,
        content_show_ai_generate=content_show_ai_generate,
        resolved_parameter_ids=resolved_parameter_ids or None,
        # Per-resource sections
        names=ScenarioNameSection(
            **_section("names"),
            resource=_to_name(scenario.resources["names"].selected[0])
            if scenario.resources["names"].selected
            else None,
            resources=all_names,
        ),
        descriptions=ScenarioDescriptionSection(
            **_section("descriptions"),
            resource=_to_description(scenario.resources["descriptions"].selected[0])
            if scenario.resources["descriptions"].selected
            else None,
            resources=all_descriptions_conv,
        ),
        problem_statements=ScenarioProblemStatementSection(
            **_section("problem_statements"),
            resource=_to_problem_statement(
                scenario.resources["problem_statements"].selected[0]
            )
            if scenario.resources["problem_statements"].selected
            else None,
            resources=all_problem_statements,
        ),
        flags=ScenarioFlagSection(
            **_section("flags"),
            current=[f for f in scenario_flags if f.flag_option_id in current_flag_ids],
            resources=scenario_flags,
        ),
        departments=ScenarioDepartmentSection(
            **_section("departments"),
            current=current_departments,
            resources=all_departments_conv,
        ),
        personas=ScenarioPersonaSection(
            **_section("personas"),
            current=current_personas,
            resources=all_personas_conv,
        ),
        documents=ScenarioDocumentSection(
            **_section("documents"),
            current=current_documents,
            resources=all_documents_conv,
        ),
        parameters=ScenarioParameterSection(
            **_section("parameters"),
            current=current_parameters,
            resources=all_parameters_conv,
        ),
        parameter_fields=ScenarioParameterFieldSection(
            **_section("fields"),
            current=current_fields,
            resources=all_fields_conv,
        ),
        objectives=ScenarioObjectiveSection(
            **_section("objectives"),
            current=current_objectives,
            resources=all_objectives_conv,
        ),
        images=ScenarioImageSection(
            **_section("images"),
            current=current_images,
            resources=all_images_conv,
        ),
        videos=ScenarioVideoSection(
            **_section("videos"),
            current=current_videos,
            resources=all_videos_conv,
        ),
        questions=ScenarioQuestionSection(
            **_section("questions"),
            current=current_questions,
            resources=all_questions_conv,
        ),
        options=ScenarioOptionSection(
            **_section("options"),
            current=current_options,
            resources=all_options_conv,
        ),
    )


# ---------------------------------------------------------------------------
# get_scenario_websocket — stub (to be rewritten with infra functions)
# ---------------------------------------------------------------------------


async def get_scenario_websocket(*args, **kwargs):
    """Stub — will be rewritten to use composable infra functions."""
    raise NotImplementedError(
        "get_scenario_websocket needs to be rewritten with infra functions"
    )


# ---------------------------------------------------------------------------
# Route handler
# ---------------------------------------------------------------------------


@router.post("/get", response_model=GetScenarioApiResponse)
async def get_scenario(
    request: GetScenarioApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetScenarioApiResponse:
    """Get scenario information using composable infra architecture."""
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Resolve group_id: client provides it, or draft has it, or create new
        group_id = request.group_id
        if not group_id and request.draft_id:
            drafts = await get_scenario_drafts(conn, [request.draft_id])
            if drafts and drafts[0].group_id:
                group_id = drafts[0].group_id
        if not group_id:
            group_id = await conn.fetchval(
                "INSERT INTO groups_entry (created_at, updated_at) "
                "VALUES (NOW(), NOW()) RETURNING id"
            )

        redis = get_redis_client()

        response_data = await get_scenario_client(
            conn,
            redis,
            profile_id=profile_id,
            scenario_id=request.scenario_id,
            draft_id=request.draft_id,
            group_id=group_id,
            parameter_ids=[UUID(str(pid)) for pid in request.parameter_ids]
            if request.parameter_ids
            else None,
            description_search=request.description_search,
            persona_search=request.persona_search,
            document_search=request.document_search,
            parameter_search=request.parameter_search,
            problem_statement_search=request.problem_statement_search,
            image_search=request.image_search,
            video_search=request.video_search,
            question_search=request.question_search,
            option_search=request.option_search,
            persona_show_selected=request.persona_show_selected,
            document_show_selected=request.document_show_selected,
            parameter_show_selected=request.parameter_show_selected,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = "scenarios"
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
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
