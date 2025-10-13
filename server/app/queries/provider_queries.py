"""Provider queries - SQL query builders for providers and models."""

from typing import Any, Dict, List, Tuple


class ProviderQueries:
    """Query builders for provider and model operations."""

    def list_providers(
        self, department_ids: List[str], profile_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for providers list with permissions."""
        query = """
        WITH user_profile AS (
            SELECT role FROM profiles WHERE id = :profile_id
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
        WHERE p.department_id = ANY(:department_ids)
        ORDER BY p.name
        """

        params = {"department_ids": department_ids, "profile_id": profile_id}
        return (query, params)

    def get_models_for_providers(
        self, provider_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
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
        WHERE m.provider_id = ANY(:provider_ids)
        ORDER BY m.provider_id, m.updated_at DESC
        """
        params = {"provider_ids": provider_ids}
        return (query, params)

    def check_model_usage_personas(
        self, model_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to check model usage in personas."""
        query = """
        SELECT model_id, COUNT(*) as usage_count
        FROM personas
        WHERE model_id = ANY(:model_ids)
        GROUP BY model_id
        """
        params = {"model_ids": model_ids}
        return (query, params)

    def check_model_usage_agents(
        self, model_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to check model usage in agents."""
        query = """
        SELECT model_id, COUNT(*) as usage_count
        FROM agents
        WHERE model_id = ANY(:model_ids)
        GROUP BY model_id
        """
        params = {"model_ids": model_ids}
        return (query, params)

    def get_provider_by_id(self, provider_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to get provider by ID."""
        query = """
        SELECT 
            name,
            description,
            api_key,
            base_url,
            department_id
        FROM providers
        WHERE id = :provider_id
        """
        params = {"provider_id": provider_id}
        return (query, params)

    def get_valid_departments_for_profile(
        self, profile_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for valid departments."""
        query = """
        SELECT DISTINCT d.id, d.title as name, d.description
        FROM departments d
        WHERE d.active = true
        ORDER BY d.title
        """
        params: Dict[str, Any] = {}
        return (query, params)

    def get_model_by_id(self, model_id: str) -> Tuple[str, Dict[str, Any]]:
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
        WHERE id = :model_id
        """
        params = {"model_id": model_id}
        return (query, params)

    def get_valid_providers(
        self, dept_ids: List[str]
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query for valid providers."""
        query = """
        SELECT id, name FROM providers 
        WHERE department_id = ANY(:dept_ids)
        ORDER BY name
        """
        params = {"dept_ids": dept_ids}
        return (query, params)

    def create_provider(self) -> Tuple[str, Dict[str, Any]]:
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
            :name,
            :description,
            :api_key,
            :base_url,
            :department_id
        )
        RETURNING id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def get_provider_name(self, provider_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to get provider name."""
        query = "SELECT name FROM providers WHERE id = :provider_id"
        params = {"provider_id": provider_id}
        return (query, params)

    def update_provider(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to update provider."""
        query = """
        UPDATE providers SET
            name = :name,
            description = :description,
            base_url = :base_url,
            department_id = :department_id,
            updated_at = NOW()
        WHERE id = :provider_id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def update_provider_api_key(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to update provider API key."""
        query = """
        UPDATE providers SET
            api_key = :api_key,
            updated_at = NOW()
        WHERE id = :provider_id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def get_provider_models(self, provider_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to get models for a provider."""
        query = """
        SELECT id FROM models WHERE provider_id = :provider_id
        """
        params = {"provider_id": provider_id}
        return (query, params)

    def delete_provider(self, provider_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to delete provider."""
        query = "DELETE FROM providers WHERE id = :provider_id"
        params = {"provider_id": provider_id}
        return (query, params)

    def create_model(self) -> Tuple[str, Dict[str, Any]]:
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
            :provider_id,
            :name,
            :description,
            :active,
            :custom_model,
            :input_ppm,
            :output_ppm
        )
        RETURNING id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def get_model_name(self, model_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to get model name."""
        query = "SELECT name FROM models WHERE id = :model_id"
        params = {"model_id": model_id}
        return (query, params)

    def update_model(self) -> Tuple[str, Dict[str, Any]]:
        """Build query to update model."""
        query = """
        UPDATE models SET
            name = :name,
            description = :description,
            active = :active,
            custom_model = :custom_model,
            input_ppm = :input_ppm,
            output_ppm = :output_ppm,
            updated_at = NOW()
        WHERE id = :model_id
        """
        params: Dict[str, Any] = {}  # Will be filled at execution time
        return (query, params)

    def check_model_usage_in_personas(
        self, model_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to check model usage in personas."""
        query = """
        SELECT COUNT(*) as usage_count
        FROM personas
        WHERE model_id = :model_id
        """
        params = {"model_id": model_id}
        return (query, params)

    def check_model_usage_in_agents(
        self, model_id: str
    ) -> Tuple[str, Dict[str, Any]]:
        """Build query to check model usage in agents."""
        query = """
        SELECT COUNT(*) as usage_count
        FROM agents
        WHERE model_id = :model_id
        """
        params = {"model_id": model_id}
        return (query, params)

    def delete_model(self, model_id: str) -> Tuple[str, Dict[str, Any]]:
        """Build query to delete model."""
        query = "DELETE FROM models WHERE id = :model_id"
        params = {"model_id": model_id}
        return (query, params)

