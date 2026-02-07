"""Get endpoint for drafts resources view."""

from typing import Annotated, Any
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.views.drafts.types import (
    DraftResourcesViewItem,
    GetDraftResourcesRequest,
    GetDraftResourcesResponse,
)
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/drafts/get_draft_resources_view_complete.sql"

router = APIRouter()


async def get_draft_resources_internal(
    conn: asyncpg.Connection,
    draft_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[DraftResourcesViewItem]:
    """Internal function for fetching draft resources view rows."""
    from app.sql.types import GetDraftResourcesViewSqlParams

    cache_key_val = cache_key(
        "views/drafts/get",
        {"draft_ids": [str(d) for d in draft_ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                DraftResourcesViewItem.model_validate(item) for item in cached["items"]
            ]

    params = GetDraftResourcesViewSqlParams(draft_ids=draft_ids)
    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    items: list[DraftResourcesViewItem] = []
    if result and result.items:
        for item in result.items:
            items.append(
                DraftResourcesViewItem(
                    draft_id=item.draft_id,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                    version=item.version or 0,
                    generated=item.generated or False,
                    mcp=item.mcp or False,
                    active=item.active if item.active is not None else True,
                    names_group_id=item.names_group_id,
                    descriptions_group_id=item.descriptions_group_id,
                    flags_group_id=item.flags_group_id,
                    colors_group_id=item.colors_group_id,
                    icons_group_id=item.icons_group_id,
                    auths_group_id=item.auths_group_id,
                    tools_group_id=item.tools_group_id,
                    instructions_group_id=item.instructions_group_id,
                    documents_group_id=item.documents_group_id,
                    departments_group_id=item.departments_group_id,
                    parameters_group_id=item.parameters_group_id,
                    parameter_fields_group_id=item.parameter_fields_group_id,
                    fields_group_id=item.fields_group_id,
                    examples_group_id=item.examples_group_id,
                    questions_group_id=item.questions_group_id,
                    templates_group_id=item.templates_group_id,
                    texts_group_id=item.texts_group_id,
                    run_rubrics_group_id=item.run_rubrics_group_id,
                    group_rubrics_group_id=item.group_rubrics_group_id,
                    bindings_group_id=item.bindings_group_id,
                    conditional_parameters_group_id=item.conditional_parameters_group_id,
                    personas_group_id=item.personas_group_id,
                    scenarios_group_id=item.scenarios_group_id,
                    simulations_group_id=item.simulations_group_id,
                    resource_types=[str(t) for t in item.resource_types]
                    if item.resource_types
                    else [],
                    resource_ids=list(item.resource_ids) if item.resource_ids else [],
                    name_ids=list(item.name_ids) if item.name_ids else [],
                    description_ids=list(item.description_ids)
                    if item.description_ids
                    else [],
                    flag_ids=list(item.flag_ids) if item.flag_ids else [],
                    color_ids=list(item.color_ids) if item.color_ids else [],
                    icon_ids=list(item.icon_ids) if item.icon_ids else [],
                    auth_ids=list(item.auth_ids) if item.auth_ids else [],
                    tool_ids=list(item.tool_ids) if item.tool_ids else [],
                    instruction_ids=list(item.instruction_ids)
                    if item.instruction_ids
                    else [],
                    document_ids=list(item.document_ids) if item.document_ids else [],
                    department_ids=list(item.department_ids)
                    if item.department_ids
                    else [],
                    parameter_ids=list(item.parameter_ids)
                    if item.parameter_ids
                    else [],
                    parameter_field_ids=list(item.parameter_field_ids)
                    if item.parameter_field_ids
                    else [],
                    field_ids=list(item.field_ids) if item.field_ids else [],
                    example_ids=list(item.example_ids) if item.example_ids else [],
                    question_ids=list(item.question_ids) if item.question_ids else [],
                    template_ids=list(item.template_ids) if item.template_ids else [],
                    text_ids=list(item.text_ids) if item.text_ids else [],
                    run_rubric_ids=list(item.run_rubric_ids)
                    if item.run_rubric_ids
                    else [],
                    group_rubric_ids=list(item.group_rubric_ids)
                    if item.group_rubric_ids
                    else [],
                    binding_ids=list(item.binding_ids) if item.binding_ids else [],
                    conditional_parameter_ids=list(item.conditional_parameter_ids)
                    if item.conditional_parameter_ids
                    else [],
                    persona_ids=list(item.persona_ids) if item.persona_ids else [],
                    scenario_ids=list(item.scenario_ids) if item.scenario_ids else [],
                    simulation_ids=list(item.simulation_ids)
                    if item.simulation_ids
                    else [],
                )
            )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["views", "drafts"],
    )

    return items


@router.post(
    "/get",
    response_model=GetDraftResourcesResponse,
    dependencies=[
        audit_activity(
            "views.drafts.get",
            "{{ actor.name }} fetched draft resources view data",
        )
    ],
)
async def get_draft_resources(
    request: GetDraftResourcesRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDraftResourcesResponse:
    """Get denormalized draft resources data from mv_draft_resources."""
    tags = ["views", "drafts"]

    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        items = await get_draft_resources_internal(
            conn=conn,
            draft_ids=request.draft_ids,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetDraftResourcesResponse(items=items)

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="views_drafts_get",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
