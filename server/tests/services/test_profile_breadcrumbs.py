"""Unit tests for ProfileService breadcrumb parsing logic."""

from unittest.mock import MagicMock

import pytest
from app.services.profile_service import ProfileService


@pytest.fixture
def profile_service():
    """Create a ProfileService with a mocked connection for testing breadcrumb logic."""
    # Mock connection - not needed for breadcrumb tests since they're pure string manipulation
    mock_conn = MagicMock()
    return ProfileService(mock_conn)


class TestBreadcrumbSegmentFiltering:
    """Test segment filtering logic."""

    def test_should_drop_single_letter_segments(self, profile_service):
        """Single letter segments should be dropped (route markers)."""
        assert profile_service._should_drop_segment("c") is True
        assert profile_service._should_drop_segment("a") is True
        assert profile_service._should_drop_segment("s") is True
        assert profile_service._should_drop_segment("e") is True
        assert profile_service._should_drop_segment("p") is True
        assert profile_service._should_drop_segment("r") is True
        assert profile_service._should_drop_segment("d") is True

    def test_should_not_drop_valid_segments(self, profile_service):
        """Valid segments should not be dropped."""
        assert profile_service._should_drop_segment("home") is False
        assert profile_service._should_drop_segment("analytics") is False
        assert profile_service._should_drop_segment("cohorts") is False
        assert profile_service._should_drop_segment("123-456-789") is False


class TestBreadcrumbSectionGeneration:
    """Test section identifier generation from path segments."""

    def test_home_section(self, profile_service):
        """Home path should generate 'home' section."""
        assert profile_service._get_section_from_segments(["home"]) == "home"

    def test_analytics_sections(self, profile_service):
        """Analytics paths should generate correct sections."""
        assert profile_service._get_section_from_segments(["analytics"]) == "analytics"
        assert (
            profile_service._get_section_from_segments(["analytics", "dashboard"])
            == "dashboard"
        )
        assert (
            profile_service._get_section_from_segments(["analytics", "reports"])
            == "reports"
        )
        assert (
            profile_service._get_section_from_segments(["analytics", "pricing"])
            == "pricing"
        )

    def test_cohort_sections(self, profile_service):
        """Cohort paths should generate cohort-{id} sections."""
        assert profile_service._get_section_from_segments(["cohorts"]) == "cohorts"
        assert (
            profile_service._get_section_from_segments(["cohorts", "c", "abc-123"])
            == "cohort-abc-123"
        )
        assert (
            profile_service._get_section_from_segments(["cohorts", "e", "xyz-789"])
            == "cohort-xyz-789"
        )

    def test_create_sections(self, profile_service):
        """Create paths should generate correct sections."""
        assert profile_service._get_section_from_segments(["create"]) == "create"
        assert (
            profile_service._get_section_from_segments(["create", "scenarios"])
            == "scenarios"
        )
        assert (
            profile_service._get_section_from_segments(
                ["create", "scenarios", "s", "scn-123"]
            )
            == "scenario-scn-123"
        )
        assert (
            profile_service._get_section_from_segments(["create", "simulations"])
            == "simulations"
        )
        assert (
            profile_service._get_section_from_segments(
                ["create", "simulations", "s", "sim-456"]
            )
            == "simulation-sim-456"
        )
        assert (
            profile_service._get_section_from_segments(
                ["create", "personas", "a", "per-789"]
            )
            == "persona-per-789"
        )
        assert (
            profile_service._get_section_from_segments(
                ["create", "documents", "d", "doc-111"]
            )
            == "document-doc-111"
        )

    def test_management_sections(self, profile_service):
        """Management paths should generate correct sections."""
        assert (
            profile_service._get_section_from_segments(["management"]) == "management"
        )
        assert (
            profile_service._get_section_from_segments(["management", "staff"])
            == "staff"
        )
        assert (
            profile_service._get_section_from_segments(
                ["management", "staff", "p", "user-123"]
            )
            == "profile-user-123"
        )
        assert (
            profile_service._get_section_from_segments(["management", "parameters"])
            == "parameters"
        )
        assert (
            profile_service._get_section_from_segments(
                ["management", "parameters", "p", "param-456"]
            )
            == "parameter-param-456"
        )
        assert (
            profile_service._get_section_from_segments(["management", "rubrics"])
            == "rubrics"
        )
        assert (
            profile_service._get_section_from_segments(
                ["management", "rubrics", "r", "rub-789"]
            )
            == "rubric-rub-789"
        )
        assert (
            profile_service._get_section_from_segments(["management", "departments"])
            == "departments"
        )
        assert (
            profile_service._get_section_from_segments(
                ["management", "departments", "d", "dept-111"]
            )
            == "department-dept-111"
        )

    def test_system_sections(self, profile_service):
        """System paths should generate correct sections."""
        assert profile_service._get_section_from_segments(["system"]) == "system"
        assert (
            profile_service._get_section_from_segments(["system", "agents"]) == "agents"
        )
        assert (
            profile_service._get_section_from_segments(
                ["system", "agents", "a", "agent-123"]
            )
            == "agent-agent-123"
        )
        assert (
            profile_service._get_section_from_segments(["system", "providers"])
            == "providers"
        )
        assert (
            profile_service._get_section_from_segments(
                ["system", "providers", "p", "prov-456"]
            )
            == "provider-prov-456"
        )
        assert (
            profile_service._get_section_from_segments(["system", "feedback"])
            == "feedback"
        )
        assert profile_service._get_section_from_segments(["system", "logs"]) == "logs"
        assert (
            profile_service._get_section_from_segments(["system", "health"]) == "health"
        )

    def test_special_sections(self, profile_service):
        """Special path patterns (chat, attempt) should generate correct sections."""
        assert (
            profile_service._get_section_from_segments(["c", "chat-123"])
            == "chat-chat-123"
        )
        assert (
            profile_service._get_section_from_segments(["a", "attempt-456"])
            == "attempt-attempt-456"
        )
        assert profile_service._get_section_from_segments(["practice"]) == "practice"
        assert profile_service._get_section_from_segments(["progress"]) == "progress"
        assert profile_service._get_section_from_segments(["profile"]) == "profile"


