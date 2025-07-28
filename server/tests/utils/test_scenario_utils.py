"""
Tests for app.utils.scenario
"""

from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from app.utils.scenario import *
from sqlmodel import Session


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


import pytest


class TestGet_Parameter_Item_Info:
    """Tests for get_parameter_item_info function."""

    def test_get_parameter_item_info_success(self, mock_session):
        """Test successful get_parameter_item_info execution."""

        from app.models import ParameterItems, Parameters
        from app.utils.scenario import get_parameter_item_info

        # Create mock parameter and parameter item
        param_id = uuid4()
        param_item_id = uuid4()
        mock_param = Parameters(
            id=param_id, name="Difficulty", description="Difficulty level"
        )
        mock_param_item = ParameterItems(
            id=param_item_id,
            parameter_id=param_id,
            name="Easy",
            description="Easy difficulty",
        )

        # Mock the database query to return the joined result
        mock_session.exec.return_value.all.return_value = [
            (mock_param_item, mock_param)
        ]

        result = get_parameter_item_info([param_item_id], mock_session)

        assert result["role"] == "user"
        assert "The following is the parameter item information:" in result["content"]
        assert (
            "This is the Difficulty (Difficulty level) for this chat: Easy. Description: Easy difficulty"
            in result["content"]
        )

    def test_get_parameter_item_info_error(self, mock_session):
        """Test get_parameter_item_info error handling."""

        from app.utils.scenario import get_parameter_item_info

        # Mock the database query to return no results
        mock_session.exec.return_value.all.return_value = []

        param_item_ids = [uuid4(), uuid4()]

        result = get_parameter_item_info(param_item_ids, mock_session)

        assert result["role"] == "user"
        assert result["content"] == "No parameter items found."


import pytest


class TestRandomly_Fill_Scenario_Attributes:
    """Tests for randomly_fill_scenario_attributes function."""

    @pytest.mark.asyncio
    async def test_randomly_fill_scenario_attributes_success(self, mock_session):
        """Test successful randomly_fill_scenario_attributes execution."""

        from app.models import (
            Documents,
            ParameterItems,
            Parameters,
            Personas,
            Scenarios,
        )
        from app.utils.scenario import randomly_fill_scenario_attributes

        # Create mock scenario with null attributes
        scenario_id = uuid4()
        scenario = Scenarios(
            id=scenario_id,
            name="Test Scenario",
            description="A test scenario",
            persona_id=None,
            document_ids=None,
            parameter_item_ids=None,
        )

        # Create mock personas
        persona_id = uuid4()
        mock_persona = Personas(
            id=persona_id,
            name="Test Student",
            description="A test student",
            active=True,
        )

        # Create mock documents
        doc_id = uuid4()
        mock_document = Documents(
            id=doc_id, name="Test Document", mime_type="application/pdf", active=True
        )

        # Create mock parameters and parameter items
        param_id = uuid4()
        param_item_id = uuid4()
        mock_param = Parameters(
            id=param_id, name="Difficulty", description="Difficulty level", active=True
        )
        mock_param_item = ParameterItems(
            id=param_item_id,
            parameter_id=param_id,
            name="Easy",
            description="Easy difficulty",
        )

        # Mock database queries - need to handle the random selection logic
        call_count = 0

        def mock_all_side_effect(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            # Return different data based on call order
            if call_count == 1:  # First call - personas
                return [mock_persona]
            elif call_count == 2:  # Second call - documents
                return [mock_document]
            elif call_count == 3:  # Third call - parameters
                return [mock_param]
            elif call_count == 4:  # Fourth call - parameter items
                return [mock_param_item]
            else:
                return []

        # Set up the mock to return the expected data
        mock_session.exec.return_value.all.side_effect = mock_all_side_effect

        # Mock random.choice to return the first item
        with (
            patch("app.utils.scenario.random.choice") as mock_choice,
            patch("app.utils.scenario.random.randint") as mock_randint,
            patch("app.utils.scenario.random.sample") as mock_sample,
        ):
            # Mock random.choice to return the first item from the list
            def choice_side_effect(items):
                if items:
                    return items[0]
                return None

            mock_choice.side_effect = choice_side_effect
            mock_randint.return_value = 1  # Return 1 document
            mock_sample.return_value = [mock_document]  # Return the mock document

            result = await randomly_fill_scenario_attributes(scenario, mock_session)

            assert result.name == "Test Scenario"
            assert result.description == "A test scenario"
            assert result.persona_id == persona_id
            assert result.document_ids == [doc_id]
            assert result.parameter_item_ids == [param_item_id]
            assert result.generated is True
            assert result.parent_id == scenario_id

    @pytest.mark.asyncio
    async def test_randomly_fill_scenario_attributes_error(self, mock_session):
        """Test randomly_fill_scenario_attributes error handling."""

        from app.models import Scenarios
        from app.utils.scenario import randomly_fill_scenario_attributes

        # Create mock scenario with null attributes
        scenario_id = uuid4()
        scenario = Scenarios(
            id=scenario_id,
            name="Test Scenario",
            description="A test scenario",
            persona_id=None,
            document_ids=None,
            parameter_item_ids=None,
        )

        # Mock database queries to return empty results
        mock_session.exec.return_value.all.return_value = []

        result = await randomly_fill_scenario_attributes(scenario, mock_session)

        assert result.name == "Test Scenario"
        assert result.description == "A test scenario"
        assert result.persona_id is None
        assert result.document_ids == []
        assert result.parameter_item_ids == []
        assert result.generated is True
        assert result.parent_id == scenario_id
