"""
Tests for app.routes.profiles

Auto-generated on: 2025-06-10T16:21:22.276313
Updated with report customization tests
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch, mock_open
from sqlmodel import Session
from app.main import app
from server.app.routes.profiles import (
    create_student_type_chart,
    create_student_type_performance,
    create_score_radar_chart,
    create_time_series_chart,
)
from datetime import datetime

# Import the router being tested


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


@pytest.fixture
def mock_user():
    """Create a mock user object."""
    return MagicMock(
        id="test-user-id", name="Test User", username="testuser", role="ta"
    )


@pytest.fixture
def mock_attempts():
    """Create mock simulation attempts."""
    return [
        MagicMock(id="attempt-1", profile_id="test-user-id"),
        MagicMock(id="attempt-2", profile_id="test-user-id"),
    ]


@pytest.fixture
def mock_chats():
    """Create mock simulation chats."""
    return [
        MagicMock(
            id="chat-1",
            attempt_id="attempt-1",
            scenario_id="scenario-1",
            completed=True,
        ),
        MagicMock(
            id="chat-2",
            attempt_id="attempt-2",
            scenario_id="scenario-2",
            completed=True,
        ),
    ]


@pytest.fixture
def mock_grades():
    """Create mock simulation chat grades."""
    return [
        MagicMock(
            id="grade-1",
            simulation_chat_id="chat-1",
            score=85,
            time_taken=3600,
            passed=True,
            created_at=datetime(2023, 1, 1),
        ),
        MagicMock(
            id="grade-2",
            simulation_chat_id="chat-2",
            score=75,
            time_taken=4200,
            passed=True,
            created_at=datetime(2023, 1, 2),
        ),
    ]


@pytest.fixture
def mock_feedbacks():
    """Create mock simulation chat feedbacks."""
    return [
        MagicMock(
            id="feedback-1",
            simulation_chat_grade_id="grade-1",
            standard_id="standard-1",
            total=8,
            feedback="Good performance",
        ),
        MagicMock(
            id="feedback-2",
            simulation_chat_grade_id="grade-2",
            standard_id="standard-2",
            total=7,
            feedback="Needs improvement",
        ),
    ]


@pytest.fixture
def mock_rubrics():
    """Create mock rubrics."""
    return [
        MagicMock(id="rubric-1", name="TA Performance Rubric"),
    ]


@pytest.fixture
def mock_standard_groups():
    """Create mock standard groups."""
    return [
        MagicMock(
            id="group-1", name="Communication", short_name="Comm", rubric_id="rubric-1"
        ),
        MagicMock(
            id="group-2",
            name="Technical Skills",
            short_name="Tech",
            rubric_id="rubric-1",
        ),
    ]


@pytest.fixture
def mock_standards():
    """Create mock standards."""
    return [
        MagicMock(
            id="standard-1", name="Listening", standard_group_id="group-1", points=10
        ),
        MagicMock(
            id="standard-2",
            name="Problem Solving",
            standard_group_id="group-2",
            points=10,
        ),
    ]


@pytest.fixture
def mock_scenarios():
    """Create mock scenarios."""
    return [
        MagicMock(id="scenario-1", agent_id="agent-1", name="Happy Student"),
        MagicMock(id="scenario-2", agent_id="agent-2", name="Confused Student"),
    ]


@pytest.fixture
def mock_agents():
    """Create mock agents."""
    return [
        MagicMock(id="agent-1", name="happy"),
        MagicMock(id="agent-2", name="confused"),
    ]


class TestGet_Report:
    """Tests for get_report endpoint."""

    @patch("app.routes.profiles.select")
    @patch("tempfile.TemporaryDirectory")
    @patch("app.routes.profiles.create_student_type_chart")
    @patch("app.routes.profiles.create_student_type_performance")
    @patch("app.routes.profiles.create_score_radar_chart")
    @patch("app.routes.profiles.create_time_series_chart")
    @patch("app.routes.profiles.Document")
    def test_get_report_success_all_options(
        self,
        mock_document,
        mock_time_chart,
        mock_radar_chart,
        mock_performance_chart,
        mock_student_chart,
        mock_temp_dir,
        mock_select,
        client,
        mock_session,
        mock_user,
        mock_attempts,
        mock_chats,
        mock_grades,
        mock_feedbacks,
        mock_rubrics,
        mock_standard_groups,
        mock_standards,
        mock_scenarios,
        mock_agents,
    ):
        """Test successful get_report request with all options enabled."""
        # Setup mocks
        mock_temp_dir.return_value.__enter__.return_value = "/tmp/test"

        # Create mock simulations
        mock_simulations = [
            MagicMock(id="sim1", title="Test Simulation 1"),
            MagicMock(id="sim2", title="Test Simulation 2"),
        ]

        # Mock database queries in the order they appear in the code
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=lambda: mock_user),  # User query
            mock_attempts,  # Attempts query
            mock_chats,  # Chats query
            mock_grades,  # Grades query
            mock_feedbacks,  # Feedbacks query
            mock_rubrics,  # Rubrics query
            mock_standard_groups,  # Standard groups query
            mock_standards,  # Standards query
            mock_agents,  # Agents query (new)
            mock_simulations,  # Simulations query (new)
            MagicMock(one_or_none=lambda: mock_scenarios[0]),  # First scenario query
            MagicMock(one_or_none=lambda: mock_agents[0]),  # First agent query
            MagicMock(one_or_none=lambda: mock_scenarios[1]),  # Second scenario query
            MagicMock(one_or_none=lambda: mock_agents[1]),  # Second agent query
            MagicMock(
                one_or_none=lambda: mock_scenarios[0]
            ),  # Scenario query for performance
            MagicMock(
                one_or_none=lambda: mock_agents[0]
            ),  # Agent query for performance
            MagicMock(
                one_or_none=lambda: mock_scenarios[1]
            ),  # Scenario query for performance
            MagicMock(
                one_or_none=lambda: mock_agents[1]
            ),  # Agent query for performance
            MagicMock(
                one_or_none=lambda: mock_scenarios[0]
            ),  # Scenario query for agent descriptions
            MagicMock(
                one_or_none=lambda: mock_scenarios[1]
            ),  # Scenario query for agent descriptions
        ]

        # Mock PDF generation
        mock_doc_instance = MagicMock()
        mock_document.return_value = mock_doc_instance

        # Mock file reading
        with patch("builtins.open", mock_open(read_data=b"fake pdf content")):
            with patch("app.routes.profiles.get_session", return_value=mock_session):
                response = client.get(
                    "/profiles/test-user-id",
                    params={
                        "includeStudentTypeChart": True,
                        "includePerformanceChart": True,
                        "includeRadarChart": True,
                        "includeTimeChart": True,
                        "includeDetailedScores": True,
                        "includeFeedback": True,
                    },
                )

        # Assertions
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert "attachment; filename=" in response.headers["content-disposition"]

        # Verify chart creation functions were called
        mock_student_chart.assert_called_once()
        mock_performance_chart.assert_called_once()
        mock_radar_chart.assert_called_once()
        mock_time_chart.assert_called_once()

        # Verify PDF document was created and generated
        mock_document.assert_called_once()
        mock_doc_instance.generate_pdf.assert_called_once_with(clean_tex=True)

    @patch("app.routes.profiles.select")
    @patch("tempfile.TemporaryDirectory")
    @patch("app.routes.profiles.create_student_type_chart")
    @patch("app.routes.profiles.create_student_type_performance")
    @patch("app.routes.profiles.create_score_radar_chart")
    @patch("app.routes.profiles.create_time_series_chart")
    @patch("app.routes.profiles.Document")
    def test_get_report_success_minimal_options(
        self,
        mock_document,
        mock_time_chart,
        mock_radar_chart,
        mock_performance_chart,
        mock_student_chart,
        mock_temp_dir,
        mock_select,
        client,
        mock_session,
        mock_user,
        mock_attempts,
        mock_chats,
        mock_grades,
        mock_feedbacks,
        mock_rubrics,
        mock_standard_groups,
        mock_standards,
    ):
        """Test successful get_report request with minimal options."""
        # Setup mocks
        mock_temp_dir.return_value.__enter__.return_value = "/tmp/test"

        # Mock database queries
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=lambda: mock_user),  # User query
            mock_attempts,  # Attempts query
            mock_chats,  # Chats query
            mock_grades,  # Grades query
            mock_feedbacks,  # Feedbacks query
            mock_rubrics,  # Rubrics query
            mock_standard_groups,  # Standard groups query
            mock_standards,  # Standards query
        ]

        # Mock PDF generation
        mock_doc_instance = MagicMock()
        mock_document.return_value = mock_doc_instance

        # Mock file reading
        with patch("builtins.open", mock_open(read_data=b"fake pdf content")):
            with patch("app.routes.profiles.get_session", return_value=mock_session):
                response = client.get(
                    "/profiles/test-user-id",
                    params={
                        "includeStudentTypeChart": False,
                        "includePerformanceChart": False,
                        "includeRadarChart": False,
                        "includeTimeChart": False,
                        "includeDetailedScores": False,
                        "includeFeedback": False,
                    },
                )

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"

        # Verify chart creation functions were NOT called
        mock_student_chart.assert_not_called()
        mock_performance_chart.assert_not_called()
        mock_radar_chart.assert_not_called()
        mock_time_chart.assert_not_called()

    def test_get_report_user_not_found(self, client, mock_session):
        """Test get_report when user is not found."""
        # Mock user not found
        mock_session.exec.return_value.one_or_none.return_value = None

        with patch("app.routes.profiles.get_session", return_value=mock_session):
            response = client.get("/profiles/nonexistent-user-id")

        assert response.status_code == 404
        assert response.json()["detail"] == "User not found"

    def test_get_report_no_attempts(self, client, mock_session, mock_user):
        """Test get_report when user has no attempts."""
        # Mock user found but no attempts
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=lambda: mock_user),  # User query
            [],  # Empty attempts
        ]

        with patch("app.routes.profiles.get_session", return_value=mock_session):
            response = client.get("/profiles/test-user-id")

        assert response.status_code == 404
        assert response.json()["detail"] == "No attempts found for this user"

    def test_get_report_no_chats(self, client, mock_session, mock_user, mock_attempts):
        """Test get_report when user has no chats."""
        # Mock user and attempts found but no chats
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=lambda: mock_user),  # User query
            mock_attempts,  # Attempts query
            [],  # Empty chats
        ]

        with patch("app.routes.profiles.get_session", return_value=mock_session):
            response = client.get("/profiles/test-user-id")

        assert response.status_code == 404
        assert response.json()["detail"] == "No chats found for this user"

    @patch("app.routes.profiles.select")
    @patch("tempfile.TemporaryDirectory")
    @patch("app.routes.profiles.Document")
    def test_get_report_with_default_parameters(
        self,
        mock_document,
        mock_temp_dir,
        mock_select,
        client,
        mock_session,
        mock_user,
        mock_attempts,
        mock_chats,
        mock_grades,
        mock_feedbacks,
        mock_rubrics,
        mock_standard_groups,
        mock_standards,
    ):
        """Test get_report with default parameters (all True)."""
        # Setup mocks
        mock_temp_dir.return_value.__enter__.return_value = "/tmp/test"

        # Mock database queries
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=lambda: mock_user),  # User query
            mock_attempts,  # Attempts query
            mock_chats,  # Chats query
            mock_grades,  # Grades query
            mock_feedbacks,  # Feedbacks query
            mock_rubrics,  # Rubrics query
            mock_standard_groups,  # Standard groups query
            mock_standards,  # Standards query
        ]

        # Mock PDF generation
        mock_doc_instance = MagicMock()
        mock_document.return_value = mock_doc_instance

        # Mock file reading
        with patch("builtins.open", mock_open(read_data=b"fake pdf content")):
            with patch("app.routes.profiles.get_session", return_value=mock_session):
                response = client.get("/profiles/test-user-id")

        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"


class TestGenerate_Report:
    """Tests for generate_report endpoint."""

    @patch("app.routes.profiles.get_report")
    def test_generate_report_success(self, mock_get_report, client, mock_session):
        """Test successful generate_report request."""
        # Mock the get_report function
        mock_response = MagicMock()
        mock_get_report.return_value = mock_response

        with patch("app.routes.profiles.get_session", return_value=mock_session):
            response = client.post(
                "/profiles/test-user-id",
                params={
                    "includeStudentTypeChart": True,
                    "includePerformanceChart": False,
                    "includeRadarChart": True,
                    "includeTimeChart": False,
                    "includeDetailedScores": True,
                    "includeFeedback": False,
                },
            )

        # Verify get_report was called with correct parameters
        mock_get_report.assert_called_once_with(
            "test-user-id",
            mock_session,
            True,  # includeStudentTypeChart
            False,  # includePerformanceChart
            True,  # includeRadarChart
            False,  # includeTimeChart
            True,  # includeDetailedScores
            False,  # includeFeedback
        )

    @patch("app.routes.profiles.get_report")
    def test_generate_report_with_defaults(self, mock_get_report, client, mock_session):
        """Test generate_report with default parameters."""
        mock_response = MagicMock()
        mock_get_report.return_value = mock_response

        with patch("app.routes.profiles.get_session", return_value=mock_session):
            response = client.post("/profiles/test-user-id")  # No query params

        # Verify get_report was called with default True values
        mock_get_report.assert_called_once_with(
            "test-user-id",
            mock_session,
            True,  # includeStudentTypeChart
            True,  # includePerformanceChart
            True,  # includeRadarChart
            True,  # includeTimeChart
            True,  # includeDetailedScores
            True,  # includeFeedback
        )

    @patch("app.routes.profiles.get_report")
    def test_generate_report_error_propagation(
        self, mock_get_report, client, mock_session
    ):
        """Test generate_report error handling."""
        # Mock get_report to raise an exception
        from fastapi import HTTPException

        mock_get_report.side_effect = HTTPException(
            status_code=404, detail="User not found"
        )

        with patch("app.routes.profiles.get_session", return_value=mock_session):
            response = client.post("/profiles/nonexistent-user-id")

        assert response.status_code == 404
        assert response.json()["detail"] == "User not found"


class TestChartCreationFunctions:
    """Tests for chart creation helper functions."""

    @patch("matplotlib.pyplot.savefig")
    @patch("matplotlib.pyplot.pie")
    @patch("matplotlib.pyplot.figure")
    def test_create_student_type_chart(self, mock_figure, mock_pie, mock_savefig):
        """Test student type chart creation."""

        chat_agents = {"happy": 5, "aggressive": 3, "confused": 2}
        filename = "/tmp/test_chart.png"

        result = create_student_type_chart(chat_agents, filename)

        assert result == filename
        mock_figure.assert_called_once()
        mock_pie.assert_called_once()
        mock_savefig.assert_called_once_with(filename)

    @patch("matplotlib.pyplot.savefig")
    @patch("matplotlib.pyplot.bar")
    @patch("matplotlib.pyplot.figure")
    def test_create_student_type_performance(self, mock_figure, mock_bar, mock_savefig):
        """Test student type performance chart creation."""

        performance_by_type = {
            "happy": [85, 90, 88],
            "aggressive": [70, 75, 72],
            "confused": [60, 65, 62],
        }
        filename = "/tmp/test_performance.png"

        result = create_student_type_performance(performance_by_type, filename)

        assert result == filename
        mock_figure.assert_called_once()
        mock_bar.assert_called_once()
        mock_savefig.assert_called_once_with(filename)

    @patch("matplotlib.pyplot.savefig")
    @patch("matplotlib.pyplot.subplot")
    @patch("matplotlib.pyplot.figure")
    def test_create_score_radar_chart(self, mock_figure, mock_subplot, mock_savefig):
        """Test radar chart creation."""

        scores = {
            "Adaptability": 85,
            "Listening": 90,
            "Objectives": 80,
            "Time Management": 75,
        }
        filename = "/tmp/test_radar.png"

        result = create_score_radar_chart(scores, filename)

        assert result == filename
        mock_figure.assert_called_once()
        mock_subplot.assert_called_once()
        mock_savefig.assert_called_once_with(filename)

    @patch("matplotlib.pyplot.savefig")
    @patch("matplotlib.pyplot.plot")
    @patch("matplotlib.pyplot.figure")
    def test_create_time_series_chart(self, mock_figure, mock_plot, mock_savefig):
        """Test time series chart creation."""
        from datetime import datetime

        time_data = [
            (datetime(2023, 1, 1), 85),
            (datetime(2023, 1, 2), 88),
            (datetime(2023, 1, 3), 90),
        ]
        filename = "/tmp/test_timeseries.png"

        result = create_time_series_chart(time_data, filename)

        assert result == filename
        mock_figure.assert_called_once()
        mock_plot.assert_called_once()
        mock_savefig.assert_called_once_with(filename)


class TestIntegration:
    """Integration tests for the complete report generation flow."""

    @patch("app.routes.profiles.select")
    @patch("tempfile.TemporaryDirectory")
    @patch("app.routes.profiles.create_student_type_chart")
    @patch("app.routes.profiles.create_student_type_performance")
    @patch("app.routes.profiles.create_score_radar_chart")
    @patch("app.routes.profiles.Document")
    def test_full_report_generation_flow(
        self,
        mock_document,
        mock_radar_chart,
        mock_performance_chart,
        mock_student_chart,
        mock_temp_dir,
        mock_select,
        client,
        mock_session,
        mock_user,
        mock_attempts,
        mock_chats,
        mock_grades,
        mock_feedbacks,
        mock_rubrics,
        mock_standard_groups,
        mock_standards,
        mock_scenarios,
        mock_agents,
    ):
        """Test the complete report generation flow with realistic data."""
        # Setup mocks
        mock_temp_dir.return_value.__enter__.return_value = "/tmp/test"

        # Mock database queries with realistic responses
        mock_session.exec.side_effect = [
            MagicMock(one_or_none=lambda: mock_user),  # User query
            mock_attempts,  # Attempts query
            mock_chats,  # Chats query
            mock_grades,  # Grades query
            mock_feedbacks,  # Feedbacks query
            mock_rubrics,  # Rubrics query
            mock_standard_groups,  # Standard groups query
            mock_standards,  # Standards query
            mock_agents[0],  # Agent queries for chart data
            mock_agents[1],
            mock_agents[0],
            mock_agents[1],
        ]

        # Mock PDF generation
        mock_doc_instance = MagicMock()
        mock_document.return_value = mock_doc_instance

        # Mock file reading
        with patch("builtins.open", mock_open(read_data=b"realistic pdf content")):
            with patch("app.routes.profiles.get_session", return_value=mock_session):
                response = client.get(
                    "/profiles/test-user-id",
                    params={
                        "includeStudentTypeChart": True,
                        "includePerformanceChart": True,
                        "includeRadarChart": True,
                        "includeTimeChart": False,  # Not enough data points
                        "includeDetailedScores": True,
                        "includeFeedback": True,
                    },
                )

        # Verify response
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/pdf"
        assert "Test_User" in response.headers["content-disposition"]

        # Verify PDF document was created and configured
        mock_document.assert_called_once()
        mock_doc_instance.generate_pdf.assert_called_once_with(clean_tex=True)

        # Verify appropriate charts were created
        mock_student_chart.assert_called_once()
        mock_performance_chart.assert_called_once()
        mock_radar_chart.assert_called_once()
