"""Parameter search logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments, name)
  2. search_parameters — core artifact search (IDs + total_count)
  3. get_parameters — hydrate junction IDs
  4. Resource get tools — hydrate names, descriptions
  5. Permissions — compute per-parameter can_edit, can_delete, can_duplicate
  6. Facets — parallel resource/artifact searches for filter options
"""

from __future__ import annotations

import asyncio
from uuid import UUID

import asyncpg
from redis.asyncio import Redis

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.api.main.parameter.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.routes.v5.api.main.parameter.types import (
    ListParameterApiParameter,
    ListParameterApiResponse,
)
from app.routes.v5.api.types import ListFilterOption, ListFilterSection
from app.routes.v5.tools.artifacts.parameter.get import get_parameters
from app.routes.v5.tools.artifacts.parameter.search import search_parameters
from app.routes.v5.tools.resources.departments.search import search_departments
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.fields.search import (
    search_fields as search_fields_resource,
)
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.scenarios.search import (
    search_scenarios as search_scenarios_resource,
)


async def search_parameter_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    # Main filters
    search: str | None = None,
    scenario_ids: list[UUID] | None = None,
    field_ids: list[UUID] | None = None,
    filter_department_ids: list[UUID] | None = None,
    # Facet search text
    scenario_search: str | None = None,
    field_search: str | None = None,
    department_search: str | None = None,
    # Pagination
    page_size: int = 12,
    page_offset: int = 0,
) -> ListParameterApiResponse:
    """Parameter search using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> role, departments, name
      2. search_parameters -> (parameter_artifact_ids, total_count)
      3. get_parameters -> hydrate junction IDs
      4. Parallel: hydrate resources + compute permissions + facets
    """
    from fastapi import HTTPException

    # -- Step 1: Profile context --

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    user_role = profile.role
    user_department_ids = profile.department_ids
    actor_name = profile.name

    # -- Step 2: Search parameters --
    # The artifact search tool handles scenario_ids and field_ids filters internally

    parameter_ids, total_count = await search_parameters(
        conn,
        search=search,
        department_ids=filter_department_ids,
        scenario_ids=scenario_ids,
        field_ids=field_ids,
        limit_count=page_size,
        offset_count=page_offset,
    )

    if not parameter_ids:
        return _empty_response(actor_name, total_count=0)

    # -- Step 3: Get parameter artifacts with junction IDs --

    artifacts = await get_parameters(
        conn,
        parameter_ids,
        names=True,
        descriptions=True,
        departments=True,
        flags=True,
        fields=True,
        parameters=True,
    )

    # -- Step 4: Parallel hydration + facets + usage counts --

    all_name_ids: list[UUID] = []
    all_description_ids: list[UUID] = []

    for a in artifacts:
        all_name_ids.extend(a.name_ids or [])
        all_description_ids.extend(a.description_ids or [])

    (
        names_data,
        descriptions_data,
        active_scenario_counts,
        num_items_map,
        sample_items_map,
        scenario_facet,
        field_facet,
        department_facet,
    ) = await asyncio.gather(
        get_names(conn, all_name_ids, redis) if all_name_ids else _empty_list(),
        get_descriptions(conn, all_description_ids, redis)
        if all_description_ids
        else _empty_list(),
        _fetch_active_scenario_counts(conn, artifacts),
        _fetch_num_items(conn, artifacts),
        _fetch_sample_items(conn, artifacts),
        search_scenarios_resource(
            conn, redis, search=scenario_search, scenario=True, limit_count=100
        ),
        search_fields_resource(
            conn, redis, search=field_search, parameter=True, limit_count=100
        ),
        search_departments(
            conn, redis, search=department_search, parameter=True, limit_count=100
        ),
    )

    # Build lookup maps
    name_map = {n.id: n for n in names_data}
    description_map = {d.id: d for d in descriptions_data}

    # -- Step 5: Build parameter list with permissions --

    parameters: list[ListParameterApiParameter] = []

    for a in artifacts:
        name_obj = name_map.get(a.name_ids[0]) if a.name_ids else None
        desc_obj = (
            description_map.get(a.description_ids[0]) if a.description_ids else None
        )

        dept_ids_str = [str(d) for d in (a.department_ids or [])]
        active_scenario_count = active_scenario_counts.get(a.id, 0)

        can_edit = compute_can_edit(
            user_role=user_role,
            parameter_department_ids=dept_ids_str,
            active_scenario_count=active_scenario_count,
            user_department_ids=user_department_ids,
        )
        can_delete = compute_can_delete(
            user_role=user_role,
            parameter_department_ids=dept_ids_str,
            active_scenario_count=active_scenario_count,
        )
        can_duplicate = compute_can_duplicate(user_role)

        parameters.append(
            ListParameterApiParameter(
                parameter_id=a.id,
                name=name_obj.name if name_obj else None,
                description=desc_obj.description if desc_obj else None,
                active=a.active,
                department_ids=dept_ids_str,
                scenario_ids=None,
                num_items=num_items_map.get(a.id, 0),
                sample_items=sample_items_map.get(a.id, []),
                can_edit=can_edit,
                can_duplicate=can_duplicate,
                can_delete=can_delete,
                updated_at=a.updated_at,
            )
        )

    # -- Step 6: Build facet sections --

    scenario_filter = ListFilterSection(
        options=[
            ListFilterOption(id=str(s.id), name=s.name, count=0) for s in scenario_facet
        ],
        selected_ids=[str(sid) for sid in scenario_ids] if scenario_ids else None,
        search=scenario_search,
    )

    field_filter = ListFilterSection(
        options=[
            ListFilterOption(id=str(f.id), name=f.name, count=0) for f in field_facet
        ],
        selected_ids=[str(fid) for fid in field_ids] if field_ids else None,
        search=field_search,
    )

    department_filter = ListFilterSection(
        options=[
            ListFilterOption(id=str(d.id), name=d.name, count=0)
            for d in department_facet
        ],
        selected_ids=[str(did) for did in filter_department_ids]
        if filter_department_ids
        else None,
        search=department_search,
    )

    return ListParameterApiResponse(
        actor_name=actor_name,
        parameters=parameters,
        scenario_filter=scenario_filter,
        field_filter=field_filter,
        department_filter=department_filter,
        total_count=total_count,
    )


