"""Provider service layer - business logic for provider and model operations."""

from typing import Any, Dict, List

from app.queries.provider_queries import ProviderQueries
from app.schemas.personas import DepartmentMappingItem
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
from sqlalchemy import text
from sqlalchemy.orm import Session


class ProviderService:
    """Service layer for provider and model operations."""

    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db
        self.queries = ProviderQueries()

    def get_providers_list(
        self, filters: ProvidersFilters
    ) -> ProvidersListResponse:
        """Get providers list with nested models (hierarchical)."""

        # Get providers
        query, params = self.queries.list_providers(
            filters.departmentIds, filters.profileId
        )
        providers_result = self.db.execute(text(query), params).fetchall()

        providers = []
        provider_ids = []

        for row in providers_result:
            providers.append(
                ProviderWithModels(
                    provider_id=str(row.provider_id),
                    name=row.name,
                    description=row.description,
                    can_edit=row.can_edit,
                    can_delete=False,  # Will be determined after checking models usage
                    models=[],  # Will be populated below
                )
            )
            provider_ids.append(str(row.provider_id))

        # Get all models for these providers
        if provider_ids:
            query, params = self.queries.get_models_for_providers(provider_ids)
            models_result = self.db.execute(text(query), params).fetchall()

            # Get model usage
            model_ids = [str(m.model_id) for m in models_result]
            model_usage: Dict[str, int] = {}

            if model_ids:
                # Check personas usage
                query, params = self.queries.check_model_usage_personas(model_ids)
                personas_usage = self.db.execute(text(query), params).fetchall()
                for row in personas_usage:
                    model_usage[str(row.model_id)] = model_usage.get(
                        str(row.model_id), 0
                    ) + row.usage_count

                # Check agents usage
                query, params = self.queries.check_model_usage_agents(model_ids)
                agents_usage = self.db.execute(text(query), params).fetchall()
                for row in agents_usage:
                    model_usage[str(row.model_id)] = model_usage.get(
                        str(row.model_id), 0
                    ) + row.usage_count

            # Build model items and add to providers
            for model in models_result:
                model_id = str(model.model_id)
                provider_id = str(model.provider_id)
                is_in_use = model_usage.get(model_id, 0) > 0

                model_item = ModelItem(
                    model_id=model_id,
                    name=model.name,
                    description=model.description,
                    active=model.active,
                    custom_model=model.custom_model,
                    updated_at=model.updated_at.isoformat(),
                    can_edit=True,  # All models can be edited
                    can_delete=not is_in_use,
                )

                # Find provider and add model
                for provider in providers:
                    if provider.provider_id == provider_id:
                        provider.models.append(model_item)
                        break

            # Update provider can_delete based on models usage
            for provider in providers:
                # Provider can be deleted if all its models can be deleted
                provider.can_delete = all(m.can_delete for m in provider.models)

        return ProvidersListResponse(providers=providers)

    def get_provider_detail(
        self, request: ProviderDetailRequest
    ) -> ProviderDetailResponse:
        """Get detailed provider information."""

        # Get provider basic info
        query, params = self.queries.get_provider_by_id(request.providerId)
        provider = self.db.execute(text(query), params).fetchone()

        if not provider:
            raise ValueError(f"Provider not found: {request.providerId}")

        # Get valid departments
        query, params = self.queries.get_valid_departments_for_profile(
            request.profileId
        )
        dept_result = self.db.execute(text(query), params).fetchall()
        valid_department_ids = [str(row.id) for row in dept_result]

        # Get department mapping
        department_mapping = {
            str(row.id): DepartmentMappingItem(
                name=row.name, description=row.description
            )
            for row in dept_result
        }

        return ProviderDetailResponse(
            name=provider.name,
            description=provider.description,
            api_key=provider.api_key,  # Returned encrypted
            base_url=provider.base_url,
            department_id=str(provider.department_id),
            valid_department_ids=valid_department_ids,
            department_mapping=department_mapping,
        )

    def get_model_detail(self, request: ModelDetailRequest) -> ModelDetailResponse:
        """Get detailed model information."""

        # Get model basic info
        query, params = self.queries.get_model_by_id(request.modelId)
        model = self.db.execute(text(query), params).fetchone()

        if not model:
            raise ValueError(f"Model not found: {request.modelId}")

        # Get valid departments for valid providers
        query, params = self.queries.get_valid_departments_for_profile(
            request.profileId
        )
        dept_result = self.db.execute(text(query), params).fetchall()
        valid_dept_ids = [str(row.id) for row in dept_result]

        # Get valid providers
        query, params = self.queries.get_valid_providers(valid_dept_ids)
        providers_result = self.db.execute(text(query), params).fetchall()
        valid_provider_ids = [str(row.id) for row in providers_result]
        provider_mapping = {str(row.id): row.name for row in providers_result}

        return ModelDetailResponse(
            name=model.name,
            description=model.description,
            active=model.active,
            custom_model=model.custom_model,
            input_ppm=model.input_ppm,
            output_ppm=model.output_ppm,
            provider_id=str(model.provider_id),
            valid_provider_ids=valid_provider_ids,
            provider_mapping=provider_mapping,
        )

    def create_provider(
        self, request: CreateProviderRequest
    ) -> CreateProviderResponse:
        """Create a new provider with encrypted API key."""

        # Note: API key encryption should be handled by caller before passing to this method
        query, _ = self.queries.create_provider()
        result = self.db.execute(
            text(query),
            {
                "name": request.name,
                "description": request.description,
                "api_key": request.api_key,  # Should be encrypted by caller
                "base_url": request.base_url,
                "department_id": request.department_id,
            },
        ).fetchone()

        if not result:
            raise ValueError("Failed to create provider")

        self.db.commit()

        return CreateProviderResponse(
            success=True,
            providerId=str(result.id),
            message=f"Provider '{request.name}' created successfully",
        )

    def update_provider(
        self, request: UpdateProviderRequest
    ) -> UpdateProviderResponse:
        """Update an existing provider."""

        # Check if provider exists
        query, params = self.queries.get_provider_name(request.providerId)
        existing = self.db.execute(text(query), params).fetchone()

        if not existing:
            raise ValueError(f"Provider not found: {request.providerId}")

        # Update provider basic fields
        query, _ = self.queries.update_provider()
        self.db.execute(
            text(query),
            {
                "provider_id": request.providerId,
                "name": request.name,
                "description": request.description,
                "base_url": request.base_url,
                "department_id": request.department_id,
            },
        )

        # Update API key if provided
        if request.api_key is not None:
            query, _ = self.queries.update_provider_api_key()
            self.db.execute(
                text(query),
                {
                    "provider_id": request.providerId,
                    "api_key": request.api_key,  # Should be encrypted by caller
                },
            )

        self.db.commit()

        return UpdateProviderResponse(
            success=True, message=f"Provider '{request.name}' updated successfully"
        )

    def delete_provider(
        self, request: DeleteProviderRequest
    ) -> DeleteProviderResponse:
        """Delete a provider if no models are in use."""

        # Get provider name
        query, params = self.queries.get_provider_name(request.providerId)
        provider = self.db.execute(text(query), params).fetchone()

        if not provider:
            raise ValueError(f"Provider not found: {request.providerId}")

        # Get all models for this provider
        query, params = self.queries.get_provider_models(request.providerId)
        models = self.db.execute(text(query), params).fetchall()
        model_ids = [str(m.id) for m in models]

        # Check if any models are in use
        if model_ids:
            # Check personas
            query, params = self.queries.check_model_usage_personas(model_ids)
            personas_usage = self.db.execute(text(query), params).fetchall()
            if personas_usage:
                raise ValueError(
                    "Cannot delete provider: Some models are in use by personas"
                )

            # Check agents
            query, params = self.queries.check_model_usage_agents(model_ids)
            agents_usage = self.db.execute(text(query), params).fetchall()
            if agents_usage:
                raise ValueError(
                    "Cannot delete provider: Some models are in use by agents"
                )

        # Delete provider (cascade deletes models)
        query, params = self.queries.delete_provider(request.providerId)
        self.db.execute(text(query), params)
        self.db.commit()

        return DeleteProviderResponse(
            success=True, message=f"Provider '{provider.name}' deleted successfully"
        )

    def create_model(self, request: CreateModelRequest) -> CreateModelResponse:
        """Create a new model."""

        query, _ = self.queries.create_model()
        result = self.db.execute(
            text(query),
            {
                "provider_id": request.provider_id,
                "name": request.name,
                "description": request.description,
                "active": request.active,
                "custom_model": request.custom_model,
                "input_ppm": request.input_ppm,
                "output_ppm": request.output_ppm,
            },
        ).fetchone()

        if not result:
            raise ValueError("Failed to create model")

        self.db.commit()

        return CreateModelResponse(
            success=True,
            modelId=str(result.id),
            message=f"Model '{request.name}' created successfully",
        )

    def update_model(self, request: UpdateModelRequest) -> UpdateModelResponse:
        """Update an existing model."""

        # Check if model exists
        query, params = self.queries.get_model_name(request.modelId)
        existing = self.db.execute(text(query), params).fetchone()

        if not existing:
            raise ValueError(f"Model not found: {request.modelId}")

        # Update model
        query, _ = self.queries.update_model()
        self.db.execute(
            text(query),
            {
                "model_id": request.modelId,
                "name": request.name,
                "description": request.description,
                "active": request.active,
                "custom_model": request.custom_model,
                "input_ppm": request.input_ppm,
                "output_ppm": request.output_ppm,
            },
        )

        self.db.commit()

        return UpdateModelResponse(
            success=True, message=f"Model '{request.name}' updated successfully"
        )

    def delete_model(self, request: DeleteModelRequest) -> DeleteModelResponse:
        """Delete a model if not in use."""

        # Check if model is in use by personas
        query, params = self.queries.check_model_usage_in_personas(request.modelId)
        personas_usage = self.db.execute(text(query), params).fetchone()

        if personas_usage and personas_usage.usage_count > 0:
            raise ValueError("Cannot delete model: It is in use by personas")

        # Check if model is in use by agents
        query, params = self.queries.check_model_usage_in_agents(request.modelId)
        agents_usage = self.db.execute(text(query), params).fetchone()

        if agents_usage and agents_usage.usage_count > 0:
            raise ValueError("Cannot delete model: It is in use by agents")

        # Get model name
        query, params = self.queries.get_model_name(request.modelId)
        model = self.db.execute(text(query), params).fetchone()

        if not model:
            raise ValueError(f"Model not found: {request.modelId}")

        # Delete model
        query, params = self.queries.delete_model(request.modelId)
        self.db.execute(text(query), params)
        self.db.commit()

        return DeleteModelResponse(
            success=True, message=f"Model '{model.name}' deleted successfully"
        )

