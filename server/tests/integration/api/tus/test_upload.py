"""Integration tests for TUS protocol upload endpoints.

These tests are database-agnostic since TUS endpoints operate purely on the filesystem.
"""

import base64
import json

import httpx
import pytest

from app.main import TUS_UPLOADS_DIR, fastapi_app


@pytest.fixture
async def client() -> httpx.AsyncClient:
    """Provide FastAPI TestClient without database dependency.

    TUS endpoints don't require database, so we can test them without db fixture.
    """
    transport = httpx.ASGITransport(app=fastapi_app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test"
    ) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def cleanup_uploads() -> None:
    """Clean up TUS uploads directory before and after each test."""
    # Clean up before test
    if TUS_UPLOADS_DIR.exists():
        for item in TUS_UPLOADS_DIR.iterdir():
            if item.is_dir():
                import shutil

                shutil.rmtree(item)
            else:
                item.unlink()

    yield

    # Clean up after test
    if TUS_UPLOADS_DIR.exists():
        for item in TUS_UPLOADS_DIR.iterdir():
            if item.is_dir():
                import shutil

                shutil.rmtree(item)
            else:
                item.unlink()


@pytest.mark.asyncio
async def test_tus_options_discovery(client: httpx.AsyncClient) -> None:
    """Test TUS OPTIONS request for protocol discovery."""
    response = await client.options("/api/v3/uploads/upload")

    assert response.status_code == 200
    assert response.headers["Tus-Resumable"] == "1.0.0"
    assert response.headers["Tus-Version"] == "1.0.0"
    assert "creation" in response.headers["Tus-Extension"]
    assert "termination" in response.headers["Tus-Extension"]
    assert "creation-with-upload" in response.headers["Tus-Extension"]
    assert response.headers["Tus-Max-Size"] == "1073741824"
    assert response.headers["Access-Control-Allow-Origin"] == "*"


@pytest.mark.asyncio
async def test_tus_post_create_upload(client: httpx.AsyncClient) -> None:
    """Test TUS POST request to create a new upload."""
    metadata = {"filename": "test.pdf", "filetype": "application/pdf"}
    metadata_str = ",".join(
        f"{k} {base64.b64encode(v.encode()).decode()}" for k, v in metadata.items()
    )

    response = await client.post(
        "/api/v3/uploads/upload",
        headers={
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "1024",
            "Upload-Metadata": metadata_str,
        },
    )

    assert response.status_code == 201
    assert response.headers["Tus-Resumable"] == "1.0.0"
    assert "Location" in response.headers

    # Extract upload_id from Location header
    location = response.headers["Location"]
    upload_id = location.split("/")[-1]

    # Verify upload directory was created
    upload_dir = TUS_UPLOADS_DIR / upload_id
    assert upload_dir.exists()
    assert (upload_dir / "metadata.json").exists()
    assert (upload_dir / "file").exists()
    assert (upload_dir / "info").exists()

    # Verify metadata was saved
    with open(upload_dir / "metadata.json") as f:
        saved_metadata = json.load(f)
        assert saved_metadata == metadata

    # Verify info file
    with open(upload_dir / "info") as f:
        info_content = f.read()
        assert "length:1024" in info_content
        assert "offset:0" in info_content


@pytest.mark.asyncio
async def test_tus_post_create_with_upload(client: httpx.AsyncClient) -> None:
    """Test TUS POST request with initial chunk (creation-with-upload)."""
    metadata = {"filename": "test.pdf"}
    metadata_str = ",".join(
        f"{k} {base64.b64encode(v.encode()).decode()}" for k, v in metadata.items()
    )
    chunk_data = b"test chunk data"

    response = await client.post(
        "/api/v3/uploads/upload",
        headers={
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "1024",
            "Upload-Metadata": metadata_str,
            "Content-Length": str(len(chunk_data)),
        },
        content=chunk_data,
    )

    assert response.status_code == 201
    assert response.headers["Tus-Resumable"] == "1.0.0"
    assert "Location" in response.headers
    assert response.headers["Upload-Offset"] == str(len(chunk_data))

    # Extract upload_id from Location header
    location = response.headers["Location"]
    upload_id = location.split("/")[-1]

    # Verify file contains the chunk
    upload_dir = TUS_UPLOADS_DIR / upload_id
    with open(upload_dir / "file", "rb") as f:
        assert f.read() == chunk_data

    # Verify offset was updated
    with open(upload_dir / "info") as f:
        info_content = f.read()
        assert f"offset:{len(chunk_data)}" in info_content


@pytest.mark.asyncio
async def test_tus_post_missing_upload_length(client: httpx.AsyncClient) -> None:
    """Test TUS POST request without Upload-Length header."""
    response = await client.post(
        "/api/v3/uploads/upload",
        headers={"Tus-Resumable": "1.0.0"},
    )

    assert response.status_code == 400
    assert "Missing Upload-Length header" in response.text


@pytest.mark.asyncio
async def test_tus_post_wrong_version(client: httpx.AsyncClient) -> None:
    """Test TUS POST request with wrong TUS version."""
    response = await client.post(
        "/api/v3/uploads/upload",
        headers={
            "Tus-Resumable": "0.9.0",
            "Upload-Length": "1024",
        },
    )

    assert response.status_code == 412
    assert response.headers["Tus-Version"] == "1.0.0"


