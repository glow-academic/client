"""
Tests for app.services.agents.collection.classify
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest
from app.services.agents.collection.classify import run_classify_agent
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


class MockDocument:
    def __init__(self, id, name, file_path, content_type):
        self.id = id
        self.name = name
        self.file_path = file_path
        self.content_type = content_type
        self.type = content_type  # Add the missing type attribute


class MockClassify:
    def __init__(self, homeworks, projects):
        self.homeworks = homeworks
        self.projects = projects

    def model_dump(self):
        return {"homeworks": self.homeworks, "projects": self.projects}


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


class TestRun_Classify_Agent:
    """Tests for run_classify_agent function."""

    @pytest.mark.asyncio
    async def test_run_classify_agent_success(self, mock_session):
        """Test successful run_classify_agent execution."""
        document_ids = [uuid.uuid4(), uuid.uuid4()]
        agent_id = uuid.uuid4()
        model_id = uuid.uuid4()
        provider_id = uuid.uuid4()

        mock_agent = MockAgent(
            agent_id, "Classify", "Classify documents", 0.7, model_id, "medium"
        )
        mock_model = MockModel(model_id, "gpt-4", provider_id)
        mock_provider = MockProvider(
            provider_id, "openai", "dGVzdF9hcGlfa2V5"
        )  # base64 encoded "test_api_key"
        mock_documents = [
            MockDocument(
                document_ids[0], "document1.pdf", "/path/1", "application/pdf"
            ),
            MockDocument(
                document_ids[1], "document2.pdf", "/path/2", "application/pdf"
            ),
        ]

        # Mock the database queries
        mock_session.exec.return_value.one.return_value = mock_agent
        mock_session.exec.return_value.all.side_effect = [mock_documents]
        mock_session.exec.return_value.one.side_effect = [
            mock_agent,
            mock_model,
            mock_provider,
        ]

        # Mock the Runner.run
        mock_result = MagicMock()
        mock_result.final_output_as.return_value = MockClassify(
            homeworks=["1"], projects=["2"]
        )

        with patch(
            "app.services.agents.collection.classify.Runner.run",
            return_value=mock_result,
        ):
            with patch(
                "app.services.agents.generic.decrypt_api_key",
                return_value="decrypted_key",
            ):
                with patch(
                    "app.services.agents.collection.classify.trace"
                ) as mock_trace:
                    # Mock the trace context manager
                    mock_trace.return_value.__enter__ = MagicMock()
                    mock_trace.return_value.__exit__ = MagicMock()
                    result = await run_classify_agent(document_ids, False, mock_session)

                    assert result["success"] is True
                    assert "classified" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_run_classify_agent_test_mode(self, mock_session):
        """Test run_classify_agent in test mode."""
        document_ids = [uuid.uuid4(), uuid.uuid4()]
        agent_id = uuid.uuid4()
        model_id = uuid.uuid4()
        provider_id = uuid.uuid4()

        mock_agent = MockAgent(
            agent_id, "Classify", "Classify documents", 0.7, model_id, "medium"
        )
        mock_model = MockModel(model_id, "gpt-4", provider_id)
        mock_provider = MockProvider(
            provider_id, "openai", "dGVzdF9hcGlfa2V5"
        )  # base64 encoded "test_api_key"
        mock_documents = [
            MockDocument(
                document_ids[0], "document1.pdf", "/path/1", "application/pdf"
            ),
            MockDocument(
                document_ids[1], "document2.pdf", "/path/2", "application/pdf"
            ),
        ]

        # Mock the database queries
        mock_session.exec.return_value.one.side_effect = [
            mock_agent,
            mock_model,
            mock_provider,
        ]
        mock_session.exec.return_value.all.return_value = mock_documents

        with patch(
            "app.services.agents.generic.decrypt_api_key", return_value="decrypted_key"
        ):
            with patch("app.services.agents.collection.classify.trace") as mock_trace:
                # Mock the trace context manager
                mock_trace.return_value.__enter__ = MagicMock()
                mock_trace.return_value.__exit__ = MagicMock()
                result = await run_classify_agent(document_ids, True, mock_session)

                assert result["success"] is True
                assert "successfully classified" in result["message"].lower()

    @pytest.mark.asyncio
    async def test_run_classify_agent_error(self, mock_session):
        """Test run_classify_agent error handling."""
        document_ids = [uuid.uuid4()]

        # Mock agent not found
        mock_session.exec.return_value.one.side_effect = [None]

        with pytest.raises(ValueError, match="Classify agent not found"):
            await run_classify_agent(document_ids, False, mock_session)
