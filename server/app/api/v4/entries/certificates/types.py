"""Canonical certificates entry type — single source of truth for entry fields."""

from pydantic import BaseModel


class CertificatesEntryData(BaseModel):
    """Canonical certificates entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    upload_id: str | None = None
