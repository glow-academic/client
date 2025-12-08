"""Model update endpoint - v3 API following DHH principles."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db, transaction
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql


# Inline request/response schemas
class PricingEntry(BaseModel):
    type: str  # 'input' | 'output' | 'cached'
    unit_id: str
    price: float


class UpdateModelRequest(BaseModel):
    """Request to update model."""

    modelId: str
    provider_id: str  # UUID of provider
    name: str
    description: str
    active: bool
    value: str  # Model value identifier
    department_ids: list[str] | None = None
    base_url: str | None = None  # Optional custom base URL for the model
    # Configuration fields
    temperature_bounds: dict[str, Any] | None = (
        None  # { type: 'range', lower: float, upper: float } | { type: 'values', values: list[float] }
    )
    pricing: list[PricingEntry] | None = None
    modalities: dict[str, list[str]] | None = (
        None  # { input: list[str], output: list[str] }
    )
    reasoning_levels: list[str] | None = None
    voices: list[str] | None = None
    qualities: list[str] | None = None
    profileId: str  # Required for auditing/access control


class UpdateModelResponse(BaseModel):
    """Response from update model."""

    success: bool
    message: str


router = APIRouter()


@router.post("/update", response_model=UpdateModelResponse)
async def update_model(
    request: UpdateModelRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UpdateModelResponse:
    """Update an existing model."""
    tags = ["models"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        async with transaction(conn):
            # Check if model exists
            check_sql = "SELECT name FROM models WHERE id = $1"
            existing = await conn.fetchrow(check_sql, request.modelId)

            if not existing:
                raise ValueError(f"Model not found: {request.modelId}")

            # Update model with departments and endpoint (track primary operation)
            sql_query = load_sql("sql/v3/models/update_model_complete.sql")
            # Ensure department_ids is always an array (empty if None)
            department_ids = request.department_ids if request.department_ids else []
            base_url = request.base_url if request.base_url else None
            sql_params = (
                request.modelId,
                request.provider_id,
                request.name,
                request.description,
                request.active,
                request.value,
                department_ids,
                base_url,
                request.profileId,
            )
            await conn.execute(
                sql_query,
                request.modelId,
                request.provider_id,
                request.name,
                request.description,
                request.active,
                request.value,
                department_ids,
                base_url,
                request.profileId,
            )

            # Update temperature bounds if provided
            if request.temperature_bounds:
                # Deactivate existing temperature levels
                await conn.execute(
                    "UPDATE model_temperature_levels SET active = false, updated_at = NOW() WHERE model_id = $1",
                    request.modelId,
                )
                # Insert new temperature levels
                bounds_type = request.temperature_bounds.get("type")
                if bounds_type == "range":
                    lower = request.temperature_bounds.get("lower", 0.0)
                    upper = request.temperature_bounds.get("upper", 1.0)
                    await conn.execute(
                        "INSERT INTO model_temperature_levels (model_id, temperature, is_upper, active) VALUES ($1, $2, false, true), ($1, $3, true, true) ON CONFLICT (model_id, temperature, is_upper) DO UPDATE SET active = true, updated_at = NOW()",
                        request.modelId,
                        lower,
                        upper,
                    )
                elif bounds_type == "values":
                    values = request.temperature_bounds.get("values", [])
                    for val in values:
                        await conn.execute(
                            "INSERT INTO model_temperature_levels (model_id, temperature, is_upper, active) VALUES ($1, $2, false, true) ON CONFLICT (model_id, temperature, is_upper) DO UPDATE SET active = true, updated_at = NOW()",
                            request.modelId,
                            float(val),
                        )

            # Update pricing if provided
            if request.pricing:
                # Deactivate existing pricing
                await conn.execute(
                    "UPDATE model_pricing SET active = false, updated_at = NOW() WHERE model_id = $1",
                    request.modelId,
                )
                # Insert new pricing entries
                for pricing_entry in request.pricing:
                    await conn.execute(
                        "INSERT INTO model_pricing (model_id, pricing_type, unit_id, price, active) VALUES ($1, $2::pricing_type, $3::uuid, $4, true) ON CONFLICT (model_id, pricing_type, unit_id) DO UPDATE SET price = EXCLUDED.price, active = true, updated_at = NOW()",
                        request.modelId,
                        pricing_entry.type,
                        pricing_entry.unit_id,
                        pricing_entry.price,
                    )

            # Update modalities (default to text/text if not provided or empty)
            # Deactivate existing modalities
            await conn.execute(
                "UPDATE model_modalities SET active = false, updated_at = NOW() WHERE model_id = $1",
                request.modelId,
            )
            # Insert new modalities (default to text/text if not provided)
            input_mods = (
                request.modalities.get("input", []) if request.modalities else []
            )
            output_mods = (
                request.modalities.get("output", []) if request.modalities else []
            )

            # Default to text/text if no modalities specified
            if not input_mods and not output_mods:
                input_mods = ["text"]
                output_mods = ["text"]

            for mod in input_mods:
                await conn.execute(
                    "INSERT INTO model_modalities (model_id, modality, is_input, active) VALUES ($1, $2::modality_type, true, true) ON CONFLICT (model_id, modality, is_input) DO UPDATE SET active = true, updated_at = NOW()",
                    request.modelId,
                    mod,
                )
            for mod in output_mods:
                await conn.execute(
                    "INSERT INTO model_modalities (model_id, modality, is_input, active) VALUES ($1, $2::modality_type, false, true) ON CONFLICT (model_id, modality, is_input) DO UPDATE SET active = true, updated_at = NOW()",
                    request.modelId,
                    mod,
                )

            # Update reasoning levels if provided
            if request.reasoning_levels:
                # Deactivate existing reasoning levels
                await conn.execute(
                    "UPDATE model_reasoning_levels SET active = false, updated_at = NOW() WHERE model_id = $1",
                    request.modelId,
                )
                # Insert new reasoning levels
                for level in request.reasoning_levels:
                    await conn.execute(
                        "INSERT INTO model_reasoning_levels (model_id, reasoning_level, active) VALUES ($1, $2::reasoning_effort, true) ON CONFLICT (model_id, reasoning_level) DO UPDATE SET active = true, updated_at = NOW()",
                        request.modelId,
                        level,
                    )

            # Update voices (default to all voices if None or empty)
            # Always deactivate existing voices first
            await conn.execute(
                "UPDATE model_voices SET active = false, updated_at = NOW() WHERE model_id = $1",
                request.modelId,
            )

            # If voices is None or empty list, create all available voices
            if request.voices is None or (
                isinstance(request.voices, list) and len(request.voices) == 0
            ):
                # Create all available voices
                all_voices = [
                    "alloy",
                    "ash",
                    "ballad",
                    "coral",
                    "echo",
                    "fable",
                    "onyx",
                    "nova",
                    "sage",
                    "shimmer",
                    "verse",
                ]
                for voice in all_voices:
                    await conn.execute(
                        "INSERT INTO model_voices (model_id, voice, active) VALUES ($1, $2::voice, true) ON CONFLICT (model_id, voice) DO UPDATE SET active = true, updated_at = NOW()",
                        request.modelId,
                        voice,
                    )
            elif request.voices:
                # Use provided voices
                for voice in request.voices:
                    await conn.execute(
                        "INSERT INTO model_voices (model_id, voice, active) VALUES ($1, $2::voice, true) ON CONFLICT (model_id, voice) DO UPDATE SET active = true, updated_at = NOW()",
                        request.modelId,
                        voice,
                    )

            # Update qualities if provided
            if request.qualities is not None:
                # Deactivate existing qualities
                await conn.execute(
                    "UPDATE model_qualities SET active = false, updated_at = NOW() WHERE model_id = $1",
                    request.modelId,
                )
                # Insert new qualities
                for quality in request.qualities:
                    await conn.execute(
                        "INSERT INTO model_qualities (model_id, quality, active) VALUES ($1, $2::quality, true) ON CONFLICT (model_id, quality) DO UPDATE SET active = true, updated_at = NOW()",
                        request.modelId,
                        quality,
                    )

            result_data = UpdateModelResponse(
                success=True,
                message=f"Model '{request.name}' updated successfully",
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
            operation="update_model",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
