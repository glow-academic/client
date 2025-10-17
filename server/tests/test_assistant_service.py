"""
Tests for app.services.assistant_service
"""

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from app.schemas.assistant import AssistantRunContext
from app.services.assistant_service import AssistantService


class MockRow:
    """Mock database row that supports both dict() and attribute access."""

    def __init__(self, **kwargs):
        self._data = kwargs

    def __getitem__(self, key):
        return self._data[key]

    def get(self, key, default=None):
        return self._data.get(key, default)

    def keys(self):
        return self._data.keys()

    def values(self):
        return self._data.values()

    def items(self):
        return self._data.items()

    def __iter__(self):
        return iter(self._data)


@pytest.fixture
def mock_conn():
    """Create a mock database connection."""
    return AsyncMock()


@pytest.fixture
def sample_context_row():
    """Create sample context data row."""
    return MockRow(
        chat_id=str(uuid.uuid4()),
        title="Test Chat",
        trace_id="test-trace-id",
        profile_id=str(uuid.uuid4()),
        user_role="admin",
        user_first_name="John",
        user_last_name="Doe",
        agent_id=str(uuid.uuid4()),
        agent_name="Assistant Agent",
        system_prompt="You are a helpful assistant",
        temperature=0.7,
        reasoning="medium",
        model_id=str(uuid.uuid4()),
        model_name="gpt-4",
        custom_model=False,
        provider_id=str(uuid.uuid4()),
        provider_name="openai",
        base_url=None,
        api_key="test_api_key",
    )


@pytest.fixture
def sample_messages():
    """Create sample messages."""
    chat_id = uuid.uuid4()
    return [
        MockRow(
            id=uuid.uuid4(),
            created_at=datetime.now(),
            updated_at=datetime.now(),
            completed_at=None,
            chat_id=chat_id,
            role="user",
            content="Hello",
            completed=True,
        ),
        MockRow(
            id=uuid.uuid4(),
            created_at=datetime.now(),
            updated_at=datetime.now(),
            completed_at=datetime.now(),
            chat_id=chat_id,
            role="assistant",
            content="Hi there!",
            completed=True,
        ),
    ]


@pytest.fixture
def sample_tool_calls():
    """Create sample tool calls."""
    chat_id = uuid.uuid4()
    return [
        MockRow(
            id=uuid.uuid4(),
            created_at=datetime.now(),
            updated_at=datetime.now(),
            completed_at=datetime.now(),
            chat_id=chat_id,
            tool_name="get_profile",
            tool_type="read",
            tool_arguments={"profile_id": str(uuid.uuid4())},
            tool_result={"name": "Test User"},
            completed=True,
        )
    ]


