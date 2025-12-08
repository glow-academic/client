"""Parameters list endpoint."""

import json
from collections import Counter
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import (
    DocumentMapping,
    DocumentMappingItem,
    ScenarioMapping,
    ScenarioMappingItem,
)
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class ParametersFilters(BaseModel):
    profileId: str


class ParameterSampleItem(BaseModel):
    parameter_item_id: str
    name: str
    description: str


class ParameterItem(BaseModel):
    parameter_id: str
    name: str
    description: str
    active: bool
    department_ids: list[str] | None
    scenario_ids: list[str]  # Array of scenario IDs
    document_ids: list[str]  # Array of document IDs
    num_items: int
    sample_items: list[ParameterSampleItem]
    can_edit: bool
    can_delete: bool
    can_duplicate: bool


class ParametersListResponse(BaseModel):
    parameters: list[ParameterItem]
    scenario_mapping: ScenarioMapping
    department_mapping: dict[str, dict[str, Any]]
    document_mapping: DocumentMapping
    # UI-ready facet options (precomputed on server)
    scenario_options: list[dict[str, str]]  # Array of {value, label}
    document_options: list[dict[str, str]]  # Array of {value, label}


router = APIRouter()


def disambiguate_scenarios(smap: ScenarioMapping) -> list[dict[str, str]]:
    """Build scenario options with disambiguation for duplicate names."""
    names = Counter([v.name for v in smap.values()])
    out = []
    for sid, v in smap.items():
        label = v.name
        if names[v.name] > 1:
            # Use last 8 characters of UUID for disambiguation
            label = f"{v.name} ({sid[-8:]})"
        out.append({"value": sid, "label": label})
    return out


def disambiguate_documents(dmap: DocumentMapping) -> list[dict[str, str]]:
    """Build document options with disambiguation for duplicate names."""
    names = Counter([v.name for v in dmap.values()])
    out = []
    for did, v in dmap.items():
        label = v.name
        if names[v.name] > 1:
            # Use last 8 characters of UUID for disambiguation
            label = f"{v.name} ({did[-8:]})"
        out.append({"value": did, "label": label})
    return out


