"""
Tests for app.services.agents.grade

Auto-generated on: 2025-06-09T21:12:28.747744
"""

import pytest
from unittest.mock import MagicMock, patch
from sqlmodel import Session
from uuid import UUID
from datetime import datetime, timezone
from pydantic import BaseModel

# Import the module being tested
from app.services.agents.grade import *
from app.models import (
    SimulationChats,
    SimulationMessages,
    Rubrics,
    StandardGroups,
    Standards,
    Simulations,
    SimulationAttempts,
)


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


@pytest.fixture
def sample_simulation_chat():
    """Create a sample simulation chat."""
    return SimulationChats(
        id=UUID("11111111-1111-1111-1111-111111111111"),
        created_at=datetime.now(timezone.utc),
        title="Test Simulation Chat",
        scenario_id=UUID("22222222-2222-2222-2222-222222222222"),
        attempt_id=UUID("33333333-3333-3333-3333-333333333333"),
        completed=False,
    )


@pytest.fixture
def sample_simulation_attempt():
    """Create a sample simulation attempt."""
    return SimulationAttempts(
        id=UUID("33333333-3333-3333-3333-333333333333"),
        created_at=datetime.now(timezone.utc),
        simulation_id=UUID("55555555-5555-5555-5555-555555555555"),
        profile_id=UUID("66666666-6666-6666-6666-666666666666"),
    )


@pytest.fixture
def sample_simulation():
    """Create a sample simulation."""
    return Simulations(
        id=UUID("55555555-5555-5555-5555-555555555555"),
        created_at=datetime.now(timezone.utc),
        title="Test Simulation",
        class_id=UUID("44444444-4444-4444-4444-444444444444"),
        documents=[],
        time_limit=30,
        active=True,
        scenario_ids=[UUID("22222222-2222-2222-2222-222222222222")],
        rubric_id=UUID("88888888-8888-8888-8888-888888888888"),
    )


@pytest.fixture
def sample_rubric():
    """Create a sample rubric."""
    return Rubrics(
        id=UUID("88888888-8888-8888-8888-888888888888"),
        created_at=datetime.now(timezone.utc),
        name="Teaching Assistant Evaluation Rubric",
        description="A rubric for evaluating TA performance",
        points=20,
        pass_points=14,
    )


@pytest.fixture
def sample_standard_groups():
    """Create sample standard groups."""
    return [
        StandardGroups(
            id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
            created_at=datetime.now(timezone.utc),
            name="Active Listening",
            short_name="Active Listening",
            description="Facilitates student-driven learning",
            points=5,
            pass_points=3,
            rubric_id=UUID("88888888-8888-8888-8888-888888888888"),
        ),
        StandardGroups(
            id=UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
            created_at=datetime.now(timezone.utc),
            name="Content Mastery",
            short_name="Content Mastery",
            description="Demonstrates understanding of course objectives",
            points=5,
            pass_points=3,
            rubric_id=UUID("88888888-8888-8888-8888-888888888888"),
        ),
    ]


@pytest.fixture
def sample_standards():
    """Create sample standards."""
    return [
        Standards(
            id=UUID("cccccccc-cccc-cccc-cccc-cccccccccccc"),
            created_at=datetime.now(timezone.utc),
            name="Excellent",
            description="Consistently employs open-ended questions",
            points=5,
            standard_group_id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        ),
        Standards(
            id=UUID("dddddddd-dddd-dddd-dddd-dddddddddddd"),
            created_at=datetime.now(timezone.utc),
            name="Good",
            description="Regularly uses guided questioning",
            points=4,
            standard_group_id=UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        ),
        Standards(
            id=UUID("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"),
            created_at=datetime.now(timezone.utc),
            name="Excellent",
            description="Clearly articulates course objectives",
            points=5,
            standard_group_id=UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
        ),
        Standards(
            id=UUID("ffffffff-ffff-ffff-ffff-ffffffffffff"),
            created_at=datetime.now(timezone.utc),
            name="Good",
            description="Generally understands course goals",
            points=4,
            standard_group_id=UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
        ),
    ]


