"""
Tests for app.utils.analytics_query_builder
"""

from datetime import datetime

import pytest

from app.utils.analytics_query_builder import build_base_filter


class TestBuild_Base_Filter:
    """Tests for build_base_filter function."""

    def test_build_base_filter_minimal(self) -> None:
        """Test build_base_filter with only required date parameters."""
        start_date = "2024-01-01T00:00:00Z"
        end_date = "2024-01-31T23:59:59Z"

        where_clause, params = build_base_filter(start_date, end_date)

        assert "a.attempt_created_at >= $1" in where_clause
        assert "a.attempt_created_at < $2" in where_clause
        assert len(params) == 2
        assert isinstance(params[0], datetime)
        assert isinstance(params[1], datetime)
        assert "a.is_general = TRUE" in where_clause  # Default sim_filter

    def test_build_base_filter_date_without_z(self) -> None:
        """Test build_base_filter with dates without Z suffix."""
        start_date = "2024-01-01T00:00:00+00:00"
        end_date = "2024-01-31T23:59:59+00:00"

        where_clause, params = build_base_filter(start_date, end_date)

        assert len(params) == 2
        assert isinstance(params[0], datetime)
        assert isinstance(params[1], datetime)

    def test_build_base_filter_simulation_general(self) -> None:
        """Test build_base_filter with general simulation filter."""
        start_date = "2024-01-01T00:00:00Z"
        end_date = "2024-01-31T23:59:59Z"

        where_clause, params = build_base_filter(
            start_date, end_date, sim_filters=["general"]
        )

        assert "a.is_general = TRUE" in where_clause
        assert "a.is_practice = TRUE" not in where_clause

    def test_build_base_filter_simulation_practice(self) -> None:
        """Test build_base_filter with practice simulation filter."""
        start_date = "2024-01-01T00:00:00Z"
        end_date = "2024-01-31T23:59:59Z"

        where_clause, params = build_base_filter(
            start_date, end_date, sim_filters=["practice"]
        )

        assert "a.is_practice = TRUE" in where_clause
        assert "a.is_general = TRUE" not in where_clause

    def test_build_base_filter_simulation_both(self) -> None:
        """Test build_base_filter with both general and practice filters."""
        start_date = "2024-01-01T00:00:00Z"
        end_date = "2024-01-31T23:59:59Z"

        where_clause, params = build_base_filter(
            start_date, end_date, sim_filters=["general", "practice"]
        )

        assert "a.is_general = TRUE" in where_clause
        assert "a.is_practice = TRUE" in where_clause

    def test_build_base_filter_simulation_archived_only(self) -> None:
        """Test build_base_filter with archived filter only."""
        start_date = "2024-01-01T00:00:00Z"
        end_date = "2024-01-31T23:59:59Z"

        where_clause, params = build_base_filter(
            start_date, end_date, sim_filters=["archived"]
        )

        assert "a.is_archived = TRUE" in where_clause
        assert "a.is_general = TRUE" not in where_clause
        assert "a.is_practice = TRUE" not in where_clause

    def test_build_base_filter_simulation_archived_with_others(self) -> None:
        """Test build_base_filter with archived and other filters."""
        start_date = "2024-01-01T00:00:00Z"
        end_date = "2024-01-31T23:59:59Z"

        where_clause, params = build_base_filter(
            start_date, end_date, sim_filters=["general", "archived"]
        )

        assert "a.is_general = TRUE" in where_clause
        assert "(a.is_archived = TRUE OR (a.is_general = FALSE AND a.is_practice = FALSE))" in where_clause

    def test_build_base_filter_profile_id(self) -> None:
        """Test build_base_filter with profile_id filter."""
        start_date = "2024-01-01T00:00:00Z"
        end_date = "2024-01-31T23:59:59Z"
        profile_id = "profile-123"

        where_clause, params = build_base_filter(
            start_date, end_date, profile_id=profile_id
        )

        assert "a.profile_id = $3" in where_clause
        assert params[2] == profile_id
        assert len(params) == 3

    def test_build_base_filter_roles(self) -> None:
        """Test build_base_filter with roles filter."""
        start_date = "2024-01-01T00:00:00Z"
        end_date = "2024-01-31T23:59:59Z"
        roles = ["student", "teacher"]

        where_clause, params = build_base_filter(
            start_date, end_date, roles=roles
        )

        assert "a.profile_role = ANY($3)" in where_clause
        assert params[2] == roles
        assert len(params) == 3

    def test_build_base_filter_roles_with_profile_id(self) -> None:
        """Test build_base_filter with roles filter ignored when profile_id is set."""
        start_date = "2024-01-01T00:00:00Z"
        end_date = "2024-01-31T23:59:59Z"
        profile_id = "profile-123"
        roles = ["student", "teacher"]

        where_clause, params = build_base_filter(
            start_date, end_date, profile_id=profile_id, roles=roles
        )

        assert "a.profile_id = $3" in where_clause
        assert "a.profile_role = ANY" not in where_clause
        assert params[2] == profile_id
        assert len(params) == 3

    def test_build_base_filter_cohort_ids(self) -> None:
        """Test build_base_filter with cohort_ids filter."""
        start_date = "2024-01-01T00:00:00Z"
        end_date = "2024-01-31T23:59:59Z"
        cohort_ids = ["cohort-1", "cohort-2"]

        where_clause, params = build_base_filter(
            start_date, end_date, cohort_ids=cohort_ids
        )

        assert "(a.cohort_ids && $3 OR a.profile_cohort_ids && $3)" in where_clause
        assert params[2] == cohort_ids
        assert len(params) == 3

    def test_build_base_filter_department_ids(self) -> None:
        """Test build_base_filter with department_ids filter."""
        start_date = "2024-01-01T00:00:00Z"
        end_date = "2024-01-31T23:59:59Z"
        department_ids = ["dept-1", "dept-2"]

        where_clause, params = build_base_filter(
            start_date, end_date, department_ids=department_ids
        )

        assert "a.department_id = ANY($3)" in where_clause
        assert params[2] == department_ids
        assert len(params) == 3

    def test_build_base_filter_all_filters(self) -> None:
        """Test build_base_filter with all filters combined."""
        start_date = "2024-01-01T00:00:00Z"
        end_date = "2024-01-31T23:59:59Z"
        profile_id = "profile-123"
        cohort_ids = ["cohort-1"]
        department_ids = ["dept-1"]
        sim_filters = ["general", "practice"]

        where_clause, params = build_base_filter(
            start_date,
            end_date,
            profile_id=profile_id,
            cohort_ids=cohort_ids,
            department_ids=department_ids,
            sim_filters=sim_filters,
        )

        assert "a.profile_id = $3" in where_clause
        assert "(a.cohort_ids && $4 OR a.profile_cohort_ids && $4)" in where_clause
        assert "a.department_id = ANY($5)" in where_clause
        assert len(params) == 5
        assert params[2] == profile_id
        assert params[3] == cohort_ids
        assert params[4] == department_ids

    def test_build_base_filter_parameter_counter(self) -> None:
        """Test that parameter counter increments correctly."""
        start_date = "2024-01-01T00:00:00Z"
        end_date = "2024-01-31T23:59:59Z"
        profile_id = "profile-123"
        cohort_ids = ["cohort-1"]
        department_ids = ["dept-1"]

        where_clause, params = build_base_filter(
            start_date,
            end_date,
            profile_id=profile_id,
            cohort_ids=cohort_ids,
            department_ids=department_ids,
        )

        # Check parameter numbers are sequential
        assert "$1" in where_clause
        assert "$2" in where_clause
        assert "$3" in where_clause
        assert "$4" in where_clause
        assert "$5" in where_clause
        assert len(params) == 5

    def test_build_base_filter_none_values(self) -> None:
        """Test build_base_filter with None values for optional parameters."""
        start_date = "2024-01-01T00:00:00Z"
        end_date = "2024-01-31T23:59:59Z"

        where_clause, params = build_base_filter(
            start_date,
            end_date,
            cohort_ids=None,
            roles=None,
            sim_filters=None,
            profile_id=None,
            department_ids=None,
        )

        # Should only have date filters and default general filter
        assert len(params) == 2
        assert "a.is_general = TRUE" in where_clause

    def test_build_base_filter_empty_lists(self) -> None:
        """Test build_base_filter with empty lists."""
        start_date = "2024-01-01T00:00:00Z"
        end_date = "2024-01-31T23:59:59Z"

        where_clause, params = build_base_filter(
            start_date,
            end_date,
            cohort_ids=[],
            roles=[],
            sim_filters=[],
            department_ids=[],
        )

        # Empty lists should be treated as falsy, so no filters added
        assert len(params) == 2
        # Empty sim_filters should default to ["general"]
        assert "a.is_general = TRUE" in where_clause

