"""
Tests for app.utils.personas
"""

import pytest


class TestFormat_Persona_Info:
    """Tests for format_persona_info function."""

    def test_format_persona_info_success(self):
        """Test successful format_persona_info execution."""
        from app.utils.personas import format_persona_info

        persona_data = {
            "name": "Test Student",
            "description": "A test student persona"
        }
        
        result = format_persona_info(persona_data)
        
        assert result["role"] == "user"
        assert "Test Student" in result["content"]
        assert "A test student persona" in result["content"]
        assert "This is the profile of the student:" in result["content"]

    def test_format_persona_info_no_description(self):
        """Test format_persona_info with missing description."""
        from app.utils.personas import format_persona_info

        persona_data = {
            "name": "Test Student"
        }
        
        result = format_persona_info(persona_data)
        
        assert result["role"] == "user"
        assert "Test Student" in result["content"]
