"""Pricing service layer - business logic for pricing analytics operations."""

import json
from typing import Any

import asyncpg  # type: ignore
from app.cache import keys
from app.queries.pricing_queries import PricingQueries
from app.schemas.analytics import AnalyticsFilters
from app.schemas.pricing import (DebugInfoItem, ModelMappingWithPricing,
                                 ModelRunItem, PricingAnalyticsResponse)
from app.services.base import AnalyticsQueryBuilder, BaseService, with_cache


class PricingService(BaseService):
    """Service layer for pricing analytics operations."""

    def __init__(self, conn: asyncpg.Connection) -> None:
        """Initialize service with database session."""
        super().__init__(conn)
        self.queries = PricingQueries()
        self.query_builder = AnalyticsQueryBuilder()

    def _parse_json_strings_recursive(self, obj: Any) -> Any:
        """Recursively parse JSON strings in nested structures.

        This handles cases where PostgreSQL json_agg returns JSON strings
        instead of parsed objects, particularly for trendData and dataPoints fields.
        """
        if isinstance(obj, str):
            # Try to parse as JSON
            try:
                return json.loads(obj)
            except (json.JSONDecodeError, ValueError):
                return obj
        elif isinstance(obj, dict):
            # Recursively process dictionary values
            return {k: self._parse_json_strings_recursive(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            # Recursively process list items
            return [self._parse_json_strings_recursive(item) for item in obj]
        else:
            return obj

    @with_cache(lambda self, filters: keys.analytics_pricing_analytics(filters))
    async def get_pricing_analytics(
        self, filters: AnalyticsFilters
    ) -> PricingAnalyticsResponse:
        """Get pricing analytics for model runs."""

        # Determine effective profile ID based on role
        # Admins, superadmins, and instructional staff see all data (no profile filter)
        effective_profile_id = None
        if filters.profileId:
            # Fetch profile role to determine if we should use profileId
            query, params = self.query_builder.get_profile_role(filters.profileId)
            role_row = await self.conn.fetchrow(query, *params)
            if role_row:
                role = role_row["role"]
                # Only use profileId for non-admin roles (ta, guest, etc.)
                if role not in ("admin", "superadmin", "instructional"):
                    effective_profile_id = filters.profileId

        # Get complete pricing analytics with all mappings in single query
        query, params = self.queries.get_pricing_analytics_complete(
            department_ids=filters.departmentIds or [],
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=effective_profile_id,
        )

        result = await self.conn.fetchval(query, *params)

        # Parse JSONB result
        parsed_result = self._parse_json_strings_recursive(result or {})

        # Build model runs list
        model_runs = []
        for run_data in parsed_result.get("model_runs", []):
            debug_info = []
            if isinstance(run_data.get("debug_info"), list):
                for debug in run_data["debug_info"]:
                    if isinstance(debug, dict):
                        debug_info.append(
                            DebugInfoItem(
                                id=debug["id"],
                                created_at=debug["created_at"],
                                content=debug["content"],
                            )
                        )

            model_runs.append(
                ModelRunItem(
                    model_run_id=run_data["model_run_id"],
                    created_at=run_data["created_at"],
                    input_tokens=run_data["input_tokens"],
                    output_tokens=run_data["output_tokens"],
                    model_id=run_data.get("model_id"),
                    profile_id=run_data.get("profile_id"),
                    agent_id=run_data.get("agent_id"),
                    persona_id=run_data.get("persona_id"),
                    debug_info=debug_info,
                )
            )

        # Build model mapping
        model_mapping: dict[str, ModelMappingWithPricing] = {}
        if isinstance(parsed_result.get("model_mapping"), dict):
            for model_id, model_data in parsed_result["model_mapping"].items():
                if isinstance(model_data, dict):
                    model_mapping[model_id] = ModelMappingWithPricing(
                        name=model_data["name"],
                        description=model_data["description"],
                        input_ppm=model_data["input_ppm"],
                        output_ppm=model_data["output_ppm"],
                    )

        # Build profile mapping
        profile_mapping: dict[str, str] = {}
        if isinstance(parsed_result.get("profile_mapping"), dict):
            for profile_id, name in parsed_result["profile_mapping"].items():
                if isinstance(name, str):
                    profile_mapping[profile_id] = name

        # Build agent mapping
        agent_mapping: dict[str, str] = {}
        if isinstance(parsed_result.get("agent_mapping"), dict):
            for agent_id, name in parsed_result["agent_mapping"].items():
                if isinstance(name, str):
                    agent_mapping[agent_id] = name

        # Build persona mapping
        persona_mapping: dict[str, str] = {}
        if isinstance(parsed_result.get("persona_mapping"), dict):
            for persona_id, name in parsed_result["persona_mapping"].items():
                if isinstance(name, str):
                    persona_mapping[persona_id] = name

        return PricingAnalyticsResponse(
            model_runs=model_runs,
            model_mapping=model_mapping,
            profile_mapping=profile_mapping,
            agent_mapping=agent_mapping,
            persona_mapping=persona_mapping,
        )
