"""
Tests for app.utils.personas
"""

import uuid
from unittest.mock import MagicMock

import pytest
from app.utils.personas import get_persona_info
from sqlmodel import Session


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


class TestGet_Persona_Info:
    """Tests for get_persona_info function."""

    def test_get_persona_info_success(self, mock_session):
        """Test successful get_persona_info execution."""
        # Mock the persona
        mock_persona = MagicMock()
        mock_persona.name = "Test Persona"
        mock_persona.description = "A test persona description"
        mock_session.exec.return_value.one_or_none.return_value = mock_persona

        persona_id = uuid.uuid4()
        result = get_persona_info(persona_id, mock_session)

        # Verify that the persona info was retrieved
        assert result["role"] == "user"
        assert "This is the profile of the student:" in result["content"]
        assert "Test Persona" in result["content"]
        assert "A test persona description" in result["content"]
        mock_session.exec.assert_called_once()

    def test_get_persona_info_not_found(self, mock_session):
        """Test get_persona_info when persona is not found."""
        # Mock no persona found
        mock_session.exec.return_value.one_or_none.return_value = None

        persona_id = uuid.uuid4()

        # The function should raise an exception
        with pytest.raises(ValueError, match="Persona with ID"):
            get_persona_info(persona_id, mock_session)

        mock_session.exec.assert_called_once()
