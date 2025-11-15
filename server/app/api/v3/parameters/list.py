"""Parameters list endpoint."""

import json
from collections import Counter
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.schema import ScenarioMapping, ScenarioMappingItem
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class ParametersFilters(BaseModel):
    profileId: str


class ParameterSampleItem(BaseModel):
    parameter_item_id: str
    name: str
    description: str
    value: str


class ParameterItem(BaseModel):
    parameter_id: str
    name: str
    description: str
    numerical: bool
    active: bool
    department_ids: list[str] | None
    scenario_ids: list[str]  # Array of scenario IDs
    num_items: int
    sample_items: list[ParameterSampleItem]
    can_edit: bool
    can_delete: bool
    can_duplicate: bool


class ParametersListResponse(BaseModel):
    parameters: list[ParameterItem]
    scenario_mapping: ScenarioMapping
    department_mapping: dict[str, dict[str, Any]]
    # UI-ready facet options (precomputed on server)
    scenario_options: list[dict[str, str]]  # Array of {value, label}


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
                                    value=item_data.get("value", ""),
                                )
                            )

            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            scenario_ids = []
            if row.get("scenario_ids"):
                scenario_ids = [str(sid) for sid in row["scenario_ids"]]

            parameters.append(
                ParameterItem(
                    parameter_id=str(row["parameter_id"]),
                    name=row["name"],
                    description=row["description"],
                    numerical=row["numerical"],
                    active=row["active"],
                    department_ids=dept_ids,
                    scenario_ids=scenario_ids,
                    num_items=row["num_items"],
                    sample_items=sample_items,
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                )
            )

        # Build facet options
        scenario_options = disambiguate_scenarios(scenario_mapping)

        response_data = ParametersListResponse(
            parameters=parameters,
            scenario_mapping=scenario_mapping,
            department_mapping=department_mapping,
            scenario_options=scenario_options,
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
