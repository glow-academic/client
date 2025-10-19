"""
Tests for app.utils.scenario
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from sqlmodel import Session

from app.utils.scenario import (
    get_parameter_item_info,
    randomly_fill_scenario_attributes,
)


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


class TestGet_Parameter_Item_Info:
    """Tests for get_parameter_item_info function."""

    def test_get_parameter_item_info_success(self, mock_session):
        """Test successful get_parameter_item_info execution."""
        # Mock the parameter items with parameters
        mock_param_item1 = MagicMock()
        mock_param_item1.name = "Test Parameter Item 1"
        mock_param_item1.description = "A test parameter item description"

        mock_param1 = MagicMock()
        mock_param1.name = "Test Parameter"
        mock_param1.description = "A test parameter description"

        mock_param_item2 = MagicMock()
        mock_param_item2.name = "Test Parameter Item 2"
        mock_param_item2.description = "Another test parameter item description"

        mock_param2 = MagicMock()
        mock_param2.name = "Another Parameter"
        mock_param2.description = "Another test parameter description"

        mock_results = [
            (mock_param_item1, mock_param1),
            (mock_param_item2, mock_param2),
        ]
        mock_session.exec.return_value.all.return_value = mock_results

        parameter_item_ids = [uuid.uuid4(), uuid.uuid4()]
        result = get_parameter_item_info(parameter_item_ids, mock_session)

        # Verify that the parameter item info was retrieved
        assert result["role"] == "user"
        assert "The following is the parameter item information:" in result["content"]
        assert "Test Parameter Item 1" in result["content"]
        assert "Test Parameter Item 2" in result["content"]
        assert "Test Parameter" in result["content"]
        assert "Another Parameter" in result["content"]
        mock_session.exec.assert_called_once()

    def test_get_parameter_item_info_not_found(self, mock_session):
        """Test get_parameter_item_info when parameter items are not found."""
        # Mock no parameter items found
        mock_session.exec.return_value.all.return_value = []

        parameter_item_ids = [uuid.uuid4()]
        result = get_parameter_item_info(parameter_item_ids, mock_session)

        # Verify that a default message was returned
        assert result["role"] == "user"
        assert result["content"] == "No parameter items found."
        mock_session.exec.assert_called_once()


class TestRandomly_Fill_Scenario_Attributes:
    """Tests for randomly_fill_scenario_attributes function."""

    @pytest.mark.asyncio
    async def test_randomly_fill_scenario_attributes_success(self, mock_session):
        """Test successful randomly_fill_scenario_attributes execution."""
        # Mock the scenario
        mock_scenario = MagicMock()
        mock_scenario.id = uuid.uuid4()
        mock_scenario.name = "Test Scenario"
        mock_scenario.description = "Test Description"
        mock_scenario.persona_id = None
        mock_scenario.document_ids = None
        mock_scenario.parameter_item_ids = None

        # Mock active personas
        mock_persona1 = MagicMock()
        mock_persona1.id = uuid.uuid4()
        mock_persona2 = MagicMock()
        mock_persona2.id = uuid.uuid4()
        mock_personas = [mock_persona1, mock_persona2]

        # Mock active documents
        mock_doc1 = MagicMock()
        mock_doc1.id = uuid.uuid4()
        mock_doc2 = MagicMock()
        mock_doc2.id = uuid.uuid4()
        mock_documents = [mock_doc1, mock_doc2]

        # Mock parameter items
        mock_param_item1 = MagicMock()
        mock_param_item1.id = uuid.uuid4()
        mock_param_item2 = MagicMock()
        mock_param_item2.id = uuid.uuid4()

        # Mock active parameters
        mock_param1 = MagicMock()
        mock_param1.id = uuid.uuid4()
        mock_param2 = MagicMock()
        mock_param2.id = uuid.uuid4()
        mock_parameters = [mock_param1, mock_param2]

        # Mock the database queries with proper side_effect
        def mock_exec_side_effect(*args, **kwargs):
            mock_result = MagicMock()
            # Return different results based on call count
            if not hasattr(mock_exec_side_effect, "call_count"):
                mock_exec_side_effect.call_count = 0
            mock_exec_side_effect.call_count += 1

            if mock_exec_side_effect.call_count == 1:
                mock_result.all.return_value = mock_personas
            elif mock_exec_side_effect.call_count == 2:
                mock_result.all.return_value = mock_documents
            elif mock_exec_side_effect.call_count == 3:
                mock_result.all.return_value = mock_parameters
            elif mock_exec_side_effect.call_count == 4:
                mock_result.all.return_value = [mock_param_item1]
            elif mock_exec_side_effect.call_count == 5:
                mock_result.all.return_value = [mock_param_item2]
            else:
                mock_result.all.return_value = []
            return mock_result

        mock_session.exec.side_effect = mock_exec_side_effect

        # Mock random choices with proper return values
        with (
            patch(
                "random.choice",
                side_effect=[mock_persona1, mock_param_item1, mock_param_item2],
            ),
            patch("random.randint", return_value=1),
            patch("random.sample", return_value=[mock_doc1]),
        ):
            result = await randomly_fill_scenario_attributes(
                mock_scenario, mock_session
            )

            # Verify that a new scenario was created with the expected values
            assert result.name == mock_scenario.name
            assert result.description == mock_scenario.description
            assert result.persona_id == mock_persona1.id
            assert result.document_ids == [mock_doc1.id]
            assert result.parameter_item_ids == [
                mock_param_item1.id,
                mock_param_item2.id,
            ]
            assert result.generated is True
            assert result.parent_id == mock_scenario.id

    @pytest.mark.asyncio
    async def test_randomly_fill_scenario_attributes_no_active_items(
        self, mock_session
    ):
        """Test randomly_fill_scenario_attributes when no active items are found."""
        # Mock the scenario
        mock_scenario = MagicMock()
        mock_scenario.id = uuid.uuid4()
        mock_scenario.name = "Test Scenario"
        mock_scenario.description = "Test Description"
        mock_scenario.persona_id = None
        mock_scenario.document_ids = None
        mock_scenario.parameter_item_ids = None

        # Mock empty results for all queries
        def mock_exec_side_effect(*args, **kwargs):
            mock_result = MagicMock()
            mock_result.all.return_value = []
            return mock_result

        mock_session.exec.side_effect = mock_exec_side_effect

        result = await randomly_fill_scenario_attributes(mock_scenario, mock_session)

        # Verify that a new scenario was created with None/empty values
        assert result.name == mock_scenario.name
        assert result.description == mock_scenario.description
        assert result.persona_id is None
        assert result.document_ids == []
        assert result.parameter_item_ids == []
        assert result.generated is True
        assert result.parent_id == mock_scenario.id


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `suggest_randomized_sections`")
class TestSuggest_Randomized_Sections:
    """Tests for suggest_randomized_sections function."""

    def test_suggest_randomized_sections_success(self):
        """Test successful suggest_randomized_sections execution."""
        # TODO: Implement test for suggest_randomized_sections
        assert False, "IMPLEMENT: Test for suggest_randomized_sections"

    def test_suggest_randomized_sections_error(self):
        """Test suggest_randomized_sections error handling."""
        # TODO: Implement error test for suggest_randomized_sections
        assert False, "IMPLEMENT: Error test for suggest_randomized_sections"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `score_persona`")
class TestScore_Persona:
    """Tests for score_persona function."""

    def test_score_persona_success(self):
        """Test successful score_persona execution."""
        # TODO: Implement test for score_persona
        assert False, "IMPLEMENT: Test for score_persona"

    def test_score_persona_error(self):
        """Test score_persona error handling."""
        # TODO: Implement error test for score_persona
        assert False, "IMPLEMENT: Error test for score_persona"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `score_doc`")
class TestScore_Doc:
    """Tests for score_doc function."""

    def test_score_doc_success(self):
        """Test successful score_doc execution."""
        # TODO: Implement test for score_doc
        assert False, "IMPLEMENT: Test for score_doc"

    def test_score_doc_error(self):
        """Test score_doc error handling."""
        # TODO: Implement error test for score_doc
        assert False, "IMPLEMENT: Error test for score_doc"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `score_item`")
class TestScore_Item:
    """Tests for score_item function."""

    def test_score_item_success(self):
        """Test successful score_item execution."""
        # TODO: Implement test for score_item
        assert False, "IMPLEMENT: Test for score_item"

    def test_score_item_error(self):
        """Test score_item error handling."""
        # TODO: Implement error test for score_item
        assert False, "IMPLEMENT: Error test for score_item"


import pytest


@pytest.mark.skip(reason="TODO: implement tests for `format_parameter_item_info`")
class TestFormat_Parameter_Item_Info:
    """Tests for format_parameter_item_info function."""

    def test_format_parameter_item_info_success(self):
        """Test successful format_parameter_item_info execution."""
        # TODO: Implement test for format_parameter_item_info
        assert False, "IMPLEMENT: Test for format_parameter_item_info"

    def test_format_parameter_item_info_error(self):
        """Test format_parameter_item_info error handling."""
        # TODO: Implement error test for format_parameter_item_info
        assert False, "IMPLEMENT: Error test for format_parameter_item_info"
