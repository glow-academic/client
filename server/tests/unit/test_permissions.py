"""
Tests for app.utils.permissions
"""

from app.infra.v4.permissions import (
    ROUTE_PERMISSIONS,
    get_available_subsections_for_role,
    get_redirect_path_for_role,
)


class TestGet_Available_Subsections_For_Role:
    """Tests for get_available_subsections_for_role function."""

    def test_get_available_subsections_for_role_guest(self) -> None:
        """Test get_available_subsections_for_role with guest role."""
        result = get_available_subsections_for_role("guest")
        assert isinstance(result, list)
        assert "practice" in result

    def test_get_available_subsections_for_role_ta(self) -> None:
        """Test get_available_subsections_for_role with member role."""
        result = get_available_subsections_for_role("member")
        assert isinstance(result, list)
        assert "home" in result
        assert "practice" in result

    def test_get_available_subsections_for_role_instructional(self) -> None:
        """Test get_available_subsections_for_role with instructional role."""
        result = get_available_subsections_for_role("instructional")
        assert isinstance(result, list)
        assert "analytics" in result
        assert "cohorts" in result

    def test_get_available_subsections_for_role_admin(self) -> None:
        """Test get_available_subsections_for_role with admin role."""
        result = get_available_subsections_for_role("admin")
        assert isinstance(result, list)
        assert "analytics" in result
        assert "training" in result
        assert "management" in result

    def test_get_available_subsections_for_role_superadmin(self) -> None:
        """Test get_available_subsections_for_role with superadmin role."""
        result = get_available_subsections_for_role("superadmin")
        assert isinstance(result, list)
        assert "system" in result


class TestGet_Redirect_Path_For_Role:
    """Tests for get_redirect_path_for_role function."""

    def test_get_redirect_path_for_role_guest(self) -> None:
        """Test get_redirect_path_for_role with guest role."""
        result = get_redirect_path_for_role("guest")
        assert result == "/practice"

    def test_get_redirect_path_for_role_ta(self) -> None:
        """Test get_redirect_path_for_role with member role."""
        result = get_redirect_path_for_role("member")
        assert result == "/home"

    def test_get_redirect_path_for_role_instructional(self) -> None:
        """Test get_redirect_path_for_role with instructional role."""
        result = get_redirect_path_for_role("instructional")
        assert result == "/analytics/dashboard"

    def test_get_redirect_path_for_role_admin(self) -> None:
        """Test get_redirect_path_for_role with admin role."""
        result = get_redirect_path_for_role("admin")
        assert result == "/analytics/dashboard"

    def test_get_redirect_path_for_role_superadmin(self) -> None:
        """Test get_redirect_path_for_role with superadmin role."""
        result = get_redirect_path_for_role("superadmin")
        assert result == "/analytics/dashboard"


class TestRoute_Permissions:
    """Tests for ROUTE_PERMISSIONS configuration."""

    def test_route_permissions_is_list(self) -> None:
        """Test that ROUTE_PERMISSIONS is a list."""
        assert isinstance(ROUTE_PERMISSIONS, list)
        assert len(ROUTE_PERMISSIONS) > 0

    def test_route_permissions_has_sections(self) -> None:
        """Test that ROUTE_PERMISSIONS has expected sections."""
        sections = [section.section for section in ROUTE_PERMISSIONS]
        assert "home" in sections
        assert "practice" in sections
        assert "analytics" in sections
