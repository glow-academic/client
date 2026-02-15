"""Integration tests for artifact persona delete endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_PERSONA_ID = "019b3be4-36e2-770b-af4e-96c8cfa80851"
# Resource IDs for creating a persona to delete
SEED_NAME_ID = "019b995c-8e99-785b-9fa2-bd32bc0588c4"
SEED_COLOR_ID = "019b995b-52f6-7759-98be-647af770b92b"
SEED_ICON_ID = "019b995b-52f7-7520-8f5c-41db263f89ba"
SEED_INSTRUCTION_ID = "019b9bab-8a06-77a0-9952-4882df960ad7"
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"


class TestPersonaDelete:
    """Tests for POST /api/v4/artifacts/personas/delete endpoint."""

    async def test_delete_created_persona(self, client: httpx.AsyncClient) -> None:
        """DELETE a freshly created persona succeeds."""
        # Arrange — create a persona to delete
        save_payload = {
            "input_persona_id": None,
            "name_id": SEED_NAME_ID,
            "color_id": SEED_COLOR_ID,
            "icon_id": SEED_ICON_ID,
            "instructions_id": SEED_INSTRUCTION_ID,
        }
        save_response = await client.post(
            "/api/v4/artifacts/personas/save",
            json=save_payload,
            headers=HEADERS,
        )
        assert save_response.status_code == 200
        new_persona_id = save_response.json()["persona_id"]

        # Act
        response = await client.post(
            "/api/v4/artifacts/personas/delete",
            json={"persona_id": new_persona_id},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "deleted successfully" in data["message"]

    async def test_delete_nonexistent_returns_error(
        self, client: httpx.AsyncClient
    ) -> None:
        """DELETE with nonexistent persona_id returns error."""
        response = await client.post(
            "/api/v4/artifacts/personas/delete",
            json={"persona_id": ZEROED_UUID},
            headers=HEADERS,
        )

        assert response.status_code in (400, 404)


class TestPersonaDeleteErrors:
    """Tests for POST /api/v4/artifacts/personas/delete error cases."""

    async def test_delete_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """DELETE without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v4/artifacts/personas/delete",
            json={"persona_id": SEED_PERSONA_ID},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
