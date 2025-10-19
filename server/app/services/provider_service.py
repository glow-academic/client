"""Provider service layer - business logic for provider and model operations."""

import asyncpg  # type: ignore
from app.cache import keys
from app.queries.provider_queries import ProviderQueries
from app.schemas.base import DepartmentMappingItem, ProviderMappingItem
from app.schemas.providers import (CreateModelRequest, CreateModelResponse,
                                   CreateProviderRequest,
                                   CreateProviderResponse, DeleteModelRequest,
                                   DeleteModelResponse, DeleteProviderRequest,
                                   DeleteProviderResponse, ModelDetailRequest,
                                   ModelDetailResponse, ModelItem,
                                   ProviderDetailRequest,
                                   ProviderDetailResponse, ProvidersFilters,
                                   ProvidersListResponse, ProviderWithModels,
                                   UpdateModelRequest, UpdateModelResponse,
                                   UpdateProviderRequest,
                                   UpdateProviderResponse)
from app.services.base import BaseService, with_cache
from app.utils.auth import encrypt_api_key


class ProviderService(BaseService):
    """Service layer for provider and model operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        super().__init__(conn)
        self.queries = ProviderQueries()

    @with_cache(lambda self, filters: keys.provider_list(filters))
    async def get_providers_list(
        self, filters: ProvidersFilters
    ) -> ProvidersListResponse:
        """Get providers list with nested models (hierarchical)."""
        # Get complete providers data with models and usage (consolidated query)
        query, params = self.queries.list_providers_complete(
            filters.departmentIds, filters.profileId
        )
        providers_result = await self.conn.fetch(query, *params)

        providers = []

        for row in providers_result:
            # Parse JSONB models
            models = []
            models_data = row.get("models_json")

            if models_data and isinstance(models_data, list):
                for model_obj in models_data:
                    if isinstance(model_obj, dict):
                        # Calculate total usage from both sources
                        total_usage = model_obj.get(
                            "persona_usage_count", 0
                        ) + model_obj.get("agent_usage_count", 0)
                        is_in_use = total_usage > 0

                        # Handle updated_at - it might be a string or datetime
                        updated_at = model_obj.get("updated_at", "")
                        if hasattr(updated_at, "isoformat"):
                            updated_at = updated_at.isoformat()
                        elif not isinstance(updated_at, str):
                            updated_at = str(updated_at)

                        model_item = ModelItem(
                            model_id=model_obj.get("model_id", ""),
                            name=model_obj.get("name", ""),
                            description=model_obj.get("description", ""),
                            active=model_obj.get("active", False),
                            custom_model=model_obj.get("custom_model", False),
                            updated_at=updated_at,
                            can_edit=True,
                            can_delete=not is_in_use,
                        )
                        models.append(model_item)

            # Create provider with models
            provider = ProviderWithModels(
                provider_id=str(row["provider_id"]),
                name=row["name"],
                description=row["description"],
                can_edit=row["can_edit"],
                can_delete=all(m.can_delete for m in models) if models else True,
                models=models,
            )
            providers.append(provider)

        return ProvidersListResponse(providers=providers)

    @with_cache(lambda self, request: keys.provider_by_id(request.providerId))
    async def get_provider_detail(
        self, request: ProviderDetailRequest
    ) -> ProviderDetailResponse:
        """Get detailed provider information."""
        # Get all provider data with mappings in a single query
        query, params = self.queries.get_provider_detail_complete(
            request.providerId, request.profileId
        )
        provider = await self.conn.fetchrow(query, *params)

        if not provider:
            raise ValueError(f"Provider not found: {request.providerId}")

        # Parse valid_department_ids from array
        valid_department_ids = provider["valid_department_ids"] or []

        # Parse department_mapping from JSONB with type safety
        department_mapping = {}
        if provider.get("department_mapping") and isinstance(
            provider["department_mapping"], dict
        ):
            for dept_id, ddata in provider["department_mapping"].items():
                if isinstance(ddata, dict):
                    department_mapping[dept_id] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", "")
                    )

        return ProviderDetailResponse(
            name=provider["name"],
            description=provider["description"],
            api_key=provider["api_key"],  # Returned encrypted
            base_url=provider["base_url"],
            department_id=str(provider["department_id"]),
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
        )

    @with_cache(lambda self, request: keys.model_by_id(request.modelId))
    async def get_model_detail(
        self, request: ModelDetailRequest
    ) -> ModelDetailResponse:
        """Get detailed model information."""
        # Get all model data with mappings in a single query
        query, params = self.queries.get_model_detail_complete(
            request.modelId, request.profileId
        )
        model = await self.conn.fetchrow(query, *params)

        if not model:
            raise ValueError(f"Model not found: {request.modelId}")

        # Parse valid_provider_ids from array
        valid_provider_ids = model["valid_provider_ids"] or []

        # Parse provider_mapping from JSONB with type safety
        provider_mapping = {}
        if model.get("provider_mapping") and isinstance(
            model["provider_mapping"], dict
        ):
            for provider_id, pdata in model["provider_mapping"].items():
                if isinstance(pdata, dict):
                    provider_mapping[provider_id] = ProviderMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", "")
                    )

        return ModelDetailResponse(
            name=model["name"],
            description=model["description"],
            active=model["active"],
            custom_model=model["custom_model"],
            input_ppm=model["input_ppm"],
            output_ppm=model["output_ppm"],
            provider_id=str(model["provider_id"]),
            valid_provider_ids=valid_provider_ids,
            provider_mapping=provider_mapping,
        )

    async def create_provider(
        self, request: CreateProviderRequest
    ) -> CreateProviderResponse:
        """Create a new provider with encrypted API key."""

        # Encrypt API key before storing
        encrypted_api_key = encrypt_api_key(request.api_key)

        query, _ = self.queries.create_provider()
        result = await self.conn.fetchrow(
            query,
            request.name,
            request.description,
            encrypted_api_key,
            request.department_id,
        )

        if not result:
            raise ValueError("Failed to create provider")

        provider_id = str(result["id"])

        # Insert provider endpoint if base_url provided
        if request.base_url:
            endpoint_query = self.queries.insert_provider_endpoint()
            await self.conn.execute(endpoint_query, provider_id, request.base_url)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_provider_all(),
            ]
        )

        return CreateProviderResponse(
            success=True,
            providerId=str(result["id"]),
            message=f"Provider '{request.name}' created successfully",
        )

    async def update_provider(
        self, request: UpdateProviderRequest
    ) -> UpdateProviderResponse:
        """Update an existing provider."""

        # Check if provider exists
        query, params = self.queries.get_provider_name(request.providerId)
        existing = await self.conn.fetchrow(query, *params)

        if not existing:
            raise ValueError(f"Provider not found: {request.providerId}")

        # Update provider basic fields
        query, _ = self.queries.update_provider()
        await self.conn.execute(
            query,
            request.providerId,
            request.name,
            request.description,
            request.department_id,
        )

        # Upsert provider endpoint if base_url provided
        if request.base_url:
            endpoint_query = self.queries.upsert_provider_endpoint()
            await self.conn.execute(
                endpoint_query, request.providerId, request.base_url
            )

        # Update API key if provided (encrypt before storing)
        if request.api_key is not None:
            encrypted_api_key = encrypt_api_key(request.api_key)
            query, _ = self.queries.update_provider_api_key()
            await self.conn.execute(
                query,
                request.providerId,
                encrypted_api_key,
            )

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_provider_by_id(request.providerId),
                keys.tag_provider_all(),
            ]
        )

        return UpdateProviderResponse(
            success=True, message=f"Provider '{request.name}' updated successfully"
        )

    async def delete_provider(
        self, request: DeleteProviderRequest
    ) -> DeleteProviderResponse:
        """Delete a provider if no models are in use."""

        # Get provider name
        query, params = self.queries.get_provider_name(request.providerId)
        provider = await self.conn.fetchrow(query, *params)

        if not provider:
            raise ValueError(f"Provider not found: {request.providerId}")

        # Get all models for this provider
        query, params = self.queries.get_provider_models(request.providerId)
        models = await self.conn.fetch(query, *params)
        model_ids = [str(m["id"]) for m in models]

        # Check if any models are in use
        if model_ids:
            # Check personas
            query, params = self.queries.check_model_usage_personas(model_ids)
            personas_usage = await self.conn.fetch(query, *params)
            if personas_usage:
                raise ValueError(
                    "Cannot delete provider: Some models are in use by personas"
                )

            # Check agents
            query, params = self.queries.check_model_usage_agents(model_ids)
            agents_usage = await self.conn.fetch(query, *params)
            if agents_usage:
                raise ValueError(
                    "Cannot delete provider: Some models are in use by agents"
                )

        # Delete provider (cascade deletes models)
        query, params = self.queries.delete_provider(request.providerId)
        await self.conn.execute(query, *params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_provider_by_id(request.providerId),
                keys.tag_provider_all(),
            ]
        )

        return DeleteProviderResponse(
            success=True, message=f"Provider '{provider['name']}' deleted successfully"
        )

    async def create_model(self, request: CreateModelRequest) -> CreateModelResponse:
        """Create a new model."""

        query, _ = self.queries.create_model()
        result = await self.conn.fetchrow(
            query,
            request.provider_id,
            request.name,
            request.description,
            request.active,
            request.custom_model,
            request.input_ppm,
            request.output_ppm,
        )

        if not result:
            raise ValueError("Failed to create model")

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_provider_all(),  # List queries include models
            ]
        )

        return CreateModelResponse(
            success=True,
            modelId=str(result["id"]),
            message=f"Model '{request.name}' created successfully",
        )

    async def update_model(self, request: UpdateModelRequest) -> UpdateModelResponse:
        """Update an existing model."""

        # Check if model exists
        query, params = self.queries.get_model_name(request.modelId)
        existing = await self.conn.fetchrow(query, *params)

        if not existing:
            raise ValueError(f"Model not found: {request.modelId}")

        # Update model
        query, _ = self.queries.update_model()
        await self.conn.execute(
            query,
            request.modelId,
            request.name,
            request.description,
            request.active,
            request.custom_model,
            request.input_ppm,
            request.output_ppm,
        )

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_model_by_id(request.modelId),
                keys.tag_provider_all(),
            ]
        )

        return UpdateModelResponse(
            success=True, message=f"Model '{request.name}' updated successfully"
        )

    async def delete_model(self, request: DeleteModelRequest) -> DeleteModelResponse:
        """Delete a model if not in use."""

        # Check if model is in use by personas
        query, params = self.queries.check_model_usage_in_personas(request.modelId)
        personas_usage = await self.conn.fetchrow(query, *params)

        if personas_usage and personas_usage["usage_count"] > 0:
            raise ValueError("Cannot delete model: It is in use by personas")

        # Check if model is in use by agents
        query, params = self.queries.check_model_usage_in_agents(request.modelId)
        agents_usage = await self.conn.fetchrow(query, *params)

        if agents_usage and agents_usage["usage_count"] > 0:
            raise ValueError("Cannot delete model: It is in use by agents")

        # Get model name
        query, params = self.queries.get_model_name(request.modelId)
        model = await self.conn.fetchrow(query, *params)

        if not model:
            raise ValueError(f"Model not found: {request.modelId}")

        # Delete model
        query, params = self.queries.delete_model(request.modelId)
        await self.conn.execute(query, *params)

        # Invalidate caches
        await self._invalidate_cache(
            [
                keys.tag_model_by_id(request.modelId),
                keys.tag_provider_all(),
            ]
        )

        return DeleteModelResponse(
            success=True, message=f"Model '{model['name']}' deleted successfully"
        )


def get_provider_service(conn: asyncpg.Connection) -> ProviderService:
    """Get provider service instance."""
    return ProviderService(conn)
