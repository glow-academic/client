"""Footer section endpoint for dashboard artifact."""

import asyncio
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.dashboard.permissions import compute_footer_metrics_v2
from app.api.v4.artifacts.dashboard.shared import (
    build_field_meta,
    build_parameter_meta,
    build_simulation_meta,
    fetch_chats_data,
    fetch_thresholds,
    parse_dashboard_filters,
)
from app.api.v4.artifacts.dashboard.types import (
    DashboardFooterRequest,
    DashboardFooterResponse,
)
from app.api.v4.entries.chat.training_config import get_training_config_internal
from app.api.v4.resources.documents.get import get_documents_internal
from app.api.v4.resources.fields.get import get_fields_internal
from app.api.v4.resources.parameter_fields.get import get_parameter_fields_internal
from app.api.v4.resources.parameters.get import get_parameters_internal
from app.api.v4.resources.personas.get import get_personas_internal
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.api.v4.resources.simulations.get import get_simulations_internal
from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool

router = APIRouter()


@router.post(
    "/footer",
    response_model=DashboardFooterResponse,
    dependencies=[
        audit_activity(
            "artifacts.dashboard.footer",
            "{{ actor.name }} fetched dashboard footer section",
        )
    ],
)
async def get_dashboard_footer(
    request: DashboardFooterRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DashboardFooterResponse:
    """Get dashboard footer section data."""
    tags = ["artifacts", "dashboard", "views", "analytics", "footer"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        # 1. Parse filters
        filters = parse_dashboard_filters(request)

        # 2. Fetch chats (replaces scenario facts) + thresholds in parallel
        chats_result, thresholds = await asyncio.gather(
            fetch_chats_data(
                pool=pool,
                request=request,
                filters=filters,
                bypass_cache=bypass_cache,
            ),
            fetch_thresholds(
                pool=pool,
                actor_profile_id=request.actor_profile_id,
                target_profile_id=request.target_profile_id,
                department_ids=request.department_ids,
            ),
        )

        chat_items = chats_result.items

        # 3. Enrich with document_ids from training config
        td_ids = list(
            {
                item.training_department_id
                for item in chat_items
                if item.training_department_id
            }
        )
        if td_ids:
            async with pool.acquire() as c:
                config_map = await get_training_config_internal(
                    conn=c,
                    training_department_ids=td_ids,
                    bypass_cache=bypass_cache,
                )
            for item in chat_items:
                if item.training_department_id:
                    config = config_map.get(item.training_department_id)
                    if config and config.document_ids:
                        item.document_ids = list(config.document_ids)

        # 4. Collect resource IDs from chat items
        simulation_ids_set: set = set()
        scenario_ids_set: set = set()
        persona_ids_set: set = set()
        document_ids_set: set = set()
        for row in chat_items:
            simulation_ids_set.add(row.simulation_id)
            if row.scenario_id:
                scenario_ids_set.add(row.scenario_id)
            if row.persona_id:
                persona_ids_set.add(row.persona_id)
            for doc_id in row.document_ids or []:
                document_ids_set.add(doc_id)

        # 5. Batch 1: Hydrate simulations, scenarios, personas, documents
        async def _get_simulations():
            async with pool.acquire() as c:
                return await get_simulations_internal(
                    conn=c, ids=list(simulation_ids_set), bypass_cache=bypass_cache
                )

        async def _get_scenarios():
            async with pool.acquire() as c:
                return await get_scenarios_internal(
                    conn=c, ids=list(scenario_ids_set), bypass_cache=bypass_cache
                )

        async def _get_personas():
            async with pool.acquire() as c:
                return await get_personas_internal(
                    conn=c, ids=list(persona_ids_set), bypass_cache=bypass_cache
                )

        async def _get_documents():
            async with pool.acquire() as c:
                return await get_documents_internal(
                    conn=c, ids=list(document_ids_set), bypass_cache=bypass_cache
                )

        simulations, scenarios_list, personas, documents = await asyncio.gather(
            _get_simulations(),
            _get_scenarios(),
            _get_personas(),
            _get_documents(),
        )

        # 6. Collect all parameter_field_ids from hydrated resources
        all_pf_ids: set = set()
        for s in scenarios_list:
            for pfid in getattr(s, "parameter_field_ids", None) or []:
                all_pf_ids.add(pfid)
        for p in personas:
            for pfid in getattr(p, "parameter_field_ids", None) or []:
                all_pf_ids.add(pfid)
        for d in documents:
            for pfid in getattr(d, "parameter_field_ids", None) or []:
                all_pf_ids.add(pfid)

        # 7. Batch 2: Hydrate parameter_fields
        async with pool.acquire() as c:
            parameter_fields = await get_parameter_fields_internal(
                conn=c,
                ids=list(all_pf_ids),
                bypass_cache=bypass_cache,
            )

        # 8. Derive parameter_ids, field_ids from parameter_fields
        parameter_ids_set: set = set()
        field_ids_set: set = set()
        field_parameter_map: dict = {}
        for pf in parameter_fields:
            if pf.parameter_id:
                parameter_ids_set.add(pf.parameter_id)
            if pf.field_id:
                field_ids_set.add(pf.field_id)
                if pf.parameter_id:
                    field_parameter_map[pf.field_id] = pf.parameter_id

        # 9. Batch 3: Hydrate parameters and fields
        async def _get_parameters():
            async with pool.acquire() as c:
                return await get_parameters_internal(
                    conn=c, ids=list(parameter_ids_set), bypass_cache=bypass_cache
                )

        async def _get_fields():
            async with pool.acquire() as c:
                return await get_fields_internal(
                    conn=c, ids=list(field_ids_set), bypass_cache=bypass_cache
                )

        parameters, fields_list = await asyncio.gather(
            _get_parameters(),
            _get_fields(),
        )

        # 10. Build name maps
        simulation_name_map = {
            str(s.simulation_id): s.name
            for s in simulations
            if s.simulation_id and s.name
        }
        scenario_name_map = {
            str(s.scenario_id): s.name
            for s in scenarios_list
            if s.scenario_id and s.name
        }

        # 11. Compute footer metrics
        footer_metrics = compute_footer_metrics_v2(
            scenario_facts_items=chat_items,
            scenarios=scenarios_list,
            personas=personas,
            documents=documents,
            parameter_fields=parameter_fields,
            parameters=parameters,
            fields=fields_list,
            simulation_name_map=simulation_name_map,
            scenario_name_map=scenario_name_map,
            thresholds=thresholds.as_dict(),
        )

        # 12. Apply picker filters (valid_*_ids stay intact for picker options)
        if request.scenario_perf_parameter_ids:
            filter_set = {str(pid) for pid in request.scenario_perf_parameter_ids}
            footer_metrics.scenario_performance.attribute_attempt_facts = [
                f
                for f in footer_metrics.scenario_performance.attribute_attempt_facts
                if f.parameter_id in filter_set
            ]
            footer_metrics.scenario_performance.attribute_scenario_facts = [
                f
                for f in footer_metrics.scenario_performance.attribute_scenario_facts
                if f.parameter_id in filter_set
            ]
        if request.scenario_stats_parameter_ids:
            filter_set = {str(pid) for pid in request.scenario_stats_parameter_ids}
            footer_metrics.scenario_stats.numeric_attempt_facts = [
                f
                for f in footer_metrics.scenario_stats.numeric_attempt_facts
                if f.parameter_id in filter_set
            ]
            footer_metrics.scenario_stats.numeric_scenario_facts = [
                f
                for f in footer_metrics.scenario_stats.numeric_scenario_facts
                if f.parameter_id in filter_set
            ]
        if request.sim_perf_simulation_ids:
            filter_set = {str(sid) for sid in request.sim_perf_simulation_ids}
            footer_metrics.simulation_performance.scenario_facts = [
                f
                for f in footer_metrics.simulation_performance.scenario_facts
                if f.simulation_id in filter_set
            ]

        # 13. Build metadata
        simulations_meta = build_simulation_meta(simulations)
        parameters_meta = build_parameter_meta(parameters)
        fields_meta = build_field_meta(
            fields_list,
            field_parameter_map,
            parameters,
        )

        # 14. Apply search filters to metadata lists
        if request.sim_perf_simulation_search:
            q = request.sim_perf_simulation_search.lower()
            simulations_meta = [
                s for s in simulations_meta if q in (s.get("name") or "").lower()
            ]
        if request.scenario_perf_param_search or request.scenario_stats_param_search:
            q = (
                request.scenario_perf_param_search
                or request.scenario_stats_param_search
                or ""
            ).lower()
            parameters_meta = [
                p for p in parameters_meta if q in (p.get("name") or "").lower()
            ]

        result = DashboardFooterResponse(
            footer_metrics=footer_metrics,
            simulations=simulations_meta,
            parameters=parameters_meta,
            fields=fields_meta,
            thresholds=thresholds.as_dict(),
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)
        return result

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="artifacts_dashboard_footer",
            request=http_request,
        )
