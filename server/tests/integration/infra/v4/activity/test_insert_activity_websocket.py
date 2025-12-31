"""Integration tests for app.infra.v4.activity.insert_websocket."""

import asyncpg
import pytest
from tests.sql.types import (
    CreateTestProfileSqlParams,
    CreateTestProfileSqlRow,
    TestGetActivityByMessageAndEndpointSqlParams,
    TestGetActivityByMessageAndEndpointSqlRow,
    TestGetActivityByMessageSqlParams,
    TestGetActivityByMessageSqlRow,
)
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.insert_websocket import insert_activity_websocket

pytestmark = pytest.mark.asyncio


class TestInsertActivityWebsocket:
    """Tests for insert_activity_websocket function."""

    async def test_insert_activity_websocket_success(
        self, db: asyncpg.Connection
    ) -> None:
        """Test successful websocket activity insertion."""
        # Arrange
        result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/api/profile/test_create_test_profile_v4_complete.sql",
            params=CreateTestProfileSqlParams(
                profile_first_name="Test",
                profile_last_name="User",
                profile_role="student",
                profile_active=True,
                profile_default_profile=False,
            ),
        )
        typed_result = CreateTestProfileSqlRow.model_validate(result.model_dump())
        profile_id = typed_result.profile_id
        assert profile_id is not None

        # Act
        await insert_activity_websocket(
            message="WebSocket event occurred",
            endpoint="/socket/v4/test",
            profile_id=str(profile_id),
            error=False,
            conn=db,
        )

        # Assert
        activity_result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/infra/activity/test_get_activity_by_message_and_endpoint_v4_complete.sql",
            params=TestGetActivityByMessageAndEndpointSqlParams(
                p_message="WebSocket event occurred",
                p_endpoint="/socket/v4/test",
            ),
        )
        typed_activity = TestGetActivityByMessageAndEndpointSqlRow.model_validate(
            activity_result.model_dump()
        )
        assert typed_activity.id is not None
        assert typed_activity.message == "WebSocket event occurred"
        assert typed_activity.endpoint == "/socket/v4/test"
        assert typed_activity.profile_id == profile_id
        assert typed_activity.error is False

    async def test_insert_activity_websocket_with_error(
        self, db: asyncpg.Connection
    ) -> None:
        """Test websocket activity insertion with error flag."""
        # Arrange
        result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/api/profile/test_create_test_profile_v4_complete.sql",
            params=CreateTestProfileSqlParams(
                profile_first_name="Test",
                profile_last_name="User",
                profile_role="student",
                profile_active=True,
                profile_default_profile=False,
            ),
        )
        typed_result = CreateTestProfileSqlRow.model_validate(result.model_dump())
        profile_id = typed_result.profile_id
        assert profile_id is not None

        # Act
        await insert_activity_websocket(
            message="WebSocket error",
            endpoint="/socket/v4/test",
            profile_id=str(profile_id),
            error=True,
            conn=db,
        )

        # Assert
        activity_result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/infra/activity/test_get_activity_by_message_v4_complete.sql",
            params=TestGetActivityByMessageSqlParams(p_message="WebSocket error"),
        )
        typed_activity = TestGetActivityByMessageSqlRow.model_validate(
            activity_result.model_dump()
        )
        assert typed_activity.id is not None
        assert typed_activity.error is True

    async def test_insert_activity_websocket_without_profile(
        self, db: asyncpg.Connection
    ) -> None:
        """Test websocket activity insertion without profile_id."""
        # Arrange & Act
        await insert_activity_websocket(
            message="Anonymous websocket activity",
            endpoint="/socket/v4/test",
            profile_id=None,
            error=False,
            conn=db,
        )

        # Assert
        activity_result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/infra/activity/test_get_activity_by_message_v4_complete.sql",
            params=TestGetActivityByMessageSqlParams(
                p_message="Anonymous websocket activity"
            ),
        )
        typed_activity = TestGetActivityByMessageSqlRow.model_validate(
            activity_result.model_dump()
        )
        assert typed_activity.id is not None
        assert typed_activity.profile_id is None

