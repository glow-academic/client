"""Reports export endpoint - v4 API following DHH principles."""

import csv
import io
import zipfile
from datetime import datetime
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetPerSimulationMetricsSqlParams,
    GetPerSimulationMetricsSqlRow,
    GetReportsBundleApiRequest,
    GetReportsBundleApiResponse,
    GetReportsBundleSqlParams,
    GetReportsBundleSqlRow,
    load_sql_query,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

router = APIRouter(tags=["reports"])

BUNDLE_SQL_PATH = "app/sql/v4/queries/reports/get_reports_bundle_complete.sql"
PER_SIM_METRICS_SQL_PATH = (
    "app/sql/v4/queries/reports/get_per_simulation_metrics_complete.sql"
)


# Export request extends auto-generated bundle request with export-specific fields
class ExportRequest(GetReportsBundleApiRequest):
    """Export request - extends GetReportsBundleApiRequest with export-specific options."""

    metrics: list[str] | None = None
    brightspace_format: bool = False


async def _get_per_simulation_metrics(
    conn: asyncpg.Connection,
    bundle_request: GetReportsBundleApiRequest,
    profile_id: UUID,
    profile_ids: list[UUID] | None,
    simulation_ids: list[UUID] | None,
    scenario_ids: list[UUID] | None,
) -> dict[str, dict[str, dict[str, float]]]:
    """
    Get per-simulation metrics for each profile.
    Returns dict: {profile_id: {simulation_id: {metric_name: value}}}
    """
    # Use auto-generated types directly - no manual conversion needed
    params = GetPerSimulationMetricsSqlParams(
        start_date=bundle_request.start_date,
        end_date=bundle_request.end_date,
        profile_id=profile_id,
        cohort_ids=bundle_request.cohort_ids or [],
        department_ids=bundle_request.department_ids or [],
        roles=bundle_request.roles or [],
        simulation_filters=bundle_request.simulation_filters or ["general"],
        profile_ids=profile_ids or [],
        simulation_ids=simulation_ids or [],
        scenario_ids=scenario_ids or [],
    )
    # SQL handles date conversion from text to timestamptz - no manual parsing needed

    async with conn.transaction():
        await conn.execute("SET LOCAL jit = off;")
        result = cast(
            GetPerSimulationMetricsSqlRow,
            await execute_sql_typed(
                conn,
                PER_SIM_METRICS_SQL_PATH,
                params=params,
            ),
        )

    # Convert array of composite types to nested dict structure
    per_sim_metrics: dict[str, dict[str, dict[str, float]]] = {}
    for metric in result.metrics:
        profile_id_str = str(metric.profile_id)
        simulation_id_str = str(metric.simulation_id)

        if profile_id_str not in per_sim_metrics:
            per_sim_metrics[profile_id_str] = {}

        per_sim_metrics[profile_id_str][simulation_id_str] = {
            "averageScore": metric.average_score,
            "highestScore": metric.highest_score,
            "completionPercentage": metric.completion_percentage,
            "firstAttemptPassRate": metric.first_attempt_pass_rate,
            "totalAttempts": float(metric.total_attempts),
            "messagesPerSession": metric.messages_per_session,
            "timeSpent": metric.time_spent,
        }

    return per_sim_metrics