@router.post("/list", response_model=ParametersListResponse)
async def get_parameters_list(
    filters: ParametersFilters,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ParametersListResponse:
    """Get parameters list with item counts and permissions."""
    tags = ["parameters"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return ParametersListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/parameters/list_parameters.sql")
        sql_params = (filters.profileId,)
        result = await conn.fetch(sql_query, filters.profileId)

        parameters = []
        scenario_mapping: ScenarioMapping = {}
        department_mapping: dict[str, dict[str, Any]] = {}
        document_mapping: DocumentMapping = {}

        # Parse mappings from first row (same across all rows)
        if result:
            first_row = result[0]

            # Parse scenario mapping from JSONB
            scenario_mapping_data = first_row.get("scenario_mapping")
            if isinstance(scenario_mapping_data, str):
                scenario_mapping_data = json.loads(scenario_mapping_data)
            if scenario_mapping_data and isinstance(scenario_mapping_data, dict):
                for sid, sdata in scenario_mapping_data.items():
                    if isinstance(sdata, dict):
                        scenario_mapping[sid] = ScenarioMappingItem(
                            name=sdata.get("name", ""),
                            description=sdata.get("description", ""),
                            persona_ids=sdata.get("persona_ids", []),
                            persona_mapping=sdata.get("persona_mapping", {}),
                            document_mapping=sdata.get("document_mapping", {}),
                            parameter_item_mapping=sdata.get(
                                "parameter_item_mapping", {}
                            ),
                            parameter_item_ids=sdata.get("parameter_item_ids", []),
                            document_ids=sdata.get("document_ids", []),
                        )

            # Parse department_mapping from JSONB
            department_mapping_data = first_row.get("department_mapping")
            if isinstance(department_mapping_data, str):
                department_mapping_data = json.loads(department_mapping_data)
            if department_mapping_data and isinstance(department_mapping_data, dict):
                department_mapping = department_mapping_data

            # Parse document_mapping from JSONB
            document_mapping_data = first_row.get("document_mapping")
            if isinstance(document_mapping_data, str):
                document_mapping_data = json.loads(document_mapping_data)
            if document_mapping_data and isinstance(document_mapping_data, dict):
                for did, ddata in document_mapping_data.items():
                    if isinstance(ddata, dict):
                        document_mapping[did] = DocumentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

        for row in result:
            # Parse sample items from JSONB
            sample_items = []
            if row.get("sample_items_json"):
                items_data = row["sample_items_json"]
                if isinstance(items_data, str):
                    items_data = json.loads(items_data)
                if isinstance(items_data, list):
                    for item_data in items_data:
                        if isinstance(item_data, dict):
                            sample_items.append(
                                ParameterSampleItem(
                                    parameter_item_id=item_data.get(
                                        "parameter_item_id", ""
                                    ),
                                    name=item_data.get("name", ""),
                                    description=item_data.get("description", ""),
                                )
                            )

            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            scenario_ids = []
            if row.get("scenario_ids"):
                scenario_ids = [str(sid) for sid in row["scenario_ids"]]

            document_ids = []
            if row.get("document_ids"):
                document_ids = [str(did) for did in row["document_ids"]]

            parameters.append(
                ParameterItem(
                    parameter_id=str(row["parameter_id"]),
                    name=row["name"],
                    description=row["description"],
                    active=row["active"],
                    department_ids=dept_ids,
                    scenario_ids=scenario_ids,
                    document_ids=document_ids,
                    num_items=row["num_items"],
                    sample_items=sample_items,
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                )
            )

        # Get user departments for scoping scenario and document options
        user_department_rows = await conn.fetch(
            "SELECT department_id FROM profile_departments WHERE profile_id = $1 AND active = true",
            filters.profileId,
        )
        user_department_ids = {
            str(row["department_id"]) for row in user_department_rows
        }

        # Collect scenario IDs, document IDs, and department IDs actually assigned to parameters
        assigned_scenario_ids = set()
        assigned_document_ids = set()
        assigned_department_ids = set()
        for parameter in parameters:
            assigned_scenario_ids.update(parameter.scenario_ids)
            assigned_document_ids.update(parameter.document_ids)
            if parameter.department_ids:
                assigned_department_ids.update(parameter.department_ids)

        # Build facet options
        # Filter scenario_options to only include scenarios assigned to parameters AND in user's departments
        # Need to check scenario departments via scenario_departments table
        scenario_ids_in_user_depts = set()
        if assigned_scenario_ids:
            scenario_dept_rows = await conn.fetch(
                """
                SELECT DISTINCT sd.scenario_id::text
                FROM scenario_departments sd
                WHERE sd.scenario_id::text = ANY($1::text[])
                AND sd.department_id::text = ANY($2::text[])
                AND sd.active = true
                UNION
                SELECT DISTINCT s.id::text
                FROM scenarios s
                WHERE s.id::text = ANY($1::text[])
                AND NOT EXISTS (
                    SELECT 1 FROM scenario_departments sd2 
                    WHERE sd2.scenario_id = s.id AND sd2.active = true
                )
                """,
                list(assigned_scenario_ids),
                list(user_department_ids),
            )
            scenario_ids_in_user_depts = {
                row["scenario_id"] for row in scenario_dept_rows
            }

        scenario_options = [
            opt
            for opt in disambiguate_scenarios(scenario_mapping)
            if opt["value"] in scenario_ids_in_user_depts
        ]

        # Filter document_options to only include documents assigned to parameters AND in user's departments
        document_ids_in_user_depts = set()
        if assigned_document_ids:
            document_dept_rows = await conn.fetch(
                """
                SELECT DISTINCT dd.document_id::text
                FROM document_departments dd
                WHERE dd.document_id::text = ANY($1::text[])
                AND dd.department_id::text = ANY($2::text[])
                AND dd.active = true
                UNION
                SELECT DISTINCT d.id::text
                FROM documents d
                WHERE d.id::text = ANY($1::text[])
                AND NOT EXISTS (
                    SELECT 1 FROM document_departments dd2 
                    WHERE dd2.document_id = d.id AND dd2.active = true
                )
                """,
                list(assigned_document_ids),
                list(user_department_ids),
            )
            document_ids_in_user_depts = {
                row["document_id"] for row in document_dept_rows
            }

        document_options = [
            opt
            for opt in disambiguate_documents(document_mapping)
            if opt["value"] in document_ids_in_user_depts
        ]

        # Filter department_mapping to only include departments assigned to parameters AND in user's departments
        filtered_department_mapping = {
            did: d
            for (did, d) in department_mapping.items()
            if did in assigned_department_ids and did in user_department_ids
        }

        response_data = ParametersListResponse(
            parameters=parameters,
            scenario_mapping=scenario_mapping,
            department_mapping=filtered_department_mapping,
            document_mapping=document_mapping,
            scenario_options=scenario_options,
            document_options=document_options,
        )

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_parameters_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
