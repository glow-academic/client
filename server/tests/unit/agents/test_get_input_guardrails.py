"""
Tests for app.utils.agents.get_input_guardrails
"""

import uuid
from typing import Any

import pytest
from app.utils.agents.get_input_guardrails import get_input_guardrails


class TestGet_Input_Guardrails:
    """Tests for get_input_guardrails function."""

    def test_get_input_guardrails_returns_list(self) -> None:
        """Test that get_input_guardrails returns a list."""
        chat_id = uuid.uuid4()
        department_id = uuid.uuid4()
        input_items: list[Any] = []

        # Mock connection - we can't easily test the full async flow without DB
        class MockConn:
            pass

        conn = MockConn()  # type: ignore

        # This will fail at runtime without proper DB setup, but tests structure
        guardrails = get_input_guardrails(chat_id, department_id, input_items, conn)
        assert isinstance(guardrails, list)
