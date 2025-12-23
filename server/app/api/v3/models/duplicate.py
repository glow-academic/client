"""Model duplicate endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db, transaction
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import load_sql


# Inline request/response schemas
class DuplicateModelRequest(BaseModel):
    """Request to duplicate model."""

    modelId: str
    # profileId removed - comes from X-Profile-Id header


class DuplicateModelResponse(BaseModel):
    """Response from duplicate model."""

    success: bool
    modelId: str
    message: str


router = APIRouter()


@router.post(
    "/duplicate",
    response_model=DuplicateModelResponse,
    dependencies=[
        audit_activity(
            "model.duplicated", "{{ actor.name }} duplicated model '{{ model.name }}'"
        )
    ],
)
async def duplicate_model(
    request: DuplicateModelRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DuplicateModelResponse:
    """Duplicate a model."""
    tags = ["models"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with transaction(conn):
            # Get original model data
            get_model_sql = """
                SELECT
                    name,
                    description,
                    active,
                    provider
                FROM models
                WHERE id = $1
            """
            model = await conn.fetchrow(get_model_sql, request.modelId)

            if not model:
                raise ValueError(f"Model not found: {request.modelId}")

            # Duplicate model (SQL adds ' Copy' to description) - track primary operation
            sql_query = load_sql("app/sql/v3/models/duplicate.sql")
            sql_params = (request.modelId, profile_id)
            new_model = await conn.fetchrow(sql_query, request.modelId, profile_id)

            if not new_model:
                raise ValueError("Failed to create duplicate model")

            new_model_id = str(new_model["id"])
            original_name = new_model.get("original_name") or model["name"]
            actor_name = new_model.get("actor_name")

            # Set audit context with data from SQL query
            if actor_name:
                audit_set(
                    http_request,
                    actor={"name": actor_name, "id": profile_id},
                    model={"name": original_name, "id": request.modelId},
                )

            result_data = DuplicateModelResponse(
                success=True,
                modelId=new_model_id,
                message=f"Model '{original_name}' duplicated successfully",
            )

            # Invalidate cache after mutation
            await invalidate_tags(tags)
            response.headers["X-Invalidate-Tags"] = ",".join(tags)

            return result_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="duplicate_model",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
