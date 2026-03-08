"""Scenario permissions context + shared save helpers.

Permissions context:
  1. resolve_scenario_permissions_context — lightweight access + edit check

Shared save helpers (used by both create and update):
  2. resolve_scenario_values — raw string → resource ID resolution
  3. create_denormalized_snapshot — hydrate IDs → scenarios_resource snapshot

Composes existing black-box fetchers — no raw SQL.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.routes.v5.tools.artifacts.scenario.get import (
    get_scenarios as get_scenario_artifacts,
)
from app.routes.v5.tools.artifacts.simulation.search import search_simulations
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
from app.routes.v5.tools.resources.scenarios.create import (
    create_scenario as create_scenario_resource,
)
from app.routes.v5.tools.resources.videos.search import search_videos

if TYPE_CHECKING:
    from app.routes.v5.api.main.scenario.types import (
        CreateScenarioItem,
        ScenarioFieldError,
        UpdateScenarioItem,
    )


@dataclass(frozen=True)
class ScenarioPermissionsContext:
    """Lightweight context for scenario permission checks."""

    exists: bool
    department_ids: list[UUID]
    active_simulation_count: int


async def resolve_scenario_permissions_context(
    conn: asyncpg.Connection,
    scenario_id: UUID,
) -> ScenarioPermissionsContext:
    """Fetch just what's needed for scenario permission checks.

    Two black-box tool calls:
      1. get_scenario_artifacts → department_ids + scenario_ids (resource IDs)
      2. search_simulations → any active simulations using this scenario?
    """
    artifacts = await get_scenario_artifacts(
        conn,
        [scenario_id],
        departments=True,
        scenarios=True,
    )

    if not artifacts:
        return ScenarioPermissionsContext(
            exists=False,
            department_ids=[],
            active_simulation_count=0,
        )

    artifact = artifacts[0]
    department_ids = list(artifact.department_ids or [])
    scenario_resource_ids = list(artifact.scenario_ids or [])

    _, total = (
        await search_simulations(
            conn,
            scenario_ids=scenario_resource_ids,
            active_only=True,
            limit_count=1,
        )
        if scenario_resource_ids
        else ([], 0)
    )

    return ScenarioPermissionsContext(
        exists=True,
        department_ids=department_ids,
        active_simulation_count=total,
    )


# ---------------------------------------------------------------------------
# Shared save helpers — used by both scenario_create and scenario_update
# ---------------------------------------------------------------------------


async def resolve_scenario_values(
    conn: asyncpg.Connection,
    redis: Redis,
    item: CreateScenarioItem | UpdateScenarioItem,
    is_create: bool,
) -> list[ScenarioFieldError]:
    """Resolve raw value fields to resource IDs (mutates item in place).

    For 'create' resources (name, description, problem_statement):
      Creates a new resource via the create tool.
    For 'match' resources (departments, personas, documents, etc.):
      Searches by name via the search tool, matches exact (case-insensitive).

    Returns a list of errors (empty if all resolved).
    """
    from app.routes.v5.api.main.scenario.types import ScenarioFieldError

    errors: list[ScenarioFieldError] = []

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
                ScenarioFieldError(
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
                    ScenarioFieldError(
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
                    ScenarioFieldError(
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
                    ScenarioFieldError(
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
                    ScenarioFieldError(
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
                    ScenarioFieldError(
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
                    ScenarioFieldError(
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
                    ScenarioFieldError(
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
                    ScenarioFieldError(
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
                    ScenarioFieldError(
                        field="options",
                        message=f'Option "{opt_name}" not found',
                    )
                )
        if not any(e.field == "options" for e in errors):
            item.option_ids = resolved_ids

    # --- Validate required fields (create only) ---

    if is_create:
        if item.name_id is None:
            errors.append(ScenarioFieldError(field="name", message="Name is required"))

    return errors


async def create_denormalized_snapshot(
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
