"""Providers list endpoint."""

import json
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_db
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class ProvidersFilters(BaseModel):
    profileId: str


class ModelItem(BaseModel):
    model_id: str
    name: str
    description: str
    active: bool
    custom_model: bool
    updated_at: str
    can_edit: bool
    can_delete: bool


class ProviderWithModels(BaseModel):
    provider_id: str
    name: str
    description: str
    can_edit: bool
    can_delete: bool
    models: list[ModelItem]


class ProvidersListResponse(BaseModel):
    providers: list[ProviderWithModels]


router = APIRouter()


@router.post("/list")
async def get_providers_list(
    filters: ProvidersFilters,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ProvidersListResponse:
    """Get providers list with nested models (hierarchical)."""
    try:
        sql = load_sql("sql/v3/providers/list_providers_complete.sql")
        providers_result = await conn.fetch(sql, filters.profileId)

        providers = []

        for row in providers_result:
            # Parse JSONB models
            models = []
            models_data = row.get("models_json")

            if isinstance(models_data, str):
                models_data = json.loads(models_data)

            if models_data and isinstance(models_data, list):
                for model_obj in models_data:
                    if isinstance(model_obj, dict):
                        total_usage = model_obj.get("persona_usage_count", 0) + model_obj.get(
                            "agent_usage_count", 0
                        )
                        is_in_use = total_usage > 0

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
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