class TestBreadcrumbTitleGeneration:
    """Test title generation from segments."""

    def test_main_section_titles(self, profile_service):
        """Main sections should have proper capitalized titles."""
        assert profile_service._get_title_from_segment("home") == "Home"
        assert profile_service._get_title_from_segment("analytics") == "Analytics"
        assert profile_service._get_title_from_segment("cohorts") == "Cohorts"
        assert profile_service._get_title_from_segment("create") == "Create"
        assert profile_service._get_title_from_segment("management") == "Management"
        assert profile_service._get_title_from_segment("system") == "System"
        assert profile_service._get_title_from_segment("profile") == "Profile"

    def test_subsection_titles(self, profile_service):
        """Subsections should have proper titles."""
        assert profile_service._get_title_from_segment("scenarios") == "Scenarios"
        assert profile_service._get_title_from_segment("simulations") == "Simulations"
        assert profile_service._get_title_from_segment("staff") == "Staff"
        assert profile_service._get_title_from_segment("parameters") == "Parameters"
        assert profile_service._get_title_from_segment("departments") == "Departments"
        assert profile_service._get_title_from_segment("agents") == "Agents"
        assert profile_service._get_title_from_segment("providers") == "Providers"
        assert profile_service._get_title_from_segment("logs") == "Logs"

    def test_id_truncation(self, profile_service):
        """Long IDs with dashes should be truncated."""
        long_id = "abc-123-def-456-ghi-789-jkl"
        assert profile_service._get_title_from_segment(long_id) == "abc-123-..."

    def test_short_id_capitalization(self, profile_service):
        """Short IDs should just be capitalized."""
        assert profile_service._get_title_from_segment("test") == "Test"
        assert profile_service._get_title_from_segment("abc123") == "Abc123"


