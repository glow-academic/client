"""Provider queries - SQL query builders for providers and models."""

from typing import Any


class ProviderQueries:
    """Query builders for provider and model operations."""

    def list_providers(self, profile_id: str) -> tuple[str, list[Any]]:
        """Build query for providers list with permissions.
        
        Note: Providers are global (not department-specific).
        """
        query = """
        WITH user_profile AS (
            SELECT role FROM profiles WHERE id = $1
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
        ORDER BY p.name
        """

        return (query, [profile_id])

    def list_providers_complete(self, profile_id: str) -> tuple[str, list[Any]]:
        """
        Build complete query for providers list with models and usage in ONE query.

        Note: Providers are global (not department-specific).

        Consolidates:
        - Provider basic info + permissions (from list_providers)
        - Models data as JSONB array (from get_models_for_providers)
        - Model usage counts (from check_model_usage_personas + check_model_usage_agents)
        
        Optimization: Uses CTEs to pre-aggregate usage counts, avoiding N+1 subqueries.

        Returns:
            Tuple of (query, params)
        """
        query = """
        WITH user_profile AS (
            SELECT role FROM profiles WHERE id = $1
        ),
        providers_data AS (
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
        ),
        -- Pre-aggregate persona usage counts for all models
        persona_usage AS (
            SELECT 
                model_id,
                COUNT(*) as usage_count
            FROM personas
            GROUP BY model_id
        ),
        -- Pre-aggregate agent usage counts for all models
        agent_usage AS (
            SELECT 
                model_id,
                COUNT(*) as usage_count
            FROM agents
            GROUP BY model_id
        ),
        models_with_usage AS (
            SELECT 
                m.provider_id,
                COALESCE(jsonb_agg(
                    jsonb_build_object(
                        'model_id', m.id::text,
                        'name', m.name,
                        'description', m.description,
                        'active', m.active,
                        'custom_model', m.custom_model,
                        'updated_at', m.updated_at,
                        'persona_usage_count', COALESCE(pu.usage_count, 0),
                        'agent_usage_count', COALESCE(au.usage_count, 0)
                    ) ORDER BY m.updated_at DESC
                ), '[]'::jsonb) as models_json
            FROM models m
            LEFT JOIN persona_usage pu ON pu.model_id = m.id
            LEFT JOIN agent_usage au ON au.model_id = m.id
            WHERE m.provider_id IN (SELECT provider_id FROM providers_data)
            GROUP BY m.provider_id
        )
        SELECT 
            pd.provider_id,
            pd.name,
            pd.description,
            pd.can_edit,
            COALESCE(mwu.models_json, '[]'::jsonb) as models_json
        FROM providers_data pd
        LEFT JOIN models_with_usage mwu ON mwu.provider_id = pd.provider_id
        ORDER BY pd.name
        """

        return (query, [profile_id])

    def get_models_for_providers(
        self, provider_ids: list[str]
    ) -> tuple[str, list[Any]]:
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

    def check_model_usage_personas(self, model_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query to check model usage in personas."""
        query = """
        SELECT model_id, COUNT(*) as usage_count
        FROM personas
        WHERE model_id = ANY($1)
        GROUP BY model_id
        """
        return (query, [model_ids])

    def check_model_usage_agents(self, model_ids: list[str]) -> tuple[str, list[Any]]:
        """Build query to check model usage in agents."""
        query = """
        SELECT model_id, COUNT(*) as usage_count
        FROM agents
        WHERE model_id = ANY($1)
        GROUP BY model_id
        """
        return (query, [model_ids])

    def get_valid_departments_for_profile(
        self, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build query for valid departments."""
        query = """
        SELECT DISTINCT d.id, d.title as name, d.description
        FROM departments d
        WHERE d.active = true
        ORDER BY d.title
        """
        return (query, [])

    def create_provider(self) -> tuple[str, list[Any]]:
        """Build query to create provider.

        Note: base_url moved to provider_endpoints junction table.
        Call insert_provider_endpoint() separately after creating provider.
        """
        query = """
        INSERT INTO providers (
            name,
            description,
            api_key,
            department_id
        )
        VALUES (
            $1,
            $2,
            $3,
            $4
        )
        RETURNING id
        """
        return (query, [])  # Will be filled at execution time

    def get_provider_name(self, provider_id: str) -> tuple[str, list[Any]]:
        """Build query to get provider name."""
        query = "SELECT name FROM providers WHERE id = $1"
        return (query, [provider_id])

    def update_provider(self) -> tuple[str, list[Any]]:
        """Build query to update provider.

        Note: base_url moved to provider_endpoints junction table.
        Call upsert_provider_endpoint() separately to update endpoint.
        """
        query = """
        UPDATE providers SET
            name = $2,
            description = $3,
            department_id = $4,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def update_provider_api_key(self) -> tuple[str, list[Any]]:
        """Build query to update provider API key."""
        query = """
        UPDATE providers SET
            api_key = $2,
            updated_at = NOW()
        WHERE id = $1
        """
        return (query, [])  # Will be filled at execution time

    def get_provider_models(self, provider_id: str) -> tuple[str, list[Any]]:
        """Build query to get models for a provider."""
        query = """
        SELECT id FROM models WHERE provider_id = $1
        """
        return (query, [provider_id])

    def delete_provider(self, provider_id: str) -> tuple[str, list[Any]]:
        """Build query to delete provider."""
        query = "DELETE FROM providers WHERE id = $1"
        return (query, [provider_id])

    def create_model(self) -> tuple[str, list[Any]]:
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

    def get_model_name(self, model_id: str) -> tuple[str, list[Any]]:
        """Build query to get model name."""
        query = "SELECT name FROM models WHERE id = $1"
        return (query, [model_id])

    def update_model(self) -> tuple[str, list[Any]]:
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

    def check_model_usage_in_personas(self, model_id: str) -> tuple[str, list[Any]]:
        """Build query to check model usage in personas."""
        query = """
        SELECT COUNT(*) as usage_count
        FROM personas
        WHERE model_id = $1
        """
        return (query, [model_id])

    def check_model_usage_in_agents(self, model_id: str) -> tuple[str, list[Any]]:
        """Build query to check model usage in agents."""
        query = """
        SELECT COUNT(*) as usage_count
        FROM agents
        WHERE model_id = $1
        """
        return (query, [model_id])

    def delete_model(self, model_id: str) -> tuple[str, list[Any]]:
        """Build query to delete model."""
        query = "DELETE FROM models WHERE id = $1"
        return (query, [model_id])

    # ===== Provider Endpoints Junction Table Queries =====

    def insert_provider_endpoint(self) -> tuple[str, list[Any]]:
        """Build query to insert provider endpoint.

        Params order: provider_id, base_url
        """
        query = """
        INSERT INTO provider_endpoints (provider_id, base_url)
        VALUES ($1, $2)
        RETURNING *
        """
        return (query, [])

    def upsert_provider_endpoint(self) -> tuple[str, list[Any]]:
        """Build query to upsert provider endpoint.

        Params order: provider_id, base_url
        """
        query = """
        INSERT INTO provider_endpoints (provider_id, base_url)
        VALUES ($1, $2)
        ON CONFLICT (provider_id)
        DO UPDATE SET
            base_url = EXCLUDED.base_url,
            updated_at = NOW()
        RETURNING *
        """
        return (query, [])

    def delete_provider_endpoint(self, provider_id: str) -> tuple[str, list[Any]]:
        """Build query to delete provider endpoint."""
        query = "DELETE FROM provider_endpoints WHERE provider_id = $1"
        return (query, [provider_id])

    def get_provider_detail_complete(
        self, provider_id: str, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get provider detail with all mappings in ONE query.

        Consolidates 3 queries into 1 using CTEs and JSONB aggregation.

        Args:
            provider_id: UUID of the provider
            profile_id: UUID of the profile for permissions

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH provider_data AS (
            SELECT 
                p.name,
                p.description,
                p.api_key,
                pe.base_url,
                p.department_id
            FROM providers p
            LEFT JOIN provider_endpoints pe ON pe.provider_id = p.id AND pe.active = true
            WHERE p.id = $1
        ),
        valid_depts AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        d.id::text,
                        jsonb_build_object(
                            'name', d.title,
                            'description', COALESCE(d.description, '')
                        )
                    ),
                    '{}'::jsonb
                ) as dept_mapping,
                array_agg(d.id::text ORDER BY d.title) as dept_ids
            FROM departments d
            JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = $2 AND d.active = true
        )
        SELECT 
            p.*,
            vd.dept_mapping as department_mapping,
            vd.dept_ids as valid_department_ids
        FROM provider_data p
        CROSS JOIN valid_depts vd
        """
        return (query, [provider_id, profile_id])

    def get_model_detail_complete(
        self, model_id: str, profile_id: str
    ) -> tuple[str, list[Any]]:
        """Build optimized query to get model detail with all mappings in ONE query.

        Consolidates 4 queries into 1 using CTEs and JSONB aggregation.

        Args:
            model_id: UUID of the model
            profile_id: UUID of the profile for permissions

        Returns:
            Tuple of (query string, params list)
        """
        query = """
        WITH model_data AS (
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
        ),
        valid_depts AS (
            SELECT array_agg(d.id) as dept_ids
            FROM departments d
            JOIN profile_departments pd ON d.id = pd.department_id
            WHERE pd.profile_id = $2 AND d.active = true
        ),
        valid_providers AS (
            SELECT 
                COALESCE(
                    jsonb_object_agg(
                        p.id::text,
                        jsonb_build_object(
                            'name', p.name,
                            'description', COALESCE(p.description, '')
                        )
                    ),
                    '{}'::jsonb
                ) as provider_mapping,
                array_agg(p.id::text ORDER BY p.name) as provider_ids
            FROM providers p
            JOIN valid_depts vd ON p.department_id = ANY(vd.dept_ids)
        )
        SELECT 
            m.*,
            vp.provider_mapping,
            vp.provider_ids as valid_provider_ids
        FROM model_data m
        CROSS JOIN valid_providers vp
        """
        return (query, [model_id, profile_id])
