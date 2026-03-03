"""Canonical certificates entry type — single source of truth for entry fields."""

from uuid import UUID

from pydantic import BaseModel


class CertificatesEntryData(BaseModel):
    """Canonical certificates entry fields. All optional for streaming support."""

    id: str | None = None
    created_at: str | None = None
    upload_id: str | None = None


class CreateCertificatesEntryRequest(BaseModel):
    run_id: UUID
    upload_id: UUID


class CreateCertificatesEntryResponse(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID


class CreateCertificatesEntrySqlParams(BaseModel):
    run_id: UUID
    upload_id: UUID
    tool_id: UUID | None = None
    text_upload_id: UUID | None = None
    mcp: bool = False

    def to_tuple(self) -> tuple:
        return (self.run_id, self.upload_id, self.mcp)


class CreateCertificatesEntrySqlRow(BaseModel):
    id: UUID
    call_id: UUID
    message_id: UUID
