"""Pricing analytics queries - SQL query builders for model run pricing."""

from datetime import datetime
from typing import Any


class PricingQueries:
    """Query builders for pricing analytics."""

    def get_pricing_analytics_complete(
        self,
        department_ids: list[str],
        start_date: str,
        end_date: str,
        cohort_ids: list[str] | None = None,
        roles: list[str] | None = None,
        sim_filters: list[str] | None = None,
        profile_id: str | None = None,
    ) -> tuple[str, list[Any]]:
        """Build complete pricing analytics query with all mappings embedded."""

        # Build WHERE clause conditions
        where_conditions = [
            "mr.department_id = ANY($1)",
            "mr.created_at >= $2",
            "mr.created_at <= $3",
        ]

        params: list[Any] = [
            department_ids,
            datetime.fromisoformat(start_date.replace("Z", "+00:00")),
            datetime.fromisoformat(end_date.replace("Z", "+00:00")),
        ]

        # Profile filter (specific user)
        if profile_id is not None:
            param_idx = len(params) + 1
            where_conditions.append(f"mrp.profile_id = ${param_idx}")
            params.append(profile_id)

        # Role filter (only if no profile_id specified)
        if profile_id is None and roles is not None and len(roles) > 0:
            param_idx = len(params) + 1
            where_conditions.append(
                f"""mrp.profile_id IN (
                    SELECT id FROM profiles WHERE role = ANY(${param_idx})
                )"""
            )
            params.append(roles)

        # Cohort filter via cohort_profiles
        if cohort_ids is not None and len(cohort_ids) > 0:
            param_idx = len(params) + 1
            where_conditions.append(
                f"""mrp.profile_id IN (
                    SELECT profile_id FROM cohort_profiles
                    WHERE cohort_id = ANY(${param_idx}) AND active = true
                )"""
            )
            params.append(cohort_ids)

        # Simulation filters (general, practice, archived) - not implemented yet
        # Would need to join to simulations/attempts if we want to filter by simulation type
        # For now, this is a placeholder to match other analytics endpoints
        if sim_filters is not None and len(sim_filters) > 0:
            # Note: This would require additional joins to filter by simulation type
            # Leaving as-is for now to match analytics pattern
            pass

        where_clause = " AND ".join(where_conditions)

        query = f"""
        WITH model_runs_base AS (
            SELECT
                mr.id as model_run_id,
                mr.created_at,
                mr.input_tokens,
                mr.output_tokens,
                mrm.model_id,
                mrp.profile_id,
                mra.agent_id,
                mrper.persona_id
            FROM model_runs mr
            LEFT JOIN model_run_models mrm ON mrm.model_run_id = mr.id AND mrm.active = true
            LEFT JOIN model_run_profiles mrp ON mrp.model_run_id = mr.id AND mrp.active = true
            LEFT JOIN model_run_agents mra ON mra.model_run_id = mr.id AND mra.active = true
            LEFT JOIN model_run_personas mrper ON mrper.model_run_id = mr.id AND mrper.active = true
            WHERE {where_clause}
        ),
        model_runs_with_debug AS (
            SELECT
                mrb.*,
                COALESCE(
                    (SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', di.id::text,
                            'created_at', di.created_at,
                            'content', di.content
                        ) ORDER BY di.created_at
                    )
                    FROM debug_info di
                    WHERE di.model_run_id = mrb.model_run_id),
                    '[]'::jsonb
                ) as debug_info
            FROM model_runs_base mrb
        ),
        model_mapping AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    m.id::text,
                    jsonb_build_object(
                        'name', m.name,
                        'description', m.description,
                        'input_ppm', m.input_ppm,
                        'output_ppm', m.output_ppm
                    )
                ),
                '{{}}'::jsonb
            ) as mapping
            FROM (SELECT DISTINCT model_id FROM model_runs_base WHERE model_id IS NOT NULL) mrb
            JOIN models m ON m.id = mrb.model_id
        ),
        profile_mapping AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    p.id::text,
                    p.first_name || ' ' || p.last_name
                ),
                '{{}}'::jsonb
            ) as mapping
            FROM (SELECT DISTINCT profile_id FROM model_runs_base WHERE profile_id IS NOT NULL) mrb
            JOIN profiles p ON p.id = mrb.profile_id
        ),
        agent_mapping AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    a.id::text,
                    a.name
                ),
                '{{}}'::jsonb
            ) as mapping
            FROM (SELECT DISTINCT agent_id FROM model_runs_base WHERE agent_id IS NOT NULL) mrb
            JOIN agents a ON a.id = mrb.agent_id
        ),
        persona_mapping AS (
            SELECT COALESCE(
                jsonb_object_agg(
                    per.id::text,
                    per.name
                ),
                '{{}}'::jsonb
            ) as mapping
            FROM (SELECT DISTINCT persona_id FROM model_runs_base WHERE persona_id IS NOT NULL) mrb
            JOIN personas per ON per.id = mrb.persona_id
        )
        SELECT jsonb_build_object(
            'model_runs', COALESCE(
                (SELECT jsonb_agg(
                    jsonb_build_object(
                        'model_run_id', model_run_id::text,
                        'created_at', created_at,
                        'input_tokens', input_tokens,
                        'output_tokens', output_tokens,
                        'model_id', CASE WHEN model_id IS NOT NULL THEN model_id::text ELSE NULL END,
                        'profile_id', CASE WHEN profile_id IS NOT NULL THEN profile_id::text ELSE NULL END,
                        'agent_id', CASE WHEN agent_id IS NOT NULL THEN agent_id::text ELSE NULL END,
                        'persona_id', CASE WHEN persona_id IS NOT NULL THEN persona_id::text ELSE NULL END,
                        'debug_info', debug_info
                    ) ORDER BY created_at DESC
                ) FROM model_runs_with_debug),
                '[]'::jsonb
            ),
            'model_mapping', (SELECT mapping FROM model_mapping),
            'profile_mapping', (SELECT mapping FROM profile_mapping),
            'agent_mapping', (SELECT mapping FROM agent_mapping),
            'persona_mapping', (SELECT mapping FROM persona_mapping)
        ) as result
        """

        return (query, params)
