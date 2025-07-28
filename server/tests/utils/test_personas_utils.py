"""
Tests for app.utils.personas
"""
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from app.utils.personas import *
from sqlmodel import Session


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


import pytest


class TestGet_Persona_Info:
    """Tests for get_persona_info function."""

    def test_get_persona_info_success(self, mock_session):
        """Test successful get_persona_info execution."""
        from uuid import uuid4

        from app.models import Personas
        from app.utils.personas import get_persona_info

        # Create mock persona
        persona_id = uuid4()
        mock_persona = Personas(
            id=persona_id, 
            name="Test Student", 
            description="A test student persona"
        )
        
        # Mock the database query
        mock_session.exec.return_value.one_or_none.return_value = mock_persona
        
        result = get_persona_info(persona_id, mock_session)
        
        assert result["role"] == "user"
        assert "This is the profile of the student:" in result["content"]
        assert "Name: Test Student" in result["content"]
        assert "Description: A test student persona" in result["content"]

    def test_get_persona_info_error(self, mock_session):
        """Test get_persona_info error handling."""
        from uuid import uuid4

        from app.utils.personas import get_persona_info

        # Mock the database query to return no persona
        mock_session.exec.return_value.one_or_none.return_value = None
        
        persona_id = uuid4()
        
        with pytest.raises(ValueError, match=f"Persona with ID {persona_id} not found"):
            get_persona_info(persona_id, mock_session)

