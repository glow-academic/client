"""Model run query builders for tracking model usage and tokens."""

from typing import Any, List, Tuple


class ModelRunQueries:
    """Query builders for model run operations."""

    def create_model_run(self, department_id: str) -> Tuple[str, List[Any]]:
        """
        Build query to create model run with initial token counts.

        Args:
            department_id: UUID of the department

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO model_runs (input_tokens, output_tokens, department_id)
        VALUES ($1, $2, $3)
        RETURNING id
        """
        return query, [0, 0, department_id]

    def create_model_run_model(
        self, model_run_id: str, model_id: str
    ) -> Tuple[str, List[Any]]:
        """
        Build query to link model to model run.

        Args:
            model_run_id: UUID of the model run
            model_id: UUID of the model

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO model_run_models (model_run_id, model_id, active)
        VALUES ($1, $2, $3)
        """
        return query, [model_run_id, model_id, True]

    def create_model_run_agent(
        self, model_run_id: str, agent_id: str
    ) -> Tuple[str, List[Any]]:
        """
        Build query to link agent to model run.

        Args:
            model_run_id: UUID of the model run
            agent_id: UUID of the agent

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO model_run_agents (model_run_id, agent_id, active)
        VALUES ($1, $2, $3)
        """
        return query, [model_run_id, agent_id, True]

    def create_model_run_persona(
        self, model_run_id: str, persona_id: str
    ) -> Tuple[str, List[Any]]:
        """
        Build query to link persona to model run.

        Args:
            model_run_id: UUID of the model run
            persona_id: UUID of the persona

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO model_run_personas (model_run_id, persona_id, active)
        VALUES ($1, $2, $3)
        """
        return query, [model_run_id, persona_id, True]

    def create_model_run_profile(
        self, model_run_id: str, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """
        Build query to link profile to model run.

        Args:
            model_run_id: UUID of the model run
            profile_id: UUID of the profile

        Returns:
            Tuple of (query, params)
        """
        query = """
        INSERT INTO model_run_profiles (model_run_id, profile_id, active)
        VALUES ($1, $2, $3)
        """
        return query, [model_run_id, profile_id, True]

    def update_model_run_tokens(
        self, model_run_id: str, input_tokens: int, output_tokens: int
    ) -> Tuple[str, List[Any]]:
        """
        Build query to update token counts for completed model run.

        Args:
            model_run_id: UUID of the model run
            input_tokens: Number of input tokens used
            output_tokens: Number of output tokens generated

        Returns:
            Tuple of (query, params)
        """
        query = """
        UPDATE model_runs 
        SET input_tokens = $1, output_tokens = $2
        WHERE id = $3
        """
        return query, [input_tokens, output_tokens, model_run_id]

    def get_profile_rate_limit(self, profile_id: str) -> Tuple[str, List[Any]]:
        """
        Build query to fetch rate limit (req_per_day) for a profile.

        Args:
            profile_id: UUID of the profile

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT req_per_day FROM profiles WHERE id = $1
        """
        return query, [profile_id]

    def count_model_runs_today(
        self, profile_id: str, start_of_day: str
    ) -> Tuple[str, List[Any]]:
        """
        Build query to count model runs for a profile since start of day.

        Counts via model_run_profiles junction table.

        Args:
            profile_id: UUID of the profile
            start_of_day: ISO datetime string for start of current day in UTC

        Returns:
            Tuple of (query, params)
        """
        query = """
        SELECT mr.id, mr.created_at
        FROM model_runs mr
        JOIN model_run_profiles mrp ON mrp.model_run_id = mr.id
        WHERE mrp.profile_id = $1
          AND mrp.active = true
          AND mr.created_at >= $2
        """
        return query, [profile_id, start_of_day]

