"""
Tests for app.agents.collection.grade
"""

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from app.agents.collection.grade import (create_dynamic_rubric_model,
                                         create_safe_field_name,
                                         run_grade_agent)
from sqlmodel import Session


class MockAgent:
    def __init__(self, id, name, system_prompt, temperature, model_id, reasoning):
        self.id = id
        self.name = name
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.model_id = model_id
        self.reasoning = reasoning


class MockModel:
    def __init__(self, id, name, provider_id):
        self.id = id
        self.name = name
        self.provider_id = provider_id


class MockProvider:
    def __init__(self, id, name, api_key):
        self.id = id
        self.name = name
        self.api_key = api_key


class MockSimulationChat:
    def __init__(self, id, attempt_id, title, trace_id=None, created_at=None):
        self.id = id
        self.attempt_id = attempt_id
        self.title = title
        self.trace_id = trace_id or str(uuid.uuid4())
        self.created_at = created_at or datetime.now(timezone.utc)


class MockSimulationAttempt:
    def __init__(self, id, simulation_id):
        self.id = id
        self.simulation_id = simulation_id


class MockSimulation:
    def __init__(self, id, title, rubric_id):
        self.id = id
        self.title = title
        self.rubric_id = rubric_id


class MockRubric:
    def __init__(self, id, name, points, pass_points, description=""):
        self.id = id
        self.name = name
        self.points = points
        self.pass_points = pass_points
        self.description = description


class MockStandardGroup:
    def __init__(
        self, id, name, short_name, description, points, pass_points, rubric_id
    ):
        self.id = id
        self.name = name
        self.short_name = short_name
        self.description = description
        self.points = points
        self.pass_points = pass_points
        self.rubric_id = rubric_id


class MockStandard:
    def __init__(self, id, name, description, points, standard_group_id):
        self.id = id
        self.name = name
        self.description = description
        self.points = points
        self.standard_group_id = standard_group_id


class MockSimulationMessage:
    def __init__(self, id, chat_id, content, type="query", created_at=None):
        self.id = id
        self.chat_id = chat_id
        self.content = content
        self.type = type
        self.created_at = created_at or datetime.now(timezone.utc)


class MockDynamicRubric:
    def __init__(self, overall_score=0, passed=False):
        self.overall_score = overall_score
        self.passed = passed


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


class TestCreate_Safe_Field_Name:
    """Tests for create_safe_field_name function."""

    def test_create_safe_field_name_success(self):
        """Test successful create_safe_field_name execution."""
        # Test basic functionality
        result = create_safe_field_name("Communication Skills")
        assert result == "communication_skills"

        # Test with special characters
        result = create_safe_field_name("Problem-Solving & Analysis")
        assert result == "problem_solving_analysis"

        # Test with numbers
        result = create_safe_field_name("Math 101")
        assert result == "math_101"

    def test_create_safe_field_name_error(self):
        """Test create_safe_field_name error handling."""
        # Test with empty string
        result = create_safe_field_name("")
        assert result == ""

        # Test with only special characters
        result = create_safe_field_name("!@#$%")
        assert result == ""


class TestCreate_Dynamic_Rubric_Model:
    """Tests for create_dynamic_rubric_model function."""

    def test_create_dynamic_rubric_model_success(self):
        """Test successful create_dynamic_rubric_model execution."""
        standard_groups = [
            MockStandardGroup(
                uuid.uuid4(),
                "Communication",
                "comm",
                "Communication skills",
                10,
                7,
                uuid.uuid4(),
            ),
            MockStandardGroup(
                uuid.uuid4(),
                "Problem Solving",
                "prob",
                "Problem solving skills",
                15,
                10,
                uuid.uuid4(),
            ),
        ]

        DynamicRubric = create_dynamic_rubric_model(standard_groups)

        # Test that the model has the expected fields
        instance = DynamicRubric(
            overall_score=85,
            passed=True,
            comm_score=4,
            comm_feedback="Good",
            prob_score=5,
            prob_feedback="Excellent",
            summary="Overall good performance",
        )

        assert instance.overall_score == 85
        assert instance.passed is True
        assert instance.comm_score == 4
        assert instance.comm_feedback == "Good"
        assert instance.prob_score == 5
        assert instance.prob_feedback == "Excellent"
        assert instance.summary == "Overall good performance"

    def test_create_dynamic_rubric_model_error(self):
        """Test create_dynamic_rubric_model error handling."""
        # Test with empty list
        DynamicRubric = create_dynamic_rubric_model([])
        instance = DynamicRubric(overall_score=0, passed=False, summary="No standards")
        assert instance.overall_score == 0
        assert instance.passed is False


