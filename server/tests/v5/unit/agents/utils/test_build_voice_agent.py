"""Unit tests for app.v5.infra.agents.utils.build_voice_agent."""

from unittest.mock import MagicMock, patch


class TestBuildVoiceAgent:
    """Tests for build_voice_agent function."""

    def test_build_voice_agent_success(self) -> None:
        """Test successful voice agent building."""
        with patch(
            "app.v5.infra.agents.generic_agent.decrypt_api_key",
            return_value="decrypted",
        ):
            from app.v5.infra.agents.utils.build_voice_agent import build_voice_agent

            context = {
                "agent": {"name": "test_agent"},
                "model_name": "gpt-4",
                "provider_name": "openai",
                "api_key": "test_key",
            }
            persona_tools = [MagicMock()]
            base_system_prompt = "Test simulation prompt"
            persona_instructions_map = {"persona1": "Persona 1 instructions"}

            agent, instructions = build_voice_agent(
                context=context,
                persona_tools=persona_tools,
                base_system_prompt=base_system_prompt,
                persona_instructions_map=persona_instructions_map,
            )

            assert agent is not None
            assert isinstance(instructions, str)
            assert base_system_prompt in instructions

    def test_build_voice_agent_with_multiple_personas(self) -> None:
        """Test voice agent building with multiple personas."""
        with patch(
            "app.v5.infra.agents.generic_agent.decrypt_api_key",
            return_value="decrypted",
        ):
            from app.v5.infra.agents.utils.build_voice_agent import build_voice_agent

            context = {
                "agent": {"name": "test_agent"},
                "model_name": "gpt-4",
                "provider_name": "openai",
                "api_key": "test_key",
            }
            persona_tools = [MagicMock()]
            base_system_prompt = "Test simulation prompt"
            persona_instructions_map = {
                "persona1": "Persona 1 instructions",
                "persona2": "Persona 2 instructions",
            }

            agent, instructions = build_voice_agent(
                context=context,
                persona_tools=persona_tools,
                base_system_prompt=base_system_prompt,
                persona_instructions_map=persona_instructions_map,
            )

            assert agent is not None
            assert isinstance(instructions, str)
            assert "persona1" in instructions or "persona2" in instructions