@router.post(
    "/report",
    dependencies=[
        audit_activity("reports.exported", "{{ actor.name }} exported reports")
    ],
)
async def export_report(
    request: ExportRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> Response:
    """Export reports data as CSV or ZIP file."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None
    logger.info(f"Request: {request}")

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Use bundle request (inherits from GetReportsBundleApiRequest)
        bundle_request = GetReportsBundleApiRequest(
            **request.model_dump(exclude={"metrics", "brightspace_format"})
        )

        sql_query = load_sql_query(BUNDLE_SQL_PATH)
        params = GetReportsBundleSqlParams(
            **bundle_request.model_dump(), profile_id=profile_id
        )
        # SQL handles date conversion from text to timestamptz - no manual parsing needed
        sql_params = params.to_tuple()

        # Execute reports bundle query
        async with conn.transaction():
            await conn.execute("SET LOCAL jit = off;")
            bundle_result = cast(
                GetReportsBundleSqlRow,
                await execute_sql_typed(
                    conn,
                    BUNDLE_SQL_PATH,
                    params=params,
                ),
            )

        # Set audit context
        if bundle_result.actor_name:
            audit_set(
                http_request, actor={"name": bundle_result.actor_name, "id": profile_id}
            )

        # Convert bundle result to API response
        bundle_response = GetReportsBundleApiResponse.model_validate(
            bundle_result.model_dump()
        )

        # Extract data and simulations from bundle result (arrays, not dicts)
        bundle_data = bundle_response.data or []
        simulations_array = bundle_response.simulations or []

        # Build simulation mapping from array (for CSV export)
        # Filter by requested simulation_ids if provided
        simulation_mapping: dict[str, dict[str, str]] = {}
        simulation_ids_filter = set(request.simulation_ids or [])
        for sim in simulations_array:
            sim_id_str = str(sim.simulation_id)
            if simulation_ids_filter and sim_id_str not in simulation_ids_filter:
                continue
            simulation_mapping[sim_id_str] = {
                "name": sim.name or "",
                "description": sim.description or "",
            }

        # Apply post-query filters (profile_ids, simulation_ids, scenario_ids from request)
        # Convert UUIDs for comparison
        filtered_data = bundle_data
        if request.profile_ids and len(request.profile_ids) > 0:
            filtered_data = [
                p for p in filtered_data if p.profile_id in request.profile_ids
            ]
        if request.simulation_ids and len(request.simulation_ids) > 0:
            filtered_data = [
                p
                for p in filtered_data
                if any(
                    sid in request.simulation_ids for sid in (p.simulation_ids or [])
                )
            ]
        if request.scenario_ids and len(request.scenario_ids) > 0:
            filtered_data = [
                p
                for p in filtered_data
                if any(sid in request.scenario_ids for sid in (p.scenario_ids or []))
            ]

        if len(filtered_data) == 0:
            raise HTTPException(
                status_code=404, detail="No data found matching the filters"
            )

        # Get per-simulation metrics for Brightspace export
        per_simulation_metrics: dict[str, dict[str, dict[str, float]]] = {}
        if request.brightspace_format:
            logger.info(
                f"Fetching per-simulation metrics for export: "
                f"profile_ids={len(request.profile_ids) if request.profile_ids else 0}, "
                f"simulation_ids={len(request.simulation_ids) if request.simulation_ids else 0}, "
                f"scenario_ids={len(request.scenario_ids) if request.scenario_ids else 0}"
            )

            per_simulation_metrics = await _get_per_simulation_metrics(
                conn=conn,
                bundle_request=bundle_request,
                profile_id=profile_id,
                profile_ids=request.profile_ids if request.profile_ids else None,
                simulation_ids=request.simulation_ids
                if request.simulation_ids
                else None,
                scenario_ids=request.scenario_ids if request.scenario_ids else None,
            )
            logger.info(
                f"Retrieved per-simulation metrics for {len(per_simulation_metrics)} profiles"
            )

        # Transform bundle data to export format
        export_data = []
        for profile in filtered_data:
            # Extract metrics from composite types
            metrics_obj = profile.metrics
            export_metrics = {}

            # Map metric keys to their values
            metric_map = {
                "averageScore": metrics_obj.average_score.current_value
                if metrics_obj.average_score
                else 0,
                "highestScore": metrics_obj.highest_score.current_value
                if metrics_obj.highest_score
                else 0,
                "completionPercentage": metrics_obj.completion_percentage.current_value
                if metrics_obj.completion_percentage
                else 0,
                "firstAttemptPassRate": metrics_obj.first_attempt_pass_rate.current_value
                if metrics_obj.first_attempt_pass_rate
                else 0,
                "messagesPerSession": metrics_obj.messages_per_session.current_value
                if metrics_obj.messages_per_session
                else 0,
                "personaResponseTimes": metrics_obj.persona_response_times.current_value
                if metrics_obj.persona_response_times
                else 0,
                "sessionEfficiency": metrics_obj.session_efficiency.current_value
                if metrics_obj.session_efficiency
                else 0,
                "stagnationRate": metrics_obj.stagnation_rate.current_value
                if metrics_obj.stagnation_rate
                else 0,
                "timeSpent": metrics_obj.time_spent.current_value
                if metrics_obj.time_spent
                else 0,
                "totalAttempts": metrics_obj.total_attempts.current_value
                if metrics_obj.total_attempts
                else 0,
            }

            for metric_key, current_value in metric_map.items():
                # Format value based on metric type
                if metric_key in [
                    "averageScore",
                    "highestScore",
                    "completionPercentage",
                    "firstAttemptPassRate",
                    "sessionEfficiency",
                    "stagnationRate",
                ]:
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
                "profileId": str(profile.profile_id),
                "name": profile.name or "",
                "email": profile.primary_email or "",
                "role": profile.role or "",
                "metrics": export_metrics,
                "simulationMetrics": per_simulation_metrics.get(
                    str(profile.profile_id), {}
                ),
            }
            export_data.append(export_profile)

        # Generate export files
        if not request.metrics or len(request.metrics) == 0:
            raise HTTPException(
                status_code=400,
                detail="At least one metric is required for export",
            )

        if request.brightspace_format:
            # Generate CSV(s) for Brightspace format
            # If only one metric, return single CSV; otherwise ZIP with multiple CSVs
            if len(request.metrics) == 1:
                # Single metric - return CSV directly
                metric = request.metrics[0]
                csv_data = generate_brightspace_csv(
                    export_data, metric, simulation_mapping
                )
                csv_filename = (
                    f"{metric}_export_{datetime.now().strftime('%Y-%m-%d')}.csv"
                )

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
                        filename = (
                            f"{metric}_export_{datetime.now().strftime('%Y-%m-%d')}.csv"
                        )
                        zip_file.writestr(filename, csv_data)

                zip_buffer.seek(0)
                zip_filename = (
                    f"reports_export_{datetime.now().strftime('%Y-%m-%d')}.zip"
                )

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

            # Audit context already set above

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
            operation="export_report",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


def generate_brightspace_csv(
    data: list[dict[str, Any]],
    metric: str,
    simulation_mapping: dict[str, dict[str, str]],
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
        email = profile.get("email") or ""
        row = [email]

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
                if metric in [
                    "averageScore",
                    "highestScore",
                    "completionPercentage",
                    "firstAttemptPassRate",
                    "sessionEfficiency",
                    "stagnationRate",
                ]:
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


def generate_regular_csv(data: list[dict[str, Any]], metrics: list[str]) -> str:
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

        # Add name and email
        row.append(profile.get("name", ""))
        row.append(profile.get("email") or "")

        # Add selected metrics
        for metric in metrics:
            metric_data = metrics_data.get(metric, {}) or {}
            formatted_value = metric_data.get("formattedValue", "")
            row.append(formatted_value)

        writer.writerow(row)

    return output.getvalue()