@pytest.mark.asyncio
async def test_tus_head_get_upload_info(client: httpx.AsyncClient) -> None:
    """Test TUS HEAD request to get upload status."""
    # First create an upload
    metadata = {"filename": "test.pdf"}
    metadata_str = ",".join(
        f"{k} {base64.b64encode(v.encode()).decode()}" for k, v in metadata.items()
    )

    create_response = await client.post(
        "/api/v3/uploads/upload",
        headers={
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "1024",
            "Upload-Metadata": metadata_str,
        },
    )
    upload_id = create_response.headers["Location"].split("/")[-1]

    # Now get upload info
    response = await client.head(
        f"/api/v3/uploads/upload/{upload_id}",
        headers={"Tus-Resumable": "1.0.0"},
    )

    assert response.status_code == 200
    assert response.headers["Tus-Resumable"] == "1.0.0"
    assert response.headers["Upload-Length"] == "1024"
    assert response.headers["Upload-Offset"] == "0"
    assert response.headers["Cache-Control"] == "no-store"


@pytest.mark.asyncio
async def test_tus_head_nonexistent_upload(client: httpx.AsyncClient) -> None:
    """Test TUS HEAD request for non-existent upload."""
    response = await client.head(
        "/api/v3/uploads/upload/nonexistent-id",
        headers={"Tus-Resumable": "1.0.0"},
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_tus_patch_upload_chunk(client: httpx.AsyncClient) -> None:
    """Test TUS PATCH request to upload a chunk."""
    # First create an upload
    metadata = {"filename": "test.pdf"}
    metadata_str = ",".join(
        f"{k} {base64.b64encode(v.encode()).decode()}" for k, v in metadata.items()
    )

    create_response = await client.post(
        "/api/v3/uploads/upload",
        headers={
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "1024",
            "Upload-Metadata": metadata_str,
        },
    )
    upload_id = create_response.headers["Location"].split("/")[-1]

    # Upload first chunk
    chunk1 = b"chunk 1 data"
    response = await client.patch(
        f"/api/v3/uploads/upload/{upload_id}",
        headers={
            "Tus-Resumable": "1.0.0",
            "Content-Type": "application/offset+octet-stream",
            "Upload-Offset": "0",
        },
        content=chunk1,
    )

    assert response.status_code == 200
    assert response.headers["Tus-Resumable"] == "1.0.0"
    assert response.headers["Upload-Offset"] == str(len(chunk1))

    # Upload second chunk
    chunk2 = b"chunk 2 data"
    response = await client.patch(
        f"/api/v3/uploads/upload/{upload_id}",
        headers={
            "Tus-Resumable": "1.0.0",
            "Content-Type": "application/offset+octet-stream",
            "Upload-Offset": str(len(chunk1)),
        },
        content=chunk2,
    )

    assert response.status_code == 200
    assert response.headers["Upload-Offset"] == str(len(chunk1) + len(chunk2))

    # Verify file contains both chunks
    upload_dir = TUS_UPLOADS_DIR / upload_id
    with open(upload_dir / "file", "rb") as f:
        file_content = f.read()
        assert file_content == chunk1 + chunk2


@pytest.mark.asyncio
async def test_tus_patch_wrong_offset(client: httpx.AsyncClient) -> None:
    """Test TUS PATCH request with wrong offset."""
    # First create an upload
    metadata = {"filename": "test.pdf"}
    metadata_str = ",".join(
        f"{k} {base64.b64encode(v.encode()).decode()}" for k, v in metadata.items()
    )

    create_response = await client.post(
        "/api/v3/uploads/upload",
        headers={
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "1024",
            "Upload-Metadata": metadata_str,
        },
    )
    upload_id = create_response.headers["Location"].split("/")[-1]

    # Try to upload with wrong offset
    response = await client.patch(
        f"/api/v3/uploads/upload/{upload_id}",
        headers={
            "Tus-Resumable": "1.0.0",
            "Content-Type": "application/offset+octet-stream",
            "Upload-Offset": "100",  # Wrong offset
        },
        content=b"chunk data",
    )

    assert response.status_code == 409  # Conflict


@pytest.mark.asyncio
async def test_tus_patch_missing_content_type(client: httpx.AsyncClient) -> None:
    """Test TUS PATCH request without correct Content-Type."""
    # First create an upload
    metadata = {"filename": "test.pdf"}
    metadata_str = ",".join(
        f"{k} {base64.b64encode(v.encode()).decode()}" for k, v in metadata.items()
    )

    create_response = await client.post(
        "/api/v3/uploads/upload",
        headers={
            "Tus-Resumable": "1.0.0",
            "Upload-Length": "1024",
            "Upload-Metadata": metadata_str,
        },
    )
    upload_id = create_response.headers["Location"].split("/")[-1]

    # Try to upload without correct Content-Type
    response = await client.patch(
        f"/api/v3/uploads/upload/{upload_id}",
        headers={
            "Tus-Resumable": "1.0.0",
            "Content-Type": "application/json",  # Wrong content type
            "Upload-Offset": "0",
        },
        content=b"chunk data",
    )

    assert response.status_code == 415  # Unsupported Media Type


@pytest.mark.asyncio
async def test_tus_options_upload_id(client: httpx.AsyncClient) -> None:
    """Test TUS OPTIONS request for specific upload."""
    response = await client.options("/api/v3/uploads/upload/test-upload-id")

    assert response.status_code == 200
    assert response.headers["Tus-Resumable"] == "1.0.0"
    assert response.headers["Tus-Version"] == "1.0.0"
    assert response.headers["Access-Control-Allow-Origin"] == "*"
