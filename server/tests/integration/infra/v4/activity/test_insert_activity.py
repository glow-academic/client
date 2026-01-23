"""Integration tests for app.infra.v4.activity.insert."""

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
from app.utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.insert import insert_activity

pytestmark = pytest.mark.asyncio


class TestInsertActivity:
    """Tests for insert_activity function."""

    async def test_insert_activity_success(self, db: asyncpg.Connection) -> None:
        """Test successful activity insertion."""
        # Arrange
        result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/queries/api/profile/test_create_test_profile_v4_complete.sql",
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
        await insert_activity(
            message="Test activity message",
            endpoint="/api/v4/test",
            profile_id=str(profile_id),
            error=False,
            conn=db,
        )

        # Assert
        activity_result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/queries/infra/activity/test_get_activity_by_message_and_endpoint_v4_complete.sql",
            params=TestGetActivityByMessageAndEndpointSqlParams(
                p_message="Test activity message",
                p_endpoint="/api/v4/test",
            ),
        )
        typed_activity = TestGetActivityByMessageAndEndpointSqlRow.model_validate(
            activity_result.model_dump()
        )
        assert typed_activity.id is not None
        assert typed_activity.message == "Test activity message"
        assert typed_activity.endpoint == "/api/v4/test"
        assert typed_activity.profile_id == profile_id
        assert typed_activity.error is False

    async def test_insert_activity_with_error(self, db: asyncpg.Connection) -> None:
        """Test activity insertion with error flag."""
        # Arrange
        result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/queries/api/profile/test_create_test_profile_v4_complete.sql",
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
        await insert_activity(
            message="Error occurred",
            endpoint="/api/v4/test",
            profile_id=str(profile_id),
            error=True,
            conn=db,
        )

        # Assert
        activity_result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/queries/infra/activity/test_get_activity_by_message_v4_complete.sql",
            params=TestGetActivityByMessageSqlParams(p_message="Error occurred"),
        )
        typed_activity = TestGetActivityByMessageSqlRow.model_validate(
            activity_result.model_dump()
        )
        assert typed_activity.id is not None
        assert typed_activity.error is True

    async def test_insert_activity_without_profile(
        self, db: asyncpg.Connection
    ) -> None:
        """Test activity insertion without profile_id."""
        # Arrange & Act
        await insert_activity(
            message="Anonymous activity",
            endpoint="/api/v4/test",
            profile_id=None,
            error=False,
            conn=db,
        )

        # Assert
        activity_result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/queries/infra/activity/test_get_activity_by_message_v4_complete.sql",
            params=TestGetActivityByMessageSqlParams(p_message="Anonymous activity"),
        )
        typed_activity = TestGetActivityByMessageSqlRow.model_validate(
            activity_result.model_dump()
        )
        assert typed_activity.id is not None
        assert typed_activity.profile_id is None

    async def test_insert_activity_with_nonexistent_profile(
        self, db: asyncpg.Connection
    ) -> None:
        """Test activity insertion with nonexistent profile_id."""
        # Arrange
        fake_profile_id = "00000000-0000-0000-0000-000000000000"

        # Act
        await insert_activity(
            message="Activity with fake profile",
            endpoint="/api/v4/test",
            profile_id=fake_profile_id,
            error=False,
            conn=db,
        )

        # Assert
        activity_result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/queries/infra/activity/test_get_activity_by_message_v4_complete.sql",
            params=TestGetActivityByMessageSqlParams(
                p_message="Activity with fake profile"
            ),
        )
        typed_activity = TestGetActivityByMessageSqlRow.model_validate(
            activity_result.model_dump()
        )
        assert typed_activity.id is not None
        # Profile ID should be NULL since profile doesn't exist
        assert typed_activity.profile_id is None
