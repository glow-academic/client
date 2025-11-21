"""Reports export endpoint - v3 API following DHH principles."""

import csv
import io
import json
import logging
import zipfile
from datetime import datetime
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.main import get_db
from app.utils.analytics_query_builder import \
    build_profile_and_analytics_filters
from app.utils.error.handle_route_error import handle_route_error
from app.utils.schema import SimulationFilter
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(tags=["reports"])


# Inline filter schemas
class ReportsExportFilters(BaseModel):
    """Reports export filter request schema."""

    startDate: str
    endDate: str
    cohortIds: list[str] | None = None
    roles: list[str] | None = None
    simulationFilters: list[SimulationFilter] | None = None
    profileId: str | None = None
    departmentIds: list[str] | None = None
    # Pagination, search, sorting, and additional filters
    page: int | None = None
    pageSize: int | None = None
    search: str | None = None  # Text search across profile names
    sortBy: str | None = None  # Column to sort by (e.g., "averageScore", "profileName")
    sortOrder: str | None = None  # "asc" or "desc"
    profileIds: list[str] | None = None  # Filter by specific profiles
    simulationIds: list[str] | None = None  # Filter by specific simulations
    scenarioIds: list[str] | None = None  # Filter by specific scenarios


# Inline request/response schemas
class ExportRequest(BaseModel):
    """Request to export reports data."""

    filters: ReportsExportFilters
    profileIds: list[str] | None = None
    simulationIds: list[str] | None = None
    scenarioIds: list[str] | None = None
    metrics: list[str] | None = None
    brightspaceFormat: bool = False


async def _get_per_simulation_metrics(
    conn: asyncpg.Connection,
    profile_where: str,
    analytics_where: str,
    base_params: list[Any],
    profile_ids: list[str] | None,
    simulation_ids: list[str] | None,
    scenario_ids: list[str] | None,
) -> dict[str, dict[str, dict[str, float]]]:
    """
    Get per-simulation metrics for each profile.
    Returns dict: {profile_id: {simulation_id: {metric_name: value}}}
    """
    # Build additional filters
    param_counter = len(base_params) + 1
    additional_filters = []
    params = list(base_params)

    if profile_ids and len(profile_ids) > 0:
        additional_filters.append(f"a.profile_id = ANY(${param_counter}::uuid[])")
        params.append(profile_ids)
        param_counter += 1

    if simulation_ids and len(simulation_ids) > 0:
        additional_filters.append(f"a.simulation_id = ANY(${param_counter}::uuid[])")
        params.append(simulation_ids)
        param_counter += 1

    if scenario_ids and len(scenario_ids) > 0:
        additional_filters.append(f"a.scenario_id = ANY(${param_counter}::uuid[])")
        params.append(scenario_ids)
        param_counter += 1

    additional_where = ""
    if additional_filters:
        additional_where = " AND " + " AND ".join(additional_filters)

    # Query per-simulation metrics
    sim_metrics_query = f"""
        WITH filt AS (
            SELECT a.* FROM analytics a
            WHERE {analytics_where}
              AND a.profile_id IN (
                  SELECT p.id FROM profiles p WHERE {profile_where}
              )
              {additional_where}
        ),
        simulation_metrics_per_profile AS (
            SELECT
                f.profile_id,
                f.simulation_id,
                AVG(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL) AS avg_score,
                MAX(f.grade_percent) FILTER (WHERE f.grade_percent IS NOT NULL) AS highest_score,
                (100.0 * AVG((f.completed)::int))::float AS completion_pct,
                COUNT(f.attempt_id)::int AS total_attempts,
                AVG(f.num_messages_total) AS avg_messages,
                AVG(f.time_taken_seconds / 60.0) AS avg_time_minutes
            FROM filt f
            WHERE f.simulation_id IS NOT NULL
            GROUP BY f.profile_id, f.simulation_id
        ),
        earliest_attempts_all_time AS (
            SELECT DISTINCT ON (a.profile_id, a.simulation_id)
                a.profile_id,
                a.simulation_id,
                a.attempt_created_at,
                a.grade_percent,
                a.rubric_pass_points,
                a.rubric_points
            FROM analytics a
            WHERE a.profile_id IN (SELECT p.id FROM profiles p WHERE {profile_where})
            ORDER BY a.profile_id, a.simulation_id, a.attempt_created_at
        ),
        filt_date_range AS (
            SELECT 
                MIN(attempt_created_at) AS min_date,
                MAX(attempt_created_at) AS max_date
            FROM filt
            WHERE attempt_created_at IS NOT NULL
        ),
        first_attempts_per_sim AS (
            SELECT
                ea.profile_id,
                ea.simulation_id,
                ea.grade_percent >= (ea.rubric_pass_points * 100.0 / NULLIF(ea.rubric_points, 0)) AS passed
            FROM earliest_attempts_all_time ea
            CROSS JOIN filt_date_range fdr
            WHERE EXISTS (SELECT 1 FROM filt f WHERE f.profile_id = ea.profile_id AND f.simulation_id = ea.simulation_id)
              AND fdr.min_date IS NOT NULL
              AND ea.attempt_created_at >= fdr.min_date
              AND ea.attempt_created_at <= fdr.max_date
        ),
        first_attempt_per_sim_profile AS (
            SELECT
                profile_id,
                simulation_id,
                (100.0 * COUNT(*) FILTER (WHERE passed) / NULLIF(COUNT(*), 0))::float AS pass_rate
            FROM first_attempts_per_sim
            GROUP BY profile_id, simulation_id
        )
        SELECT jsonb_object_agg(
            sm.profile_id::text || '|' || sm.simulation_id::text,
            jsonb_build_object(
                'averageScore', COALESCE(sm.avg_score, 0),
                'highestScore', COALESCE(sm.highest_score, 0),
                'completionPercentage', COALESCE(sm.completion_pct, 0),
                'firstAttemptPassRate', COALESCE(fasp.pass_rate, 0),
                'totalAttempts', COALESCE(sm.total_attempts, 0),
                'messagesPerSession', COALESCE(sm.avg_messages, 0),
                'timeSpent', COALESCE(sm.avg_time_minutes, 0)
            )
        )
        FROM simulation_metrics_per_profile sm
        LEFT JOIN first_attempt_per_sim_profile fasp 
            ON fasp.profile_id = sm.profile_id 
            AND fasp.simulation_id = sm.simulation_id
    """

    result = await conn.fetchval(sim_metrics_query, *params)
    
    # Parse and restructure result
    per_sim_metrics: dict[str, dict[str, dict[str, float]]] = {}
    if result:
        if isinstance(result, str):
            result = json.loads(result)
        if isinstance(result, dict):
            for key, value in result.items():
                profile_id, simulation_id = key.split("|", 1)
                if profile_id not in per_sim_metrics:
                    per_sim_metrics[profile_id] = {}
                per_sim_metrics[profile_id][simulation_id] = value

    return per_sim_metrics


