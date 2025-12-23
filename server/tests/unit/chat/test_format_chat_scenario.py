"""
Tests for app.utils.chat.format_chat_scenario
"""


class TestFormat_Chat_Scenario:
    """Tests for format_chat_scenario function."""

    def test_format_chat_scenario_success(self) -> None:
        """Test successful format_chat_scenario execution."""
        from app.infra.v3.chat.format_chat_scenario import format_chat_scenario

        problem_statement = "You are a customer service representative helping a user."

        result = format_chat_scenario(problem_statement)

        assert result["role"] == "user"
        assert "The following is the scenario for the chat:" in result["content"]
        assert problem_statement in result["content"]

    def test_format_chat_scenario_empty(self) -> None:
        """Test format_chat_scenario with empty string."""
        from app.infra.v3.chat.format_chat_scenario import format_chat_scenario

        result = format_chat_scenario("")

        assert result["role"] == "user"
        assert "The following is the scenario for the chat:" in result["content"]
