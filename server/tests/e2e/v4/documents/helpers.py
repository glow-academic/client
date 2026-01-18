"""Shared helpers for document E2E tests."""

from __future__ import annotations

import json
import os
import time
import uuid
from collections.abc import Iterable
from typing import Any

from playwright.sync_api import APIRequestContext

from server.tests.e2e.conftest import PROFILE_ID, _build_test_headers

API_BASE = os.getenv("E2E_API_BASE", "http://localhost:8000")
print(f"[E2E] Using profile_id={PROFILE_ID} api_base={API_BASE}")
_PROFILE_RESOLUTION_CACHE: dict[tuple[str, str], tuple[str, str]] = {}


def generate_unique_document_name(prefix: str = "E2E Document") -> str:
    """Return a unique document name for create/update flows."""
    timestamp = int(time.time() * 1000)
    suffix = uuid.uuid4().hex[:6]
    return f"{prefix} {timestamp}-{suffix}"


def _post_json(
    request: APIRequestContext,
    path: str,
    payload: dict[str, Any],
    *,
    profile_id: str,
    effective_profile_id: str | None,
    bypass_cache: bool,
) -> dict[str, Any]:
    effective_id = effective_profile_id or profile_id
    headers = {
        "Content-Type": "application/json",
        "X-Bypass-Cache": "1" if bypass_cache else "0",
        **_build_test_headers(profile_id, effective_id),
    }
    response = request.post(
        f"{API_BASE}{path}",
        headers=headers,
        data=json.dumps(payload),
    )
    if not response.ok:
        raise RuntimeError(
            f"Request to {path} failed with status {response.status}: {response.text()}"
        )
    return response.json()  # type: ignore[no-any-return]


def _resolve_profile_ids(
    request: APIRequestContext,
    *,
    profile_id: str,
    effective_profile_id: str | None,
    pathname: str = "/create/documents",
) -> tuple[str, str]:
    """Resolve profile IDs to ensure they are valid UUIDs."""
    effective = effective_profile_id or profile_id
    cache_key = (profile_id, effective)
    if cache_key in _PROFILE_RESOLUTION_CACHE:
        return _PROFILE_RESOLUTION_CACHE[cache_key]

    data = _post_json(
        request,
        "/api/v4/profile/context",
        {
            "actualProfileId": profile_id,
            "effectiveProfileId": effective,
            "pathname": pathname,
        },
        profile_id=profile_id,
        effective_profile_id=effective,
        bypass_cache=True,
    )
    resolved_actual = data["actualProfile"]["id"]
    resolved_effective = data["effectiveProfile"]["id"]
    print(
        f"[E2E] Resolved profile ids for ({profile_id}, {effective}) -> ({resolved_actual}, {resolved_effective})"
    )
    _PROFILE_RESOLUTION_CACHE[cache_key] = (resolved_actual, resolved_effective)
    return resolved_actual, resolved_effective