class TestAssistantService:
    """Tests for AssistantService class."""

    @pytest.mark.asyncio
    async def test_get_assistant_run_context_success(
        self, mock_conn, sample_context_row, sample_messages, sample_tool_calls
    ):
        """Test successful retrieval of assistant run context."""
        chat_id = uuid.uuid4()
        department_id = uuid.uuid4()

        # Mock the database queries
        mock_conn.fetchrow.return_value = sample_context_row
        mock_conn.fetch.side_effect = [sample_messages, sample_tool_calls]

        service = AssistantService(mock_conn)
        context = await service.get_assistant_run_context(chat_id, department_id)

        # Verify the context was built correctly
        assert isinstance(context, AssistantRunContext)
        assert context.chat_id == sample_context_row["chat_id"]
        assert context.title == sample_context_row["title"]
        assert context.trace_id == sample_context_row["trace_id"]
        assert context.profile_id == sample_context_row["profile_id"]
        assert context.user_role == sample_context_row["user_role"]
        assert context.user_first_name == sample_context_row["user_first_name"]
        assert context.user_last_name == sample_context_row["user_last_name"]
        assert context.agent_id == sample_context_row["agent_id"]
        assert context.agent_name == sample_context_row["agent_name"]
        assert context.system_prompt == sample_context_row["system_prompt"]
        assert context.temperature == sample_context_row["temperature"]
        assert context.reasoning == sample_context_row["reasoning"]
        assert context.model_id == sample_context_row["model_id"]
        assert context.model_name == sample_context_row["model_name"]
        assert context.custom_model == sample_context_row["custom_model"]
        assert context.provider_id == sample_context_row["provider_id"]
        assert context.provider_name == sample_context_row["provider_name"]
        assert context.base_url == sample_context_row["base_url"]
        assert context.api_key == sample_context_row["api_key"]
        assert len(context.messages) == 2
        assert len(context.tool_calls) == 1

        # Verify queries were called correctly
        assert mock_conn.fetchrow.call_count == 1
        assert mock_conn.fetch.call_count == 2

    @pytest.mark.asyncio
    async def test_get_assistant_run_context_chat_not_found(self, mock_conn):
        """Test error when chat not found."""
        chat_id = uuid.uuid4()
        department_id = uuid.uuid4()

        # Mock chat not found
        mock_conn.fetchrow.return_value = None

        service = AssistantService(mock_conn)

        with pytest.raises(
            ValueError,
            match="Chat .* not found or no assistant agent configured for department",
        ):
            await service.get_assistant_run_context(chat_id, department_id)

    @pytest.mark.asyncio
    async def test_get_assistant_run_context_no_agent_configured(self, mock_conn):
        """Test error when no assistant agent configured for department."""
        chat_id = uuid.uuid4()
        department_id = uuid.uuid4()

        # Mock no agent configured (fetchrow returns None due to JOIN failure)
        mock_conn.fetchrow.return_value = None

        service = AssistantService(mock_conn)

        with pytest.raises(
            ValueError,
            match="Chat .* not found or no assistant agent configured for department",
        ):
            await service.get_assistant_run_context(chat_id, department_id)

    @pytest.mark.asyncio
    async def test_get_assistant_run_context_empty_messages(
        self, mock_conn, sample_context_row
    ):
        """Test context retrieval with no messages or tool calls."""
        chat_id = uuid.uuid4()
        department_id = uuid.uuid4()

        # Mock empty messages and tool calls
        mock_conn.fetchrow.return_value = sample_context_row
        mock_conn.fetch.side_effect = [[], []]

        service = AssistantService(mock_conn)
        context = await service.get_assistant_run_context(chat_id, department_id)

        assert len(context.messages) == 0
        assert len(context.tool_calls) == 0

    @pytest.mark.asyncio
    async def test_get_assistant_run_context_with_different_roles(
        self, mock_conn, sample_messages, sample_tool_calls
    ):
        """Test context with different user roles."""
        chat_id = uuid.uuid4()
        department_id = uuid.uuid4()

        # Test different roles
        roles = ["superadmin", "admin", "instructional", "ta", "guest"]

        for role in roles:
            context_row = MockRow(
                chat_id=str(uuid.uuid4()),
                title="Test Chat",
                trace_id="test-trace-id",
                profile_id=str(uuid.uuid4()),
                user_role=role,
                user_first_name="Test",
                user_last_name="User",
                agent_id=str(uuid.uuid4()),
                agent_name="Assistant",
                system_prompt="Prompt",
                temperature=0.7,
                reasoning="medium",
                model_id=str(uuid.uuid4()),
                model_name="gpt-4",
                custom_model=False,
                provider_id=str(uuid.uuid4()),
                provider_name="openai",
                base_url=None,
                api_key="key",
            )

            mock_conn.fetchrow.return_value = context_row
            mock_conn.fetch.side_effect = [sample_messages, sample_tool_calls]

            service = AssistantService(mock_conn)
            context = await service.get_assistant_run_context(chat_id, department_id)

            assert context.user_role == role
            assert context.user_role_display in [
                "Super Administrator",
                "Administrator",
                "Instructional",
                "GTA",
                "Guest",
            ]

    @pytest.mark.asyncio
    async def test_get_assistant_run_context_user_name_property(
        self, mock_conn, sample_context_row, sample_messages, sample_tool_calls
    ):
        """Test user_name property returns correctly formatted name."""
        chat_id = uuid.uuid4()
        department_id = uuid.uuid4()

        mock_conn.fetchrow.return_value = sample_context_row
        mock_conn.fetch.side_effect = [sample_messages, sample_tool_calls]

        service = AssistantService(mock_conn)
        context = await service.get_assistant_run_context(chat_id, department_id)

        expected_name = f"{sample_context_row['user_first_name']} {sample_context_row['user_last_name']}"
        assert context.user_name == expected_name

    @pytest.mark.asyncio
    async def test_get_assistant_run_context_with_custom_model(
        self, mock_conn, sample_messages, sample_tool_calls
    ):
        """Test context retrieval with custom model."""
        chat_id = uuid.uuid4()
        department_id = uuid.uuid4()

        # Create context with custom model
        context_row = MockRow(
            chat_id=str(uuid.uuid4()),
            title="Test Chat",
            trace_id="test-trace-id",
            profile_id=str(uuid.uuid4()),
            user_role="admin",
            user_first_name="John",
            user_last_name="Doe",
            agent_id=str(uuid.uuid4()),
            agent_name="Assistant",
            system_prompt="Prompt",
            temperature=0.9,
            reasoning="high",
            model_id=str(uuid.uuid4()),
            model_name="custom-model",
            custom_model=True,
            provider_id=str(uuid.uuid4()),
            provider_name="custom-provider",
            base_url="https://custom.api.com",
            api_key="custom_key",
        )

        mock_conn.fetchrow.return_value = context_row
        mock_conn.fetch.side_effect = [sample_messages, sample_tool_calls]

        service = AssistantService(mock_conn)
        context = await service.get_assistant_run_context(chat_id, department_id)

        assert context.custom_model is True
        assert context.model_name == "custom-model"
        assert context.provider_name == "custom-provider"
        assert context.base_url == "https://custom.api.com"

