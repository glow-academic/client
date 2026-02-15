"""Integration tests for artifact persona get endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_PERSONA_ID = "019b3be4-36e2-770b-af4e-96c8cfa80851"
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"


class TestPersonaGetNew:
    """Tests for POST /api/v4/artifacts/personas/get with no persona_id (new mode)."""

    async def test_get_new_returns_defaults(self, client: httpx.AsyncClient) -> None:
        """GET with no persona_id returns default sections for new persona."""
        response = await client.post(
            "/api/v4/artifacts/personas/get",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text[:500]}"
        )
        data = response.json()
        assert data["persona_exists"] is None or data["persona_exists"] is False
        assert data["can_edit"] is not None

    async def test_get_new_returns_all_sections(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET new persona returns all resource sections."""
        response = await client.post(
            "/api/v4/artifacts/personas/get",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        expected_sections = [
            "names",
            "descriptions",
            "colors",
            "icons",
            "instructions",
            "flags",
            "departments",
            "parameter_fields",
            "examples",
            "parameters",
        ]
        for section in expected_sections:
            assert section in data, f"Missing section: {section}"

    async def test_get_new_sections_have_metadata(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET new persona sections include show/required/show_ai_generate metadata."""
        response = await client.post(
            "/api/v4/artifacts/personas/get",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        names_section = data["names"]
        assert "show" in names_section
        assert "required" in names_section
        assert "show_ai_generate" in names_section

    async def test_get_new_returns_actor_name(self, client: httpx.AsyncClient) -> None:
        """GET new persona returns actor_name from profile context."""
        response = await client.post(
            "/api/v4/artifacts/personas/get",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        assert response.json()["actor_name"] is not None


class TestPersonaGetExisting:
    """Tests for POST /api/v4/artifacts/personas/get with existing persona_id."""

    async def test_get_existing_returns_persona(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET with seed persona_id returns persona data."""
        response = await client.post(
            "/api/v4/artifacts/personas/get",
            json={"persona_id": SEED_PERSONA_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["persona_exists"] is True
        assert data["can_edit"] is True

    async def test_get_existing_has_name_resource(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET existing persona returns name resource from seed data."""
        response = await client.post(
            "/api/v4/artifacts/personas/get",
            json={"persona_id": SEED_PERSONA_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        names = response.json()["names"]
        assert names["resource"] is not None
        assert names["resource"]["name"] == "Confused"

    async def test_get_existing_has_description_resource(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET existing persona returns description resource from seed data."""
        response = await client.post(
            "/api/v4/artifacts/personas/get",
            json={"persona_id": SEED_PERSONA_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        descriptions = response.json()["descriptions"]
        assert descriptions["resource"] is not None

    async def test_get_existing_has_colors(self, client: httpx.AsyncClient) -> None:
        """GET existing persona returns color from seed data."""
        response = await client.post(
            "/api/v4/artifacts/personas/get",
            json={"persona_id": SEED_PERSONA_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        colors = response.json()["colors"]
        assert colors["resource"] is not None

    async def test_get_existing_has_icons(self, client: httpx.AsyncClient) -> None:
        """GET existing persona returns icon from seed data."""
        response = await client.post(
            "/api/v4/artifacts/personas/get",
            json={"persona_id": SEED_PERSONA_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        icons = response.json()["icons"]
        assert icons["resource"] is not None

    async def test_get_existing_has_instructions(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET existing persona returns instruction resource from seed data."""
        response = await client.post(
            "/api/v4/artifacts/personas/get",
            json={"persona_id": SEED_PERSONA_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        instructions = response.json()["instructions"]
        assert instructions["resource"] is not None

    async def test_get_existing_has_flags(self, client: httpx.AsyncClient) -> None:
        """GET existing persona returns enriched flag configs."""
        response = await client.post(
            "/api/v4/artifacts/personas/get",
            json={"persona_id": SEED_PERSONA_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        flags = response.json()["flags"]
        assert flags["resources"] is not None
        if flags["resources"]:
            first_flag = flags["resources"][0]
            assert "key" in first_flag
            assert "label" in first_flag

    async def test_get_existing_returns_group_id(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET existing persona returns group_id field."""
        response = await client.post(
            "/api/v4/artifacts/personas/get",
            json={"persona_id": SEED_PERSONA_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        assert "group_id" in response.json()


class TestPersonaGetErrors:
    """Tests for POST /api/v4/artifacts/personas/get error cases."""

    async def test_get_nonexistent_returns_404(self, client: httpx.AsyncClient) -> None:
        """GET with nonexistent persona_id returns 404."""
        response = await client.post(
            "/api/v4/artifacts/personas/get",
            json={"persona_id": ZEROED_UUID},
            headers=HEADERS,
        )

        assert response.status_code == 404

    async def test_get_no_profile_returns_401(self, client: httpx.AsyncClient) -> None:
        """GET without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v4/artifacts/personas/get",
            json={"persona_id": SEED_PERSONA_ID},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