@pytest.fixture
def sample_simulation_messages():
    """Create sample simulation messages."""
    return [
        SimulationMessages(
            id=UUID("11111111-1111-1111-1111-111111111111"),
            created_at=datetime.now(timezone.utc),
            chat_id=UUID("11111111-1111-1111-1111-111111111111"),
            query="I'm having trouble with this programming assignment.",
            response="Let's work through it step by step. What specific part is giving you trouble?",
            completed=True,
        ),
        SimulationMessages(
            id=UUID("22222222-2222-2222-2222-222222222222"),
            created_at=datetime.now(timezone.utc),
            chat_id=UUID("11111111-1111-1111-1111-111111111111"),
            query="I keep getting a null pointer exception.",
            response="That's a common issue. Can you show me the line where the error occurs?",
            completed=True,
        ),
    ]


class TestCreateSafeFieldName:
    """Tests for create_safe_field_name function."""

    def test_simple_name(self):
        """Test with a simple name."""
        result = create_safe_field_name("Active Listening")
        assert result == "active_listening"

    def test_special_characters(self):
        """Test with special characters."""
        result = create_safe_field_name("Content-Mastery & Skills")
        assert result == "content_mastery_skills"

    def test_multiple_spaces(self):
        """Test with multiple spaces."""
        result = create_safe_field_name("Time   Management")
        assert result == "time_management"

    def test_leading_trailing_underscores(self):
        """Test removal of leading/trailing underscores."""
        result = create_safe_field_name("_Adaptability_")
        assert result == "adaptability"


class TestCreateDynamicRubricModel:
    """Tests for create_dynamic_rubric_model function."""

    def test_model_creation(self, sample_standard_groups):
        """Test dynamic model creation."""
        DynamicModel = create_dynamic_rubric_model(sample_standard_groups)

        # Check that the model was created
        assert issubclass(DynamicModel, BaseModel)

        # Check field names
        field_names = list(DynamicModel.model_fields.keys())
        expected_fields = [
            "active_listening_score",
            "active_listening_feedback",
            "content_mastery_score",
            "content_mastery_feedback",
            "overall_score",
            "passed",
            "summary",
        ]

        for field in expected_fields:
            assert field in field_names

    def test_model_validation(self, sample_standard_groups):
        """Test that the dynamic model validates correctly."""
        DynamicModel = create_dynamic_rubric_model(sample_standard_groups)

        # Test valid data
        valid_data = {
            "active_listening_score": 4,
            "active_listening_feedback": "Good questioning techniques",
            "content_mastery_score": 5,
            "content_mastery_feedback": "Excellent knowledge demonstration",
            "overall_score": 18,
            "passed": True,
            "summary": "Strong performance overall",
        }

        instance = DynamicModel(**valid_data)
        assert instance.active_listening_score == 4
        assert instance.passed is True

    def test_model_validation_errors(self, sample_standard_groups):
        """Test that the dynamic model raises validation errors for invalid data."""
        DynamicModel = create_dynamic_rubric_model(sample_standard_groups)

        # Test invalid score (out of range)
        with pytest.raises(Exception):  # Pydantic validation error
            DynamicModel(
                active_listening_score=6,  # Invalid: > 5
                active_listening_feedback="Good",
                content_mastery_score=4,
                content_mastery_feedback="Good",
                overall_score=18,
                passed=True,
                summary="Test",
            )


