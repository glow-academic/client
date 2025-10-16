"""Provider queries - SQL query builders for providers and models."""

from typing import Any, List, Tuple


class ProviderQueries:
    """Query builders for provider and model operations."""

    def list_providers(
        self, department_ids: List[str], profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query for providers list with permissions."""
        query = """
        WITH user_profile AS (
            SELECT role FROM profiles WHERE id = $2
        )
        SELECT 
            p.id as provider_id,
            p.name,
            p.description,
            CASE 
                WHEN up.role IN ('admin', 'superadmin') THEN true
                ELSE false
            END as can_edit
        FROM providers p
        CROSS JOIN user_profile up
        WHERE p.department_id = ANY($1)
        ORDER BY p.name
        """

        return (query, [department_ids, profile_id])

    def get_models_for_providers(
        self, provider_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query to get models for providers."""
        query = """
        SELECT 
            m.id as model_id,
            m.provider_id,
            m.name,
            m.description,
            m.active,
            m.custom_model,
            m.updated_at
        FROM models m
        WHERE m.provider_id = ANY($1)
        ORDER BY m.provider_id, m.updated_at DESC
        """
        return (query, [provider_ids])

    def check_model_usage_personas(
        self, model_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query to check model usage in personas."""
        query = """
        SELECT model_id, COUNT(*) as usage_count
        FROM personas
        WHERE model_id = ANY($1)
        GROUP BY model_id
        """
        return (query, [model_ids])

    def check_model_usage_agents(
        self, model_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query to check model usage in agents."""
        query = """
        SELECT model_id, COUNT(*) as usage_count
        FROM agents
        WHERE model_id = ANY($1)
        GROUP BY model_id
        """
        return (query, [model_ids])

    def get_provider_by_id(self, provider_id: str) -> Tuple[str, List[Any]]:
        """Build query to get provider by ID."""
        query = """
        SELECT 
            name,
            description,
            api_key,
            base_url,
            department_id
        FROM providers
        WHERE id = $1
        """
        return (query, [provider_id])

    def get_valid_departments_for_profile(
        self, profile_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query for valid departments."""
        query = """
        SELECT DISTINCT d.id, d.title as name, d.description
        FROM departments d
        WHERE d.active = true
        ORDER BY d.title
        """
        return (query, [])

    def get_model_by_id(self, model_id: str) -> Tuple[str, List[Any]]:
        """Build query to get model by ID."""
        query = """
        SELECT 
            name,
            description,
            active,
            custom_model,
            input_ppm,
            output_ppm,
            provider_id
        FROM models
        WHERE id = $1
        """
        return (query, [model_id])

    def get_valid_providers(
        self, dept_ids: List[str]
    ) -> Tuple[str, List[Any]]:
        """Build query for valid providers."""
        query = """
        SELECT id, name, COALESCE(description, '') as description FROM providers 
        WHERE department_id = ANY($1)
        ORDER BY name
        """
        return (query, [dept_ids])

    def create_provider(self) -> Tuple[str, List[Any]]:
        """Build query to create provider."""
        query = """
        INSERT INTO providers (
            name,
            description,
            api_key,
            base_url,
            department_id
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
        )
        RETURNING id
        """
        return (query, [])  # Will be filled at execution time

    def get_provider_name(self, provider_id: str) -> Tuple[str, List[Any]]:
        """Build query to get provider name."""
        query = "SELECT name FROM providers WHERE id = $1"
        return (query, [provider_id])

    def update_provider(self) -> Tuple[str, List[Any]]:
        """Build query to update provider."""
        query = """
        UPDATE providers SET
            name = $2,
            description = $3,
            base_url = $4,
            department_id = $5,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def update_provider_api_key(self) -> Tuple[str, List[Any]]:
        """Build query to update provider API key."""
        query = """
        UPDATE providers SET
            api_key = $2,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def get_provider_models(self, provider_id: str) -> Tuple[str, List[Any]]:
        """Build query to get models for a provider."""
        query = """
        SELECT id FROM models WHERE provider_id = $1
        """
        return (query, [provider_id])

    def delete_provider(self, provider_id: str) -> Tuple[str, List[Any]]:
        """Build query to delete provider."""
        query = "DELETE FROM providers WHERE id = $1"
        return (query, [provider_id])

    def create_model(self) -> Tuple[str, List[Any]]:
        """Build query to create model."""
        query = """
        INSERT INTO models (
            provider_id,
            name,
            description,
            active,
            custom_model,
            input_ppm,
            output_ppm
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
        )
        RETURNING id
        """
        return (query, [])  # Will be filled at execution time

    def get_model_name(self, model_id: str) -> Tuple[str, List[Any]]:
        """Build query to get model name."""
        query = "SELECT name FROM models WHERE id = $1"
        return (query, [model_id])

    def update_model(self) -> Tuple[str, List[Any]]:
        """Build query to update model."""
        query = """
        UPDATE models SET
            name = $2,
            description = $3,
            active = $4,
            custom_model = $5,
            input_ppm = $6,
            output_ppm = $7,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def check_model_usage_in_personas(
        self, model_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to check model usage in personas."""
        query = """
        SELECT COUNT(*) as usage_count
        FROM personas
        WHERE model_id = $1
        """
        return (query, [model_id])

    def check_model_usage_in_agents(
        self, model_id: str
    ) -> Tuple[str, List[Any]]:
        """Build query to check model usage in agents."""
        query = """
        SELECT COUNT(*) as usage_count
        FROM agents
        WHERE model_id = $1
        """
        return (query, [model_id])

    def delete_model(self, model_id: str) -> Tuple[str, List[Any]]:
        """Build query to delete model."""
        query = "DELETE FROM models WHERE id = $1"
        return (query, [model_id])
