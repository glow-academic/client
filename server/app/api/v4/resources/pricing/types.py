"""Canonical pricing resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class PricingResourceData(BaseModel):
    """Canonical pricing resource fields. All optional for streaming support."""

    id: str | None = None
    pricing_type: str | None = None
    price: float | None = None
    unit_id: str | None = None
    generated: bool | None = None