class TestBreadcrumbParsing:
    """Test complete breadcrumb parsing from pathnames."""

    def test_home_breadcrumbs(self, profile_service):
        """Home path should generate single breadcrumb."""
        breadcrumbs = profile_service._parse_breadcrumbs("/home")
        assert len(breadcrumbs) == 1
        assert breadcrumbs[0].title == "Home"
        assert breadcrumbs[0].section == "home"

    def test_analytics_dashboard_breadcrumbs(self, profile_service):
        """Analytics dashboard should generate two breadcrumbs."""
        breadcrumbs = profile_service._parse_breadcrumbs("/analytics/dashboard")
        assert len(breadcrumbs) == 2
        assert breadcrumbs[0].title == "Analytics"
        assert breadcrumbs[0].section == "analytics"
        assert breadcrumbs[1].title == "Dashboard"
        assert breadcrumbs[1].section == "dashboard"

    def test_cohort_detail_breadcrumbs(self, profile_service):
        """Cohort detail path should skip single-letter 'c' segment."""
        breadcrumbs = profile_service._parse_breadcrumbs(
            "/cohorts/c/abc-123-def-456-ghi"
        )
        assert len(breadcrumbs) == 2
        assert breadcrumbs[0].title == "Cohorts"
        assert breadcrumbs[0].section == "cohorts"
        assert breadcrumbs[1].title == "abc-123-..."  # Truncated long ID (>15 chars)
        assert breadcrumbs[1].section == "cohort-abc-123-def-456-ghi"

    def test_scenario_edit_breadcrumbs(self, profile_service):
        """Scenario edit path should skip 's' marker."""
        breadcrumbs = profile_service._parse_breadcrumbs(
            "/create/scenarios/s/scenario-123"
        )
        assert len(breadcrumbs) == 3
        assert breadcrumbs[0].title == "Create"
        assert breadcrumbs[0].section == "create"
        assert breadcrumbs[1].title == "Scenarios"
        assert breadcrumbs[1].section == "scenarios"
        assert breadcrumbs[2].title == "Scenario-123"
        assert breadcrumbs[2].section == "scenario-scenario-123"

    def test_management_staff_profile_breadcrumbs(self, profile_service):
        """Management staff profile path should skip 'p' marker."""
        breadcrumbs = profile_service._parse_breadcrumbs("/management/staff/p/user-456")
        assert len(breadcrumbs) == 3
        assert breadcrumbs[0].title == "Management"
        assert breadcrumbs[0].section == "management"
        assert breadcrumbs[1].title == "Staff"
        assert breadcrumbs[1].section == "staff"
        assert breadcrumbs[2].title == "User-456"
        assert breadcrumbs[2].section == "profile-user-456"

    def test_system_agents_detail_breadcrumbs(self, profile_service):
        """System agents detail path should skip 'a' marker."""
        breadcrumbs = profile_service._parse_breadcrumbs("/system/agents/a/agent-789")
        assert len(breadcrumbs) == 3
        assert breadcrumbs[0].title == "System"
        assert breadcrumbs[0].section == "system"
        assert breadcrumbs[1].title == "Agents"
        assert breadcrumbs[1].section == "agents"
        assert breadcrumbs[2].title == "Agent-789"
        assert breadcrumbs[2].section == "agent-agent-789"

    def test_empty_path_breadcrumbs(self, profile_service):
        """Empty path should return empty breadcrumbs list."""
        breadcrumbs = profile_service._parse_breadcrumbs("/")
        assert len(breadcrumbs) == 0

    def test_practice_attempt_breadcrumbs(self, profile_service):
        """Practice attempt path should skip 'a' marker."""
        breadcrumbs = profile_service._parse_breadcrumbs("/practice/a/attempt-123")
        assert len(breadcrumbs) == 2
        assert breadcrumbs[0].title == "Practice"
        assert breadcrumbs[0].section == "practice"
        assert breadcrumbs[1].title == "Attempt-123"
        assert (
            breadcrumbs[1].section == "practice"
        )  # Practice attempts stay in practice section
