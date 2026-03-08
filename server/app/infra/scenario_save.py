"""Scenario save logic — composable infra architecture.

Core save function that composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. resolve_scenario_permissions_context — access check
  3. Resource create/search tools — raw value → ID resolution
  4. Artifact create/update tools — junction writes
  5. Scenario resource create tool — denormalized snapshot
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.scenario_permissions_context import resolve_scenario_permissions_context

# Artifact tools
from app.routes.v5.tools.artifacts.scenario.create import (
    create_scenario as create_scenario_artifact,
)
from app.routes.v5.tools.artifacts.scenario.update import (
    _UNSET,
)
from app.routes.v5.tools.artifacts.scenario.update import (
    update_scenario as update_scenario_artifact,
)

# Resource create tools (raw value → ID)
from app.routes.v5.tools.resources.departments.search import search_departments
from app.routes.v5.tools.resources.descriptions.create import create_description
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.documents.search import search_documents
from app.routes.v5.tools.resources.fields.get import get_fields
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.images.search import search_images
from app.routes.v5.tools.resources.names.create import create_name
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.objectives.search import search_objectives
from app.routes.v5.tools.resources.options.search import search_options
from app.routes.v5.tools.resources.parameter_fields.search import (
    search_parameter_fields,
)
from app.routes.v5.tools.resources.personas.search import search_personas
from app.routes.v5.tools.resources.problem_statements.create import (
    create_problem_statement,
)
from app.routes.v5.tools.resources.questions.search import search_questions

# Resource create tool (denormalized snapshot)
from app.routes.v5.tools.resources.scenarios.create import (
    create_scenario as create_scenario_resource,
)
from app.routes.v5.tools.resources.videos.search import search_videos
from app.utils.cache.invalidate_tags import invalidate_tags

if TYPE_CHECKING:
    from app.routes.v5.api.main.scenario.types import (
        SaveScenarioApiResponse,
        SaveScenarioFieldError,
        SaveScenarioItem,
        SaveScenarioResult,
    )


# ---------------------------------------------------------------------------
# Value resolution — raw value → ID via create/search tools
# ---------------------------------------------------------------------------


async def resolve_scenario_values(
    conn: asyncpg.Connection,
    redis: Redis,
    item: SaveScenarioItem,
    is_update: bool,
) -> list[SaveScenarioFieldError]:
    """Resolve raw value fields to resource IDs (mutates item in place).

    For 'create' resources (name, description, problem_statement):
      Creates a new resource via the create tool.
    For 'match' resources (departments, personas, documents, etc.):
      Searches by name via the search tool, matches exact (case-insensitive).

    Returns a list of errors (empty if all resolved).
    """
    from app.routes.v5.api.main.scenario.types import SaveScenarioFieldError

    errors: list[SaveScenarioFieldError] = []

    # --- Create resources ---

    if item.name is not None and item.name_id is None:
        result = await create_name(conn, item.name, redis)
        item.name_id = result.id

    if item.description is not None and item.description_id is None:
        result = await create_description(conn, item.description, redis)
        item.description_id = result.id

    if item.problem_statement is not None and item.problem_statement_id is None:
        result = await create_problem_statement(
            conn, item.problem_statement, item.problem_statement, redis
        )
        item.problem_statement_id = result.id

    # --- Match resources ---

    if item.active_flag is not None and item.active_flag_id is None:
        results = await search_flags(
            conn,
            redis,
            search=None,
            flag_type="scenario_active",
            limit_count=100,
            scenario=True,
        )
        match = next((r for r in results if r.type == "scenario_active"), None)
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
        all_depts = await search_departments(
            conn,
            redis,
            search=None,
            limit_count=1000,
            scenario=True,
        )
        dept_name_map = {d.name.lower(): d.id for d in all_depts if d.name and d.id}
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
        all_personas = await search_personas(
            conn,
            redis,
            search=None,
            limit_count=1000,
            scenario=True,
        )
        persona_name_map = {
            p.name.lower(): p.id for p in all_personas if p.name and p.id
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
        all_docs = await search_documents(
            conn,
            redis,
            search=None,
            limit_count=1000,
            scenario=True,
        )
        doc_name_map = {d.name.lower(): d.id for d in all_docs if d.name and d.id}
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
        all_pf = await search_parameter_fields(conn, redis, scenario=True)
        field_ids_list = [pf.field_id for pf in all_pf if pf.field_id]
        fields_list = (
            await get_fields(conn, field_ids_list, redis) if field_ids_list else []
        )
        field_name_map = {f.id: f.name for f in fields_list if f.name}
        pf_name_map = {
            field_name_map[pf.field_id].lower(): pf.id
            for pf in all_pf
            if pf.field_id and pf.id and pf.field_id in field_name_map
        }
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
        all_objectives = await search_objectives(
            conn,
            redis,
            search=None,
            limit_count=1000,
            scenario=True,
        )
        obj_name_map = {
            o.objective.lower(): o.id for o in all_objectives if o.objective and o.id
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
        all_images = await search_images(
            conn,
            redis,
            search=None,
            limit_count=1000,
            scenario=True,
        )
        img_name_map = {i.name.lower(): i.id for i in all_images if i.name and i.id}
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
        all_videos = await search_videos(
            conn,
            redis,
            search=None,
            limit_count=1000,
            scenario=True,
        )
        vid_name_map = {v.name.lower(): v.id for v in all_videos if v.name and v.id}
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
        all_questions = await search_questions(
            conn,
            redis,
            search=None,
            limit_count=1000,
            scenario=True,
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
        all_options = await search_options(
            conn,
            redis,
            search=None,
            limit_count=1000,
            scenario=True,
        )
        opt_name_map = {
            o.option_text.lower(): o.id for o in all_options if o.option_text and o.id
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

    # --- Validate required fields (create only) ---

    if not is_update:
        if item.name_id is None:
            errors.append(
                SaveScenarioFieldError(field="name", message="Name is required")
            )

    return errors


# ---------------------------------------------------------------------------
# Denormalized snapshot — hydrate resource IDs to values
# ---------------------------------------------------------------------------


async def _create_denormalized_snapshot(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    name_id: UUID | None,
    description_id: UUID | None,
) -> UUID:
    """Create a scenarios_resource snapshot by hydrating IDs to values."""

    async def _empty() -> list:
        return []

    names, descriptions = await asyncio.gather(
        get_names(conn, [name_id], redis, bypass_cache=True) if name_id else _empty(),
        get_descriptions(conn, [description_id], redis, bypass_cache=True)
        if description_id
        else _empty(),
    )

    result = await create_scenario_resource(
        conn,
        redis,
        name=names[0].name if names else "",
        description=descriptions[0].description if descriptions else "",
    )
    return result.id


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _collect_flag_ids(item: SaveScenarioItem) -> list[UUID] | None:
    """Collect all non-None flag IDs from the item into a single list."""
    flag_ids = []
    for fid in [
        item.active_flag_id,
        item.objectives_enabled_flag_id,
        item.images_enabled_flag_id,
        item.video_enabled_flag_id,
        item.questions_enabled_flag_id,
        item.problem_statement_enabled_flag_id,
    ]:
        if fid is not None:
            flag_ids.append(fid)
    return flag_ids if flag_ids else None


# ---------------------------------------------------------------------------
# save_scenario_client — composable infra architecture
# ---------------------------------------------------------------------------


async def save_scenario_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list[SaveScenarioItem],
    group_id: UUID | None = None,
) -> SaveScenarioApiResponse:
    """Scenario save using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, department_ids
      2. Per-item permission check (fail fast)
      3. Per-item value resolution (raw → ID)
      4. Single transaction: artifact create/update + denormalized snapshot
      5. invalidate_tags
    """
    from app.infra.scenario_permissions import (
        compute_can_create,
        compute_can_edit,
        has_access,
    )
    from app.routes.v5.api.main.scenario.types import (
        SaveScenarioApiResponse,
        SaveScenarioResult,
    )

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Per-item permission check ──────────────────────────────

    for idx, item in enumerate(items):
        if item.input_scenario_id is not None:
            perms = await resolve_scenario_permissions_context(
                conn, item.input_scenario_id
            )
            if not perms.exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Item {idx}: Scenario {item.input_scenario_id} not found.",
                )
            if not has_access(
                profile.role, profile.department_ids, perms.department_ids
            ):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have access to this scenario.",
                )
            if not compute_can_edit(
                user_role=profile.role,
                scenario_department_ids=perms.department_ids,
                active_simulation_count=perms.active_simulation_count,
                user_department_ids=profile.department_ids,
            ):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to save this scenario.",
                )
        else:
            request_department_ids = (
                [str(d) for d in (item.department_ids or [])]
                if item.department_ids
                else []
            )
            if not compute_can_create(profile.role, request_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to create a scenario.",
                )

    # ── Step 3: Per-item value resolution ──────────────────────────────

    has_errors = False
    error_results: list[SaveScenarioResult] = []

    for idx, item in enumerate(items):
        item_errors = await resolve_scenario_values(
            conn,
            redis,
            item,
            is_update=item.input_scenario_id is not None,
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
            error_results.append(SaveScenarioResult(success=True, message="Validated"))

    if has_errors:
        return SaveScenarioApiResponse(results=error_results)

    # ── Step 4: Single transaction ─────────────────────────────────────

    results: list[SaveScenarioResult] = []

    async with conn.transaction():
        for item in items:
            is_update = item.input_scenario_id is not None

            # Create denormalized snapshot
            scenarios_resource_id = await _create_denormalized_snapshot(
                conn,
                redis,
                name_id=item.name_id,
                description_id=item.description_id,
            )

            flag_ids = _collect_flag_ids(item)

            if is_update:
                result = await update_scenario_artifact(
                    conn,
                    item.input_scenario_id,
                    name_id=item.name_id if item.name_id else _UNSET,
                    description_id=item.description_id
                    if item.description_id
                    else _UNSET,
                    department_ids=item.department_ids,
                    flag_ids=flag_ids,
                    document_ids=item.document_ids,
                    image_ids=item.image_ids,
                    objective_ids=item.objective_ids,
                    option_ids=item.option_ids,
                    parameter_field_ids=item.parameter_field_ids,
                    persona_ids=item.persona_ids,
                    problem_statement_ids=[item.problem_statement_id]
                    if item.problem_statement_id
                    else None,
                    question_ids=item.question_ids,
                    video_ids=item.video_ids,
                    scenario_ids=[scenarios_resource_id],
                )
                scenario_id = result.id
            else:
                result = await create_scenario_artifact(
                    conn,
                    name_id=item.name_id,
                    description_id=item.description_id,
                    department_ids=item.department_ids,
                    flag_ids=flag_ids,
                    document_ids=item.document_ids,
                    image_ids=item.image_ids,
                    objective_ids=item.objective_ids,
                    option_ids=item.option_ids,
                    parameter_field_ids=item.parameter_field_ids,
                    persona_ids=item.persona_ids,
                    problem_statement_ids=[item.problem_statement_id]
                    if item.problem_statement_id
                    else None,
                    question_ids=item.question_ids,
                    video_ids=item.video_ids,
                    scenario_ids=[scenarios_resource_id],
                )
                scenario_id = result.id

            results.append(
                SaveScenarioResult(
                    success=True,
                    scenario_id=scenario_id,
                    message="Scenario updated successfully"
                    if is_update
                    else "Scenario created successfully",
                )
            )

    # ── Step 5: Invalidate cache ───────────────────────────────────────

    await invalidate_tags(["scenarios"], redis=redis)

    return SaveScenarioApiResponse(results=results)