class TestRun_Grade_Agent:
    """Tests for run_grade_agent function."""

    @pytest.mark.asyncio
    async def test_run_grade_agent_success(self, mock_session):
        """Test successful run_grade_agent execution."""
        chat_id = uuid.uuid4()
        attempt_id = uuid.uuid4()
        simulation_id = uuid.uuid4()
        rubric_id = uuid.uuid4()
        agent_id = uuid.uuid4()
        model_id = uuid.uuid4()
        provider_id = uuid.uuid4()

        mock_chat = MockSimulationChat(chat_id, attempt_id, "Test Chat")
        mock_attempt = MockSimulationAttempt(attempt_id, simulation_id)
        mock_simulation = MockSimulation(simulation_id, "Test Simulation", rubric_id)
        mock_rubric = MockRubric(rubric_id, "Test Rubric", 100, 70)
        mock_agent = MockAgent(
            agent_id, "Grade", "Grade the conversation", 0.7, model_id, "medium"
        )
        mock_model = MockModel(model_id, "gpt-4", provider_id)
        mock_provider = MockProvider(
            provider_id, "openai", "dGVzdF9hcGlfa2V5"
        )  # base64 encoded "test_api_key"
        mock_standard_groups = [
            MockStandardGroup(
                uuid.uuid4(),
                "Communication",
                "comm",
                "Communication skills",
                10,
                7,
                rubric_id,
            )
        ]
        mock_standards = [
            MockStandard(
                uuid.uuid4(),
                "Clear Communication",
                "Speaks clearly",
                5,
                mock_standard_groups[0].id,
            )
        ]
        mock_messages = [
            MockSimulationMessage(uuid.uuid4(), chat_id, "Hello", "query"),
            MockSimulationMessage(uuid.uuid4(), chat_id, "Hi there", "response"),
        ]

        # Mock the database queries in the correct order
        mock_session.exec.return_value.one.side_effect = [
            mock_agent,  # select(Agents).where(Agents.name == "Grade")
            mock_chat,  # select(SimulationChats).where(SimulationChats.id == simulation_chat_id)
            mock_attempt,  # select(SimulationAttempts).where(SimulationAttempts.id == chat.attempt_id)
            mock_simulation,  # select(Simulations).where(Simulations.id == attempt.simulation_id)
            mock_rubric,  # select(Rubrics).where(Rubrics.id == rubric_id)
            mock_model,  # select(Models).where(Models.id == agent.model_id)
            mock_provider,  # select(Providers).where(Providers.id == model.provider_id)
        ]
        mock_session.exec.return_value.all.side_effect = [
            mock_messages,  # select(SimulationMessages).where(SimulationMessages.chat_id == simulation_chat_id)
            mock_standard_groups,  # select(StandardGroups).where(StandardGroups.rubric_id == rubric_id)
            mock_standards,  # select(Standards).where(Standards.standard_group_id.in_(standard_group_ids))
        ]

        # Mock the Runner.run
        mock_result = MagicMock()
        mock_result.final_output_as.return_value = MockDynamicRubric(
            overall_score=85, passed=True
        )

        # Mock the GenericAgent constructor to prevent real API calls
        mock_agent_instance = MagicMock()

        with patch(
            "app.agents.collection.grade.GenericAgent",
            return_value=mock_agent_instance,
        ):
            with patch(
                "app.agents.generic.decrypt_api_key",
                return_value="decrypted_key",
            ):
                result = await run_grade_agent(chat_id, mock_session)
                assert isinstance(result, str)

    @pytest.mark.asyncio
    async def test_run_grade_agent_error(self, mock_session):
        """Test run_grade_agent error handling."""
        chat_id = uuid.uuid4()

        # Mock agent not found
        mock_session.exec.return_value.one.side_effect = [None]

        with pytest.raises(ValueError, match="Grade agent not found"):
            await run_grade_agent(chat_id, mock_session)


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `format_minutes`")
class TestFormat_Minutes:
    """Tests for format_minutes function."""

    def test_format_minutes_success(self):
        """Test successful format_minutes execution."""
        # TODO: Implement test for format_minutes
        assert False, "IMPLEMENT: Test for format_minutes"

    def test_format_minutes_error(self):
        """Test format_minutes error handling."""
        # TODO: Implement error test for format_minutes
        assert False, "IMPLEMENT: Error test for format_minutes"

