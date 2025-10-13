"""Pricing analytics queries - SQL query builders for model run pricing."""

from typing import Any, Dict, List, Optional, Tuple


class PricingQueries:
    """Query builders for pricing analytics."""

    def get_model_runs(
        self,
        department_ids: List[str],
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for model runs with all relationships."""

        # Build WHERE clause conditions
        where_conditions = [
            "mr.department_id = ANY(:department_ids)",
            "mr.created_at >= :start_date::timestamp",
            "mr.created_at <= :end_date::timestamp",
        ]

        params: Dict[str, Any] = {
            "department_ids": department_ids,
            "start_date": start_date,
            "end_date": end_date,
        }

        # Cohort filter via cohort_profiles
        if cohort_ids is not None and len(cohort_ids) > 0:
            where_conditions.append(
                """mrp.profile_id IN (
                    SELECT profile_id FROM cohort_profiles 
                    WHERE cohort_id = ANY(:cohort_ids) AND active = true
                )"""
            )
            params["cohort_ids"] = cohort_ids

        # Simulation filters (general, practice, archived) - not implemented yet
        # Would need to join to simulations/attempts if we want to filter by simulation type
        # For now, this is a placeholder to match other analytics endpoints
        if sim_filters is not None and len(sim_filters) > 0:
            params["sim_filters"] = sim_filters
            # Note: This would require additional joins to filter by simulation type
            # Leaving as-is for now to match analytics pattern

        where_clause = " AND ".join(where_conditions)

        query = f"""
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
        ORDER BY mr.created_at DESC
        """

        return (query, params)

    def get_debug_info_for_runs(
        self, model_run_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to get debug info for model runs."""
        query = """
        SELECT 
            id,
            model_run_id,
            created_at,
            content
        FROM debug_info
        WHERE model_run_id = ANY(:model_run_ids)
        ORDER BY model_run_id, created_at
        """
        params = {"model_run_ids": model_run_ids}
        return (query, params)

    def get_model_mapping(self, model_ids: List[str]) -> Tuple[str, Dict[str, Any]]:
        """Build query for model mapping with pricing."""
        query = """
        SELECT 
            id,
            name,
            description,
            input_ppm,
            output_ppm
        FROM models
        WHERE id = ANY(:model_ids)
        """
        params = {"model_ids": model_ids}
        return (query, params)

    def get_profile_mapping(
        self, profile_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for profile mapping."""
        query = """
        SELECT id, first_name || ' ' || last_name as name
        FROM profiles
        WHERE id = ANY(:profile_ids)
        """
        params = {"profile_ids": profile_ids}
        return (query, params)

    def get_agent_mapping(self, agent_ids: List[str]) -> Tuple[str, Dict[str, Any]]:
        """Build query for agent mapping."""
        query = "SELECT id, name FROM agents WHERE id = ANY(:agent_ids)"
        params = {"agent_ids": agent_ids}
        return (query, params)

    def get_persona_mapping(
        self, persona_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for persona mapping."""
        query = "SELECT id, name FROM personas WHERE id = ANY(:persona_ids)"
        params = {"persona_ids": persona_ids}
        return (query, params)