def fetch_documents_list(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch documents list via the signed API for the current profile."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v4/documents/list",
        {"profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_document_detail(
    request: APIRequestContext,
    document_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch document detail for editing flows."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v4/documents/detail",
        {"documentId": document_id, "profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def fetch_document_detail_bulk(
    request: APIRequestContext,
    document_ids: list[str],
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    bypass_cache: bool = True,
) -> dict[str, Any]:
    """Fetch bulk document details."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    return _post_json(
        request,
        "/api/v4/documents/detail-bulk",
        {"documentIds": document_ids, "profileId": resolved_effective},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=bypass_cache,
    )


def create_document_api(
    request: APIRequestContext,
    *,
    name: str,
    file_path: str | None = None,
    mime_type: str = "application/pdf",
    type: str = "homework",
    department_ids: list[str] | None = None,
    parameter_item_ids: list[str] | None = None,
    active: bool = True,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> str:
    """
    Create a document via the API using upload flow.

    Note: For E2E tests, this uses the upload endpoints. The file_path parameter
    is optional - if not provided, a test file path will be generated.
    For actual file uploads, you would need to implement the full TUS protocol.

    This is a simplified version for E2E tests - in practice, you may want to
    use existing documents from the test database or implement full file upload.
    """
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )

    # Generate unique file ID
    file_id = str(uuid.uuid4())

    # Use provided file_path or generate one
    if not file_path:
        # Generate a test file path (document will be created with this path)
        # In real E2E, you'd upload an actual file
        file_path = f"test_{file_id}.pdf"

    # Create upload using TUS protocol
    import base64

    metadata = {
        "filename": name,
        "filetype": mime_type,
        "fileId": file_id,
    }
    metadata_str = ",".join(
        f"{k} {base64.b64encode(v.encode()).decode()}" for k, v in metadata.items()
    )

    # Use TUS POST to create upload
    headers = _build_test_headers(
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )
    headers.update(
        {
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "100",  # Minimal size for test
            "Upload-Metadata": metadata_str,
        }
    )

    init_response = request.post(
        f"{API_BASE}/api/v4/uploads/upload",
        headers=headers,
    )

    if init_response.status != 201:
        raise ValueError(f"TUS upload creation failed: {init_response.status}")

    location = init_response.headers.get("location", "")
    upload_id = location.split("/")[-1] if location else None
    if not upload_id:
        raise ValueError("TUS upload response missing Location header")

    # Note: In a real implementation, you would upload the file content here
    # using TUS PATCH requests. For E2E tests, we'll try to finalize with
    # the test flag, but this may require the file to actually exist.
    # For now, this is a placeholder that structures the API calls correctly.

    # Finalize upload (this will create the document)
    # Note: This requires the file to exist in the upload directory
    # For E2E tests, you may need to ensure test files are available
    finalize_response = _post_json(
        request,
        "/api/v4/documents/upload/finalize",
        {
            "uploadId": upload_id,
            "fileId": file_id,
            "zip": False,
            "autoClassify": False,
            "csv": False,
            "test": True,  # Mark as test
            "profileId": resolved_effective,
            "departmentIds": department_ids or [],
            "parameterItemIds": parameter_item_ids or [],
        },
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )

    document_id = finalize_response.get("documentId")
    if not document_id:
        raise ValueError(
            f"Upload finalize response missing documentId. Response: {finalize_response}"
        )

    # Update document type and active status if needed
    # (upload sets defaults, we may need to update)
    update_payload: dict[str, Any] = {
        "type": type,
    }
    if department_ids:
        update_payload["department_id"] = department_ids[0] if department_ids else None
    if parameter_item_ids:
        update_payload["parameter_item_ids"] = parameter_item_ids

    update_document_api(
        request,
        document_id,
        update_payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
    )

    return str(document_id)


def update_document_api(
    request: APIRequestContext,
    document_id: str,
    updates: dict[str, Any],
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Update a document via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )

    # Fetch current document to merge updates
    current = fetch_document_detail(
        request,
        document_id,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=True,
    )

    # Build payload with required fields
    # Note: update endpoint only supports type, department_id, and parameter_item_ids
    # Name and active status updates would need to be done via SQL or different endpoint
    payload: dict[str, Any] = {
        "documentId": document_id,
        "type": updates.get("type", current.get("type", "homework")),
        "department_id": updates.get("department_id")
        or (current.get("department_ids") or [None])[0],
        "parameter_item_ids": updates.get(
            "parameter_item_ids", current.get("parameter_item_ids", [])
        ),
    }

    _post_json(
        request,
        "/api/v4/documents/update",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def bulk_update_documents_api(
    request: APIRequestContext,
    document_ids: list[str],
    updates: dict[str, Any],
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Bulk update documents via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )

    payload: dict[str, Any] = {
        "documentIds": document_ids,
        "type": updates.get("type", "__keep__"),
        "department_id": updates.get("department_id"),
        "parameter_item_ids": updates.get("parameter_item_ids", []),
    }

    _post_json(
        request,
        "/api/v4/documents/bulk-update",
        payload,
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def delete_document_api(
    request: APIRequestContext,
    document_id: str,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Delete a document via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v4/documents/delete",
        {"documentId": document_id},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def bulk_delete_documents_api(
    request: APIRequestContext,
    document_ids: list[str],
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
) -> None:
    """Bulk delete documents via the API."""
    resolved_actual, resolved_effective = _resolve_profile_ids(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
    )
    _post_json(
        request,
        "/api/v4/documents/bulk-delete",
        {"documentIds": document_ids},
        profile_id=resolved_actual,
        effective_profile_id=resolved_effective,
        bypass_cache=False,
    )


def find_editable_document(
    documents: Iterable[dict[str, Any]],
    *,
    require_department_specific: bool | None = None,
) -> dict[str, Any]:
    """Return the first document that matches edit requirements."""
    for document in documents:
        if not document.get("can_edit"):
            continue
        dept_ids = document.get("department_ids") or []
        if require_department_specific is None:
            return document
        is_dept_specific = bool(dept_ids)
        if require_department_specific is True and is_dept_specific:
            return document
        if require_department_specific is False and not is_dept_specific:
            return document
    raise ValueError("No matching editable document found in document list")


def find_existing_document(
    request: APIRequestContext,
    *,
    profile_id: str = PROFILE_ID,
    effective_profile_id: str | None = None,
    can_edit: bool | None = None,
    can_delete: bool | None = None,
) -> dict[str, Any] | None:
    """Find an existing document from the test database that matches criteria."""
    data = fetch_documents_list(
        request,
        profile_id=profile_id,
        effective_profile_id=effective_profile_id,
        bypass_cache=True,
    )
    documents = data.get("documents", [])

    for document in documents:
        if can_edit is not None and document.get("can_edit") != can_edit:
            continue
        if can_delete is not None and document.get("can_delete") != can_delete:
            continue
        return document

    return None
