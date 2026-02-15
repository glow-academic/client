"""Integration tests for artifact persona save endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_PERSONA_ID = "019b3be4-36e2-770b-af4e-96c8cfa80851"
# Seed resource IDs from "Confused" persona
SEED_NAME_ID = "019b995c-8e99-785b-9fa2-bd32bc0588c4"
SEED_DESCRIPTION_ID = "019b995c-8e9a-77a8-a9dd-5f5f56922e12"
SEED_COLOR_ID = "019b995b-52f6-7759-98be-647af770b92b"
SEED_ICON_ID = "019b995b-52f7-7520-8f5c-41db263f89ba"
SEED_INSTRUCTION_ID = "019b9bab-8a06-77a0-9952-4882df960ad7"


def _build_save_request(
    persona_id: str | None = None,
    name_id: str = SEED_NAME_ID,
    color_id: str = SEED_COLOR_ID,
    icon_id: str = SEED_ICON_ID,
    instructions_id: str = SEED_INSTRUCTION_ID,
    description_id: str | None = SEED_DESCRIPTION_ID,
) -> dict:
    """Build a minimal valid save request."""
    return {
        "input_persona_id": persona_id,
        "name_id": name_id,
        "color_id": color_id,
        "icon_id": icon_id,
        "instructions_id": instructions_id,
        "description_id": description_id,
    }


class TestPersonaSaveCreate:
    """Tests for POST /api/v4/artifacts/personas/save (create mode)."""

    async def test_create_persona_success(self, client: httpx.AsyncClient) -> None:
        """SAVE with no input_persona_id creates a new persona."""
        payload = _build_save_request(persona_id=None)

        response = await client.post(
            "/api/v4/artifacts/personas/save",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["persona_id"] is not None

    async def test_create_persona_returns_message(
        self, client: httpx.AsyncClient
    ) -> None:
        """SAVE returns a success message."""
        payload = _build_save_request(persona_id=None)

        response = await client.post(
            "/api/v4/artifacts/personas/save",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        assert response.json()["message"] is not None


class TestPersonaSaveUpdate:
    """Tests for POST /api/v4/artifacts/personas/save (update mode)."""

    async def test_update_persona_success(self, client: httpx.AsyncClient) -> None:
        """SAVE with input_persona_id updates existing persona."""
        payload = _build_save_request(persona_id=SEED_PERSONA_ID)

        response = await client.post(
            "/api/v4/artifacts/personas/save",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["persona_id"] == SEED_PERSONA_ID


class TestPersonaSaveErrors:
    """Tests for POST /api/v4/artifacts/personas/save error cases."""

    async def test_save_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """SAVE without X-Profile-Id returns 401."""
        payload = _build_save_request(persona_id=None)

        response = await client.post(
            "/api/v4/artifacts/personas/save",
            json=payload,
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
