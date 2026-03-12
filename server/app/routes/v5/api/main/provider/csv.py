"""Provider import endpoint — parses a CSV file and creates providers in one step.

Takes an upload_id (from a TUS-uploaded CSV), reads the file, auto-maps columns
to canonical provider fields, and delegates to the existing create_provider_impl.
"""

from __future__ import annotations

import csv
import io
import os
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.events.audit import run_artifact_operation_with_audit
from app.infra.globals import (
    UPLOAD_FOLDER,
    get_pool,
    get_redis_client,
    get_upload_folder,
)
from app.infra.provider.create import (
    CreateProviderApiResponse,
    CreateProviderItem,
    create_provider_impl,
)
from app.infra.provider.search import PROVIDER_IMPORT_FIELDS
from app.routes.v5.tools.entries.uploads.get import get_upload
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / response types
# ---------------------------------------------------------------------------


class ImportProviderApiRequest(BaseModel):
    """Request model — just the upload_id of a TUS-uploaded CSV."""

    upload_id: UUID


class ImportProviderApiResponse(CreateProviderApiResponse):
    """Extends create response with import metadata."""

    row_count: int = 0
    mapped_fields: list[str] = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _normalize(s: str) -> str:
    """Lowercase, strip whitespace and underscores for fuzzy header matching."""
    return s.strip().lower().replace("_", "").replace("-", "").replace(" ", "")


def _build_field_map(headers: list[str]) -> dict[int, dict[str, Any]]:
    """Auto-map CSV column indices to canonical import fields.

    Returns {column_index: field_def} for every matched column.
    """
    field_lookup: dict[str, dict[str, Any]] = {}
    for field in PROVIDER_IMPORT_FIELDS:
        field_lookup[_normalize(field["key"])] = field
        field_lookup[_normalize(field["label"])] = field

    mapping: dict[int, dict[str, Any]] = {}
    for idx, header in enumerate(headers):
        norm = _normalize(header)
        if norm in field_lookup:
            mapping[idx] = field_lookup[norm]
    return mapping


def _parse_bool(value: str) -> bool | None:
    """Parse boolean from CSV string."""
    v = value.strip().lower()
    if v in ("true", "yes", "1", "active"):
        return True
    if v in ("false", "no", "0", "inactive"):
        return False
    return None


def _row_to_item(
    row: list[str], field_map: dict[int, dict[str, Any]]
) -> CreateProviderItem:
    """Convert a single CSV row to a CreateProviderItem using the field map."""
    kwargs: dict[str, Any] = {}

    for col_idx, field_def in field_map.items():
        if col_idx >= len(row):
            continue
        raw = row[col_idx].strip()
        if not raw:
            continue

        key = field_def["key"]
        is_multi = field_def.get("multi", False)
        field_type = field_def.get("type", "string")

        if field_type == "boolean":
            kwargs[key] = _parse_bool(raw)
        elif is_multi:
            # Split on comma, strip each value
            kwargs[key] = [v.strip() for v in raw.split(",") if v.strip()]
        else:
            kwargs[key] = raw

    return CreateProviderItem(**kwargs)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.post("/csv", response_model=ImportProviderApiResponse)
async def import_providers(
    request: ImportProviderApiRequest,
    http_request: Request,
    response: Response,
) -> ImportProviderApiResponse:
    """Import providers from a CSV file.

    1. Reads the TUS-uploaded CSV
    2. Auto-maps columns to canonical provider fields
    3. Converts rows to CreateProviderItem objects
    4. Delegates to existing create_provider_impl
    """
    try:
        profile_id = http_request.state.profile_id
        session_id = http_request.state.session_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        pool = get_pool()
        redis = get_redis_client()

        # 1. Read the uploaded CSV file
        async with pool.acquire() as conn:
            upload = await get_upload(conn, request.upload_id)

        if upload is None:
            raise HTTPException(status_code=404, detail="Upload not found")

        stored_path = upload.file_path or ""
        file_path = os.path.join(UPLOAD_FOLDER, stored_path)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Upload file not found on disk")

        with open(file_path, encoding="utf-8-sig") as f:
            content = f.read()

        reader = csv.reader(io.StringIO(content))
        all_rows = list(reader)

        if len(all_rows) < 2:
            raise HTTPException(
                status_code=400,
                detail="CSV must have a header row and at least one data row",
            )

        headers = all_rows[0]
        data_rows = all_rows[1:]

        # 2. Auto-map columns to canonical fields
        field_map = _build_field_map(headers)

        if not field_map:
            raise HTTPException(
                status_code=400,
                detail="No CSV columns matched provider import fields. "
                f"Expected columns: {', '.join(f['label'] for f in PROVIDER_IMPORT_FIELDS)}",
            )

        mapped_fields = [field_map[idx]["key"] for idx in sorted(field_map.keys())]

        # Check required fields are mapped
        required_keys = {f["key"] for f in PROVIDER_IMPORT_FIELDS if f.get("required")}
        mapped_keys = {f["key"] for f in field_map.values()}
        missing = required_keys - mapped_keys
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing required columns: {', '.join(missing)}",
            )

        # 3. Convert rows to CreateProviderItem objects
        items = [_row_to_item(row, field_map) for row in data_rows]

        # 4. Delegate to existing create logic
        async def _runner() -> CreateProviderApiResponse:
            return await create_provider_impl(
                pool,
                redis,
                profile_id=profile_id,
                items=items,
                session_id=session_id,
            )

        create_response = await run_artifact_operation_with_audit(
            pool,
            redis,
            artifact="provider",
            profile_id=profile_id,
            session_id=session_id,
            operation="import",
            arguments={
                "upload_id": str(request.upload_id),
                "row_count": len(data_rows),
            },
            response_model=CreateProviderApiResponse,
            runner=_runner,
            upload_folder=get_upload_folder(),
        )

        response.headers["X-Invalidate-Tags"] = "providers"

        return ImportProviderApiResponse(
            results=create_response.results,
            row_count=len(data_rows),
            mapped_fields=mapped_fields,
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="import_providers",
            request=http_request,
        )