class TestRunGradeAgent:
    """Tests for run_grade_agent function."""

    @patch("app.services.agents.grade.get_conversation_history")
    @patch("app.services.agents.grade.get_dynamic_rubric")
    @patch("app.services.agents.grade.Runner.run")
    async def test_run_grade_agent_success(
        self,
        mock_runner,
        mock_get_rubric,
        mock_get_history,
        mock_session,
        sample_simulation_chat,
        sample_simulation_attempt,
        sample_simulation,
        sample_rubric,
        sample_standard_groups,
        sample_standards,
        sample_simulation_messages,
    ):
        """Test successful run_grade_agent execution."""

        # Setup mock session queries
        mock_session.exec.side_effect = [
            MagicMock(one=MagicMock(return_value=sample_simulation_chat)),  # chat query
            MagicMock(
                all=MagicMock(return_value=sample_simulation_messages)
            ),  # messages query
            MagicMock(
                one=MagicMock(return_value=sample_simulation_attempt)
            ),  # attempt query
            MagicMock(
                one=MagicMock(return_value=sample_simulation)
            ),  # simulation query
            MagicMock(one=MagicMock(return_value=sample_rubric)),  # rubric query
            MagicMock(
                all=MagicMock(return_value=sample_standard_groups)
            ),  # standard_groups query
            MagicMock(all=MagicMock(return_value=sample_standards)),  # standards query
        ]

        # Setup mock conversation history
        mock_get_history.return_value = ["conversation", "history"]

        # Setup mock rubric
        mock_get_rubric.return_value = "rubric_string"

        # Setup mock grading result
        mock_result = MagicMock()
        mock_grading_result = MagicMock()
        mock_grading_result.overall_score = 18
        mock_grading_result.passed = True
        mock_grading_result.active_listening_score = 4
        mock_grading_result.active_listening_feedback = "Good listening skills"
        mock_grading_result.content_mastery_score = 5
        mock_grading_result.content_mastery_feedback = "Excellent content knowledge"

        mock_result.final_output_as.return_value = mock_grading_result
        mock_runner.return_value = mock_result

        # Setup mock grade creation
        mock_grade = MagicMock()
        mock_grade.id = UUID("99999999-9999-9999-9999-999999999999")
        mock_session.add.side_effect = lambda obj: setattr(obj, "id", mock_grade.id)
        mock_session.refresh.return_value = None

        # Run the function
        result = await run_grade_agent(
            "11111111-1111-1111-1111-111111111111", mock_session
        )

        # Assertions
        assert result == str(mock_grade.id)
        mock_session.commit.assert_called_once()
        mock_runner.assert_called_once()

    async def test_run_grade_agent_chat_not_found(self, mock_session):
        """Test run_grade_agent when chat is not found."""
        # Setup mock to raise exception
        mock_session.exec.side_effect = Exception("Chat not found")

        with pytest.raises(Exception):
            await run_grade_agent("nonexistent-id", mock_session)

        mock_session.rollback.assert_called_once()

    @patch("app.services.agents.grade.get_conversation_history")
    async def test_run_grade_agent_no_rubric(
        self,
        mock_get_history,
        mock_session,
        sample_simulation_chat,
        sample_simulation_attempt,
        sample_simulation,
        sample_simulation_messages,
    ):
        """Test run_grade_agent when simulation has no rubric."""

        # Setup simulation without rubric
        sample_simulation.rubric_id = None

        mock_session.exec.side_effect = [
            MagicMock(one=MagicMock(return_value=sample_simulation_chat)),  # chat query
            MagicMock(
                all=MagicMock(return_value=sample_simulation_messages)
            ),  # messages query
            MagicMock(
                one=MagicMock(return_value=sample_simulation_attempt)
            ),  # attempt query
            MagicMock(
                one=MagicMock(return_value=sample_simulation)
            ),  # simulation query
        ]

        mock_get_history.return_value = ["conversation", "history"]

        with pytest.raises(ValueError, match="does not have a rubric assigned"):
            await run_grade_agent("11111111-1111-1111-1111-111111111111", mock_session)

        mock_session.rollback.assert_called_once()


class TestGradingAgent:
    """Tests for GradingAgent class."""

    @patch("app.services.agents.grade.get_gemini")
    def test_agent_initialization(self, mock_get_gemini):
        """Test GradingAgent initialization."""
        mock_client = MagicMock()
        mock_get_gemini.return_value = mock_client

        agent = GradingAgent()

        assert agent.gemini_client == mock_client
        assert "expert grader" in agent.system_prompt.lower()

    @patch("app.services.agents.grade.get_gemini")
    @patch("app.services.agents.grade.Agent")
    def test_agent_creation(self, mock_agent_class, mock_get_gemini):
        """Test agent creation with dynamic output type."""
        mock_client = MagicMock()
        mock_get_gemini.return_value = mock_client

        # Create a simple test model
        class TestModel(BaseModel):
            test_field: str

        grading_agent = GradingAgent()
        agent = grading_agent.agent(TestModel)

        # Verify Agent was called with correct parameters
        mock_agent_class.assert_called_once()
        call_args = mock_agent_class.call_args

        assert call_args[1]["name"] == "Grading Agent"
        assert call_args[1]["output_type"] == TestModel
        assert call_args[1]["model_settings"].temperature == 0.0


