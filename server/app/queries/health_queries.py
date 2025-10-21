"""Health check queries for system monitoring."""

from typing import Any


class HealthQueries:
    """SQL queries for health check operations."""

    @staticmethod
    def get_active_simulation_agent() -> tuple[str, list[Any]]:
        """
        Get first active simulation persona with provider credentials.

        Simulations use personas, not agents directly.

        Returns:
            Tuple of (query, params)
        """
        query = """
            SELECT p.id, p.name, p.system_prompt, p.temperature,
                   pr.name as provider_name, pr.api_key,
                   pe.base_url, m.name as model_name,
                   m.custom_model, p.reasoning
            FROM personas p
            JOIN models m ON p.model_id = m.id
            JOIN providers pr ON m.provider_id = pr.id
            LEFT JOIN provider_endpoints pe ON pr.id = pe.provider_id
            WHERE p.active = true
            LIMIT 1
        """
        return query, []

    @staticmethod
    def get_active_assistant_agent() -> tuple[str, list[Any]]:
        """
        Get first active assistant agent with provider credentials.

        Assistants are agents with role='assistant' in department_agents.

        Returns:
            Tuple of (query, params)
        """
        query = """
            SELECT a.id, a.name, a.system_prompt, a.temperature,
                   p.name as provider_name, p.api_key,
                   pe.base_url, m.name as model_name,
                   m.custom_model, a.reasoning
            FROM agents a
            JOIN department_agents da ON a.id = da.agent_id
            JOIN models m ON a.model_id = m.id
            JOIN providers p ON m.provider_id = p.id
            LEFT JOIN provider_endpoints pe ON p.id = pe.provider_id
            WHERE da.role = 'assistant' AND da.active = true AND a.active = true
            LIMIT 1
        """
        return query, []
