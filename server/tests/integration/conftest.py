"""Pytest configuration for API route tests."""

from collections.abc import AsyncGenerator
from contextlib import contextmanager
from typing import Any
from unittest.mock import patch

import asyncpg  # type: ignore
import httpx
import pytest
import pytest_asyncio

# Patch agents library BEFORE importing app.main to prevent actual API calls
# This must happen at module import time, not in a fixture


# Create mock classes first
class MockUsage:
    """Mock Usage class with token counts."""

    def __init__(self) -> None:
        self.input_tokens = 100
        self.output_tokens = 50


class MockContextWrapper:
    """Mock RunContextWrapper with usage attribute."""

    def __init__(self) -> None:
        self.usage = MockUsage()


class MockRunResult:
    """Mock result from Runner.run()."""

    def __init__(self) -> None:
        self.context_wrapper = MockContextWrapper()
        self.items: list[Any] = []
        self.final_output: str = "Test Assistant Response"


class MockStreamedRunResult:
    """Mock result from Runner.run_streamed() with stream_events()."""

    def __init__(self) -> None:
        self.context_wrapper = MockContextWrapper()

    async def stream_events(self) -> AsyncGenerator[Any, None]:
        """Mock async generator for stream events."""
        # Return empty generator - tests shouldn't rely on streaming behavior
        # Empty generator completes immediately, allowing the async for loop to finish
        if False:  # pragma: no cover
            yield


class MockRunner:
    """Mock Runner class for agents library."""

    @staticmethod
    async def run(
        agent: Any, input: Any, context: Any = None, **kwargs: Any
    ) -> MockRunResult:
        """Mock Runner.run() - returns mock result without making API calls."""
        return MockRunResult()

    @staticmethod
    def run_streamed(
        agent: Any, input: Any, context: Any = None, **kwargs: Any
    ) -> MockStreamedRunResult:
        """Mock Runner.run_streamed() - returns mock result without making API calls."""
        return MockStreamedRunResult()


@contextmanager
def mock_trace(*args: Any, **kwargs: Any) -> Any:
    """Mock trace() context manager - no-op for testing."""
    yield


class MockAgent:
    """Mock Agent class for agents library."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Accept any arguments but don't do anything."""
        self.tool_use_behavior: Any | None = None
        # Store common attributes that might be accessed
        for key, value in kwargs.items():
            setattr(self, key, value)

    def __class_getitem__(cls, item: Any) -> type:
        """Support generic type annotations like Agent[DebugContext]."""
        return cls


class MockModelSettings:
    """Mock ModelSettings class for agents library."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Accept any arguments but don't do anything."""
        for key, value in kwargs.items():
            setattr(self, key, value)


class MockTool:
    """Mock Tool class for agents library."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Accept any arguments but don't do anything."""
        for key, value in kwargs.items():
            setattr(self, key, value)


class MockLitellmModel:
    """Mock LitellmModel class for agents library."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Accept any arguments but don't do anything."""
        for key, value in kwargs.items():
            setattr(self, key, value)


class MockGuardrailFunctionOutput:
    """Mock GuardrailFunctionOutput class."""

    def __init__(
        self, output_info: Any = None, tripwire_triggered: bool = False
    ) -> None:
        self.output_info = output_info
        self.tripwire_triggered = tripwire_triggered


class MockToolsToFinalOutputResult:
    """Mock ToolsToFinalOutputResult class."""

    def __init__(self, is_final_output: bool = True) -> None:
        self.is_final_output = is_final_output


class MockOutputGuardrail:
    """Mock OutputGuardrail class."""

    def __init__(self, func: Any) -> None:
        self.func = func

    def __class_getitem__(cls, item: Any) -> type:
        """Support generic type annotations like OutputGuardrail[TContext]."""
        return cls


class MockInputGuardrail:
    """Mock InputGuardrail class."""

    def __init__(self, func: Any) -> None:
        self.func = func

    def __class_getitem__(cls, item: Any) -> type:
        """Support generic type annotations like InputGuardrail[TContext]."""
        return cls


class MockRunContextWrapper:
    """Mock RunContextWrapper class."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self.usage = MockUsage()

    def __class_getitem__(cls, item: Any) -> type:
        """Support generic type annotations like RunContextWrapper[DebugContext]."""
        return cls


class MockMCPServer:
    """Mock MCPServer class."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Accept any arguments but don't do anything."""
        for key, value in kwargs.items():
            setattr(self, key, value)


class MockMCPServerStreamableHttp:
    """Mock MCPServerStreamableHttp context manager."""

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Accept any arguments but don't do anything."""
        for key, value in kwargs.items():
            setattr(self, key, value)

    async def __aenter__(self) -> Any:
        """Async context manager entry."""
        return self

    async def __aexit__(self, *args: Any) -> None:
        """Async context manager exit."""
        pass


def mock_function_tool(func: Any) -> Any:
    """Mock function_tool decorator - returns function unchanged."""
    return func


def mock_gen_trace_id() -> str:
    """Mock gen_trace_id() - returns a fake trace ID."""
    return "test-trace-id-12345"


class MockOutputGuardrailTripwireTriggered(Exception):
    """Mock OutputGuardrailTripwireTriggered exception."""

    pass


# Patch agents module immediately - before any app imports
_agents_patcher = patch.multiple(
    "agents",
    Agent=MockAgent,
    Runner=MockRunner,
    trace=mock_trace,
    ModelSettings=MockModelSettings,
    Tool=MockTool,
    GuardrailFunctionOutput=MockGuardrailFunctionOutput,
    ToolsToFinalOutputResult=MockToolsToFinalOutputResult,
    OutputGuardrail=MockOutputGuardrail,
    InputGuardrail=MockInputGuardrail,
    RunContextWrapper=MockRunContextWrapper,
    function_tool=mock_function_tool,
    gen_trace_id=mock_gen_trace_id,
)

# Patch LitellmModel separately since it's in a submodule
_litellm_model_patcher = patch(
    "agents.extensions.models.litellm_model.LitellmModel", MockLitellmModel
)

# Patch MCP server classes
_mcp_server_patcher = patch.multiple(
    "agents.mcp.server",
    MCPServer=MockMCPServer,
    MCPServerStreamableHttp=MockMCPServerStreamableHttp,
)

# Patch exceptions
_exceptions_patcher = patch(
    "agents.exceptions.OutputGuardrailTripwireTriggered",
    MockOutputGuardrailTripwireTriggered,
)

# Start patching immediately
_agents_patcher.start()
_litellm_model_patcher.start()
_mcp_server_patcher.start()
_exceptions_patcher.start()

# Now safe to import app modules
from app.main import fastapi_app, get_db


@pytest_asyncio.fixture
async def client(
    db: asyncpg.Connection,
) -> AsyncGenerator[httpx.AsyncClient, None]:
    """Provide FastAPI TestClient with database dependency override.

    Overrides get_db to return the test database connection from the db fixture.
    This allows route tests to use the same database setup as service tests.
    """

    # Override get_db dependency to use test connection
    async def override_get_db() -> AsyncGenerator[asyncpg.Connection, None]:
        yield db

    fastapi_app.dependency_overrides[get_db] = override_get_db

    # Create async client using ASGI transport
    transport = httpx.ASGITransport(app=fastapi_app)
    async with httpx.AsyncClient(
        transport=transport, base_url="http://test"
    ) as test_client:
        yield test_client

    # Clean up dependency override
    fastapi_app.dependency_overrides.clear()