# Integration test with mocked external dependencies
class TestGradeIntegration:
    """Integration tests for the grade module."""

    @patch("app.services.agents.grade.get_gemini")
    @patch("app.services.agents.grade.Runner.run")
    @patch("app.services.agents.grade.get_conversation_history")
    @patch("app.services.agents.grade.get_dynamic_rubric")
    async def test_full_grading_flow(
        self,
        mock_get_rubric,
        mock_get_history,
        mock_runner,
        mock_get_gemini,
        mock_session,
        sample_simulation_chat,
        sample_simulation_attempt,
        sample_simulation,
        sample_rubric,
        sample_standard_groups,
        sample_standards,
        sample_simulation_messages,
    ):
        """Test the complete grading flow."""

        # Setup all mocks
        mock_get_gemini.return_value = MagicMock()
        mock_get_history.return_value = ["conversation", "history"]
        mock_get_rubric.return_value = "rubric_string"

        # Setup database queries
        mock_session.exec.side_effect = [
            MagicMock(one=MagicMock(return_value=sample_simulation_chat)),
            MagicMock(all=MagicMock(return_value=sample_simulation_messages)),
            MagicMock(one=MagicMock(return_value=sample_simulation_attempt)),
            MagicMock(one=MagicMock(return_value=sample_simulation)),
            MagicMock(one=MagicMock(return_value=sample_rubric)),
            MagicMock(all=MagicMock(return_value=sample_standard_groups)),
            MagicMock(all=MagicMock(return_value=sample_standards)),
        ]

        # Setup grading result
        mock_result = MagicMock()
        mock_grading_result = MagicMock()
        mock_grading_result.overall_score = 18
        mock_grading_result.passed = True
        mock_grading_result.active_listening_score = 4
        mock_grading_result.active_listening_feedback = "Good listening"
        mock_grading_result.content_mastery_score = 5
        mock_grading_result.content_mastery_feedback = "Excellent knowledge"

        mock_result.final_output_as.return_value = mock_grading_result
        mock_runner.return_value = mock_result

        # Setup grade creation
        mock_grade = MagicMock()
        mock_grade.id = UUID("99999999-9999-9999-9999-999999999999")
        mock_session.add.side_effect = lambda obj: setattr(obj, "id", mock_grade.id)

        # Run the grading
        result = await run_grade_agent(
            "11111111-1111-1111-1111-111111111111", mock_session
        )

        # Verify the complete flow
        assert result == str(mock_grade.id)
        assert mock_session.add.call_count >= 2  # Grade + feedbacks
        mock_session.commit.assert_called_once()
        mock_runner.assert_called_once()


class TestGradeVsEvaluateConsistency:
    """Tests to ensure grade.py and evaluate.py have consistent behavior."""

    def test_field_name_generation_consistency(self, sample_standard_groups):
        """Test that both modules generate the same field names."""
        from app.services.agents.evaluate import (
            create_safe_field_name as eval_create_safe_field_name,
        )
        from app.services.agents.grade import (
            create_safe_field_name as grade_create_safe_field_name,
        )

        test_names = [
            "Active Listening",
            "Content-Mastery & Skills",
            "Time   Management",
            "_Adaptability_",
        ]

        for name in test_names:
            eval_result = eval_create_safe_field_name(name)
            grade_result = grade_create_safe_field_name(name)
            assert eval_result == grade_result, f"Field name mismatch for '{name}'"

    def test_dynamic_model_structure_consistency(self, sample_standard_groups):
        """Test that both modules create models with the same structure."""
        from app.services.agents.evaluate import (
            create_dynamic_rubric_model as eval_create_model,
        )
        from app.services.agents.grade import (
            create_dynamic_rubric_model as grade_create_model,
        )

        eval_model = eval_create_model(sample_standard_groups)
        grade_model = grade_create_model(sample_standard_groups)

        eval_fields = set(eval_model.model_fields.keys())
        grade_fields = set(grade_model.model_fields.keys())

        assert eval_fields == grade_fields, "Model fields should be identical"
