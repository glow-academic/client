"""Canonical pricing resource type — single source of truth for resource fields."""

from pydantic import BaseModel


class PricingResourceData(BaseModel):
    """Canonical pricing resource fields. All optional for streaming support."""

    id: str | None = None
    pricing_type: str | None = None
    price: float | None = None
    unit_name: str | None = None
    unit_category: str | None = None
    unit_value: int | None = None
    generated: bool | None = None