# -- Helpers --


def _empty_response(
    actor_name: str | None = None, total_count: int = 0
) -> ListParameterApiResponse:
    return ListParameterApiResponse(
        actor_name=actor_name,
        parameters=[],
        total_count=total_count,
    )


async def _empty_list() -> list:
    return []


async def _fetch_active_scenario_counts(
    conn: asyncpg.Connection,
    artifacts: list,
) -> dict[UUID, int]:
    """Count active scenarios per parameter artifact.

    Path: parameter_artifact -> parameter_parameters_junction -> parameters_resource
          -> parameter_fields_resource -> scenario_parameter_fields_junction -> scenario_artifact
    """
    all_parameter_resource_ids: list[UUID] = []
    artifact_to_param_resource: dict[UUID, list[UUID]] = {}

    for a in artifacts:
        param_res_ids = a.parameter_ids or []
        artifact_to_param_resource[a.id] = param_res_ids
        all_parameter_resource_ids.extend(param_res_ids)

    if not all_parameter_resource_ids:
        return {}

    rows = await conn.fetch(
        """
        SELECT pfr.parameter_id, COUNT(DISTINCT spfj.scenario_id) as cnt
        FROM parameter_fields_resource pfr
        JOIN scenario_parameter_fields_junction spfj
            ON spfj.parameter_fields_id = pfr.id AND spfj.active = true
        JOIN scenario_artifact sa ON sa.id = spfj.scenario_id AND sa.active = true
        WHERE pfr.parameter_id = ANY($1)
        GROUP BY pfr.parameter_id
        """,
        all_parameter_resource_ids,
    )

    resource_counts: dict[UUID, int] = {r["parameter_id"]: r["cnt"] for r in rows}

    result: dict[UUID, int] = {}
    for a_id, param_res_ids in artifact_to_param_resource.items():
        total = sum(resource_counts.get(pid, 0) for pid in param_res_ids)
        if total > 0:
            result[a_id] = total

    return result


async def _fetch_num_items(
    conn: asyncpg.Connection,
    artifacts: list,
) -> dict[UUID, int]:
    """Count parameter field items per parameter artifact.

    Uses parameter_parameters_junction -> parameter_fields_resource to count fields.
    """
    all_parameter_resource_ids: list[UUID] = []
    artifact_to_param_resource: dict[UUID, list[UUID]] = {}

    for a in artifacts:
        param_res_ids = a.parameter_ids or []
        artifact_to_param_resource[a.id] = param_res_ids
        all_parameter_resource_ids.extend(param_res_ids)

    if not all_parameter_resource_ids:
        return {}

    rows = await conn.fetch(
        """
        SELECT pfr.parameter_id, COUNT(*) as cnt
        FROM parameter_fields_resource pfr
        WHERE pfr.parameter_id = ANY($1)
        GROUP BY pfr.parameter_id
        """,
        all_parameter_resource_ids,
    )

    resource_counts: dict[UUID, int] = {r["parameter_id"]: r["cnt"] for r in rows}

    result: dict[UUID, int] = {}
    for a_id, param_res_ids in artifact_to_param_resource.items():
        total = sum(resource_counts.get(pid, 0) for pid in param_res_ids)
        if total > 0:
            result[a_id] = total

    return result


async def _fetch_sample_items(
    conn: asyncpg.Connection,
    artifacts: list,
) -> dict[UUID, list[str]]:
    """Fetch sample parameter field names per parameter artifact (up to 3)."""
    all_parameter_resource_ids: list[UUID] = []
    resource_to_artifact: dict[UUID, UUID] = {}

    for a in artifacts:
        for pid in a.parameter_ids or []:
            resource_to_artifact[pid] = a.id
            all_parameter_resource_ids.append(pid)

    if not all_parameter_resource_ids:
        return {}

    rows = await conn.fetch(
        """
        SELECT pfr.parameter_id, fr.name
        FROM parameter_fields_resource pfr
        JOIN fields_resource fr ON fr.id = pfr.field_id
        WHERE pfr.parameter_id = ANY($1)
        ORDER BY pfr.parameter_id, fr.name
        """,
        all_parameter_resource_ids,
    )

    # Group by parameter_id, take up to 3
    resource_samples: dict[UUID, list[str]] = {}
    for r in rows:
        pid = r["parameter_id"]
        name = r["name"]
        if name:
            lst = resource_samples.setdefault(pid, [])
            if len(lst) < 3:
                lst.append(name)

    # Map to artifact IDs
    result: dict[UUID, list[str]] = {}
    for pid, names in resource_samples.items():
        a_id = resource_to_artifact.get(pid)
        if a_id:
            existing = result.get(a_id, [])
            existing.extend(names)
            result[a_id] = existing[:3]

    return result
