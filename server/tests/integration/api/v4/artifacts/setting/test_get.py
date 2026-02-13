"""Integration tests for artifact setting get endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_SETTING_ID = "019b3be4-3c61-7699-b40c-29d4bcb6e2b3"
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"


class TestSettingGetNew:
    """Tests for GET /api/v4/artifacts/settings/get with no setting_id (new mode)."""

    async def test_get_new_returns_defaults(self, client: httpx.AsyncClient) -> None:
        """GET with no setting_id returns default sections for new setting."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/get",
            json={},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["setting_exists"] is None or data["setting_exists"] is False
        assert data["can_edit"] is not None

    async def test_get_new_returns_all_sections(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET new setting returns all 11 resource sections."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/get",
            json={},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        expected_sections = [
            "names",
            "descriptions",
            "colors",
            "flags",
            "departments",
            "profiles",
            "auths",
            "provider_keys",
            "auth_item_keys",
            "roles",
            "role_routes",
        ]
        for section in expected_sections:
            assert section in data, f"Missing section: {section}"

    async def test_get_new_sections_have_metadata(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET new setting sections include show/required/show_ai_generate metadata."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/get",
            json={},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        names_section = data["names"]
        assert "show" in names_section
        assert "required" in names_section
        assert "show_ai_generate" in names_section

    async def test_get_new_returns_actor_name(self, client: httpx.AsyncClient) -> None:
        """GET new setting returns actor_name from profile context."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/get",
            json={},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert response.json()["actor_name"] is not None


class TestSettingGetExisting:
    """Tests for GET /api/v4/artifacts/settings/get with existing setting_id."""

    async def test_get_existing_returns_setting(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET with seed setting_id returns setting data."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/get",
            json={"settings_id": SEED_SETTING_ID},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["setting_exists"] is True
        assert data["can_edit"] is True

    async def test_get_existing_has_name_resource(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET existing setting returns name resource from seed data."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/get",
            json={"settings_id": SEED_SETTING_ID},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        names = response.json()["names"]
        assert names["resource"] is not None
        assert names["resource"]["name"] == "Default Settings"

    async def test_get_existing_has_description_resource(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET existing setting returns description resource from seed data."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/get",
            json={"settings_id": SEED_SETTING_ID},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        descriptions = response.json()["descriptions"]
        assert descriptions["resource"] is not None

    async def test_get_existing_has_colors(self, client: httpx.AsyncClient) -> None:
        """GET existing setting returns colors from seed data."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/get",
            json={"settings_id": SEED_SETTING_ID},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        colors = response.json()["colors"]
        assert colors["current"] is not None
        assert len(colors["current"]) > 0

    async def test_get_existing_has_flags(self, client: httpx.AsyncClient) -> None:
        """GET existing setting returns enriched flag configs."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/get",
            json={"settings_id": SEED_SETTING_ID},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        flags = response.json()["flags"]
        assert flags["resources"] is not None
        # Flags should be enriched with key/label
        if flags["resources"]:
            first_flag = flags["resources"][0]
            assert "key" in first_flag
            assert "label" in first_flag

    async def test_get_existing_has_auths(self, client: httpx.AsyncClient) -> None:
        """GET existing setting returns auth resources from seed data."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/get",
            json={"settings_id": SEED_SETTING_ID},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        auths = response.json()["auths"]
        assert auths["current"] is not None
        assert len(auths["current"]) > 0

    async def test_get_existing_has_resource_agent_ids(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET existing setting returns resource_agent_ids mapping."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/get",
            json={"settings_id": SEED_SETTING_ID},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "resource_agent_ids" in data

    async def test_get_existing_returns_group_id(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET existing setting returns group_id field."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/get",
            json={"settings_id": SEED_SETTING_ID},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert "group_id" in response.json()


class TestSettingGetErrors:
    """Tests for GET /api/v4/artifacts/settings/get error cases."""

    async def test_get_nonexistent_returns_404(self, client: httpx.AsyncClient) -> None:
        """GET with nonexistent setting_id returns 404."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/get",
            json={"settings_id": ZEROED_UUID},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 404

    async def test_get_no_profile_returns_401(self, client: httpx.AsyncClient) -> None:
        """GET without X-Profile-Id returns 401."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/get",
            json={"settings_id": SEED_SETTING_ID},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 401