@router.post("/export")
async def export_reports(
    request: ExportRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> Response:
    """Export reports data as CSV or ZIP file."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Request: {request}")

    try:
        # Use the same reports_bundle.sql query that the reports view uses
        sql_template = load_sql("sql/v3/reports/reports_bundle.sql")

        # Build base filters (same as reports bundle)
        profile_where, analytics_where, params = build_profile_and_analytics_filters(
            start_date=request.filters.startDate,
            end_date=request.filters.endDate,
            cohort_ids=request.filters.cohortIds,
            roles=request.filters.roles,
            sim_filters=[f.value for f in request.filters.simulationFilters]
            if request.filters.simulationFilters
            else None,
            profile_id=request.filters.profileId,
            department_ids=request.filters.departmentIds,
        )

        # Replace WHERE clause placeholders in SQL template
        sql_query = sql_template.replace("{PROFILE_WHERE_CLAUSE}", profile_where)
        sql_query = sql_query.replace("{ANALYTICS_WHERE_CLAUSE}", analytics_where)
        sql_params = tuple(params)

        # Execute reports bundle query
        result = await conn.fetchval(sql_query, *sql_params)

        # Parse JSON result
        parsed_result = result or {}
        if isinstance(parsed_result, str):
            parsed_result = json.loads(parsed_result)
        if not isinstance(parsed_result, dict):
            parsed_result = {}

        # Extract data and mappings from bundle result
        bundle_data = parsed_result.get("data", []) or []
        simulation_mapping_data = parsed_result.get("simulation_mapping", {}) or {}
        
        # Parse simulation mapping
        simulation_mapping: dict[str, dict[str, str]] = {}
        if isinstance(simulation_mapping_data, str):
            simulation_mapping_data = json.loads(simulation_mapping_data)
        if isinstance(simulation_mapping_data, dict):
            for sim_id, sim_data in simulation_mapping_data.items():
                if isinstance(sim_data, dict):
                    simulation_mapping[sim_id] = {
                        "name": sim_data.get("name", ""),
                        "description": sim_data.get("description", ""),
                    }
        
        # Filter simulation mapping to only include selected simulations (if provided)
        if request.simulationIds and len(request.simulationIds) > 0:
            simulation_mapping = {
                sim_id: sim_data
                for sim_id, sim_data in simulation_mapping.items()
                if sim_id in request.simulationIds
            }

        # Apply post-query filters (profileIds, simulationIds, scenarioIds)
        filtered_data = bundle_data
        if request.profileIds and len(request.profileIds) > 0:
            filtered_data = [
                p for p in filtered_data
                if p.get("profileId") in request.profileIds
            ]
        if request.simulationIds and len(request.simulationIds) > 0:
            filtered_data = [
                p for p in filtered_data
                if any(sid in request.simulationIds for sid in p.get("simulationIds", []))
            ]
        if request.scenarioIds and len(request.scenarioIds) > 0:
            filtered_data = [
                p for p in filtered_data
                if any(sid in request.scenarioIds for sid in p.get("scenarioIds", []))
            ]

        if len(filtered_data) == 0:
            raise HTTPException(
                status_code=404, detail="No data found matching the filters"
            )

        # Get per-simulation metrics for Brightspace export
        per_simulation_metrics: dict[str, dict[str, dict[str, float]]] = {}
        if request.brightspaceFormat:
            logger.info(
                f"Fetching per-simulation metrics for export: "
                f"profileIds={len(request.profileIds) if request.profileIds else 0}, "
                f"simulationIds={len(request.simulationIds) if request.simulationIds else 0}, "
                f"scenarioIds={len(request.scenarioIds) if request.scenarioIds else 0}"
            )
            per_simulation_metrics = await _get_per_simulation_metrics(
                conn=conn,
                profile_where=profile_where,
                analytics_where=analytics_where,
                base_params=list(params),
                profile_ids=request.profileIds,
                simulation_ids=request.simulationIds,
                scenario_ids=request.scenarioIds,
            )
            logger.info(
                f"Retrieved per-simulation metrics for {len(per_simulation_metrics)} profiles"
            )

        # Transform bundle data to export format
        export_data = []
        for profile in filtered_data:
            # Extract metrics from MetricResponse objects
            metrics = profile.get("metrics", {}) or {}
            export_metrics = {}
            for metric_key, metric_response in metrics.items():
                if isinstance(metric_response, dict):
                    current_value = metric_response.get("currentValue", 0)
                    # Format value based on metric type
                    if metric_key in ["averageScore", "highestScore", "completionPercentage", 
                                     "firstAttemptPassRate", "sessionEfficiency", "stagnationRate"]:
                        formatted_value = f"{int(round(current_value))}%"
                    elif metric_key == "personaResponseTimes":
                        formatted_value = f"{int(round(current_value))}s"
                    elif metric_key == "timeSpent":
                        formatted_value = f"{int(round(current_value))}m"
                    else:
                        formatted_value = str(int(round(current_value)))
                    
                    export_metrics[metric_key] = {
                        "value": current_value,
                        "formattedValue": formatted_value,
                    }

            export_profile = {
                "profileId": profile.get("profileId", ""),
                "firstName": profile.get("firstName", ""),
                "lastName": profile.get("lastName", ""),
                "alias": profile.get("alias") or "",
                "role": profile.get("role", ""),
                "metrics": export_metrics,
                "simulationMetrics": per_simulation_metrics.get(profile.get("profileId", ""), {}),
            }
            export_data.append(export_profile)

        # Generate export files
        if not request.metrics or len(request.metrics) == 0:
            raise HTTPException(
                status_code=400,
                detail="At least one metric is required for export",
            )

        if request.brightspaceFormat:
            # Generate CSV(s) for Brightspace format
            # If only one metric, return single CSV; otherwise ZIP with multiple CSVs
            if len(request.metrics) == 1:
                # Single metric - return CSV directly
                metric = request.metrics[0]
                csv_data = generate_brightspace_csv(
                    export_data, metric, simulation_mapping
                )
                csv_filename = f"{metric}_export_{datetime.now().strftime('%Y-%m-%d')}.csv"

                return Response(
                    content=csv_data.encode("utf-8"),
                    media_type="text/csv",
                    headers={
                        "Content-Disposition": f'attachment; filename="{csv_filename}"',
                        "Cache-Control": "no-cache, no-store, must-revalidate",
                        "Pragma": "no-cache",
                        "Expires": "0",
                    },
                )
            else:
                # Multiple metrics - create ZIP file
                zip_buffer = io.BytesIO()
                with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
                    for metric in request.metrics:
                        csv_data = generate_brightspace_csv(
                            export_data, metric, simulation_mapping
                        )
                        filename = f"{metric}_export_{datetime.now().strftime('%Y-%m-%d')}.csv"
                        zip_file.writestr(filename, csv_data)

                zip_buffer.seek(0)
                zip_filename = f"reports_export_{datetime.now().strftime('%Y-%m-%d')}.zip"

                return Response(
                    content=zip_buffer.read(),
                    media_type="application/zip",
                    headers={
                        "Content-Disposition": f'attachment; filename="{zip_filename}"',
                        "Cache-Control": "no-cache, no-store, must-revalidate",
                        "Pragma": "no-cache",
                        "Expires": "0",
                    },
                )
        else:
            # Generate single CSV with selected metrics
            csv_data = generate_regular_csv(export_data, request.metrics)
            csv_filename = f"reports_export_{datetime.now().strftime('%Y-%m-%d')}.csv"

            return Response(
                content=csv_data.encode("utf-8"),
                media_type="text/csv",
                headers={
                    "Content-Disposition": f'attachment; filename="{csv_filename}"',
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                    "Pragma": "no-cache",
                    "Expires": "0",
                },
            )

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="export_reports",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


def generate_brightspace_csv(
    data: list[dict[str, Any]], metric: str, simulation_mapping: dict[str, dict[str, str]]
) -> str:
    """Generate Brightspace format CSV for a specific metric."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Get all simulation IDs from mapping, sorted by name
    simulation_ids = sorted(
        simulation_mapping.keys(),
        key=lambda sid: simulation_mapping[sid].get("name", ""),
    )

    # Create header row
    header = ["Username"]
    for sim_id in simulation_ids:
        sim_name = simulation_mapping[sim_id].get("name", f"Simulation {sim_id}")
        header.append(f"{sim_name} Points Grade <Numeric MaxPoints:100>")
    header.append("End-of-Line Indicator")
    writer.writerow(header)

    # Create data rows
    for profile in data:
        alias = profile.get("alias") or ""
        row = [alias]

        # Get simulation metrics for this profile
        sim_metrics = profile.get("simulationMetrics", {}) or {}

        for sim_id in simulation_ids:
            # Check if profile has attempted this simulation
            if sim_id not in sim_metrics:
                formatted_value = "0%"
            else:
                sim_data = sim_metrics.get(sim_id, {})
                # Get the metric value directly from sim_data
                value = sim_data.get(metric, 0)
                
                # Format based on metric type
                if metric in ["averageScore", "highestScore", "completionPercentage", "firstAttemptPassRate", "sessionEfficiency", "stagnationRate"]:
                    formatted_value = f"{int(round(value))}%"
                elif metric == "personaResponseTimes":
                    formatted_value = f"{int(round(value))}s"
                elif metric == "timeSpent":
                    formatted_value = f"{int(round(value))}m"
                else:
                    formatted_value = str(int(round(value)))

            row.append(formatted_value)

        row.append("#")
        writer.writerow(row)

    return output.getvalue()


def generate_regular_csv(
    data: list[dict[str, Any]], metrics: list[str]
) -> str:
    """Generate regular CSV with selected metrics."""
    output = io.StringIO()
    writer = csv.writer(output)

    # Map metric IDs to display names
    metric_names = {
        "averageScore": "Avg Score",
        "highestScore": "Highest",
        "completionPercentage": "Completion",
        "firstAttemptPassRate": "First Pass",
        "messagesPerSession": "Msgs/Sess",
        "personaResponseTimes": "Response Time",
        "sessionEfficiency": "Efficiency",
        "stagnationRate": "Stagnation",
        "timeSpent": "Time Spent",
        "totalAttempts": "Attempts",
    }

    # Create header row: Name, Alias, then selected metrics
    header = ["Name", "Alias"] + [metric_names.get(m, m) for m in metrics]
    writer.writerow(header)

    # Create data rows
    for profile in data:
        row = []
        metrics_data = profile.get("metrics", {}) or {}

        # Add name and alias
        first_name = profile.get("firstName", "")
        last_name = profile.get("lastName", "")
        row.append(f"{first_name} {last_name}".strip())
        row.append(profile.get("alias") or "")

        # Add selected metrics
        for metric in metrics:
            metric_data = metrics_data.get(metric, {}) or {}
            formatted_value = metric_data.get("formattedValue", "")
            row.append(formatted_value)

        writer.writerow(row)

    return output.getvalue()

