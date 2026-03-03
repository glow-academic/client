"""Integration tests for artifact persona list endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}


class TestPersonaList:
    """Tests for POST /api/v5/artifacts/personas/list endpoint."""

    async def test_list_returns_personas(self, client: httpx.AsyncClient) -> None:
        """LIST returns personas from seed data."""
        response = await client.post(
            "/api/v5/artifacts/personas/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["personas"] is not None
        assert len(data["personas"]) > 0

    async def test_list_returns_actor_name(self, client: httpx.AsyncClient) -> None:
        """LIST returns actor_name from profile context."""
        response = await client.post(
            "/api/v5/artifacts/personas/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["actor_name"] is not None

    async def test_list_personas_have_permissions(
        self, client: httpx.AsyncClient
    ) -> None:
        """LIST personas include computed permission fields."""
        response = await client.post(
            "/api/v5/artifacts/personas/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        personas = data["personas"]
        assert len(personas) > 0
        first_persona = personas[0]
        assert "can_edit" in first_persona
        assert "can_delete" in first_persona
        assert "can_duplicate" in first_persona

    async def test_list_personas_have_core_fields(
        self, client: httpx.AsyncClient
    ) -> None:
        """LIST personas include core identifying fields."""
        response = await client.post(
            "/api/v5/artifacts/personas/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        personas = response.json()["personas"]
        assert len(personas) > 0
        first_persona = personas[0]
        assert "persona_id" in first_persona
        assert "name" in first_persona

    async def test_list_returns_scenario_filter(
        self, client: httpx.AsyncClient
    ) -> None:
        """LIST returns scenario_filter section."""
        response = await client.post(
            "/api/v5/artifacts/personas/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "scenario_filter" in data
        section = data["scenario_filter"]
        assert "options" in section

    async def test_list_returns_field_filter(self, client: httpx.AsyncClient) -> None:
        """LIST returns field_filter section."""
        response = await client.post(
            "/api/v5/artifacts/personas/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "field_filter" in data
        section = data["field_filter"]
        assert "options" in section

    async def test_list_returns_department_filter(
        self, client: httpx.AsyncClient
    ) -> None:
        """LIST returns department_filter section."""
        response = await client.post(
            "/api/v5/artifacts/personas/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "department_filter" in data
        section = data["department_filter"]
        assert "options" in section

    async def test_list_returns_total_count(self, client: httpx.AsyncClient) -> None:
        """LIST returns total_count for pagination."""
        response = await client.post(
            "/api/v5/artifacts/personas/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_count" in data
        assert data["total_count"] > 0

    async def test_list_no_profile_returns_401(self, client: httpx.AsyncClient) -> None:
        """LIST without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v5/artifacts/personas/list",
            json={},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
