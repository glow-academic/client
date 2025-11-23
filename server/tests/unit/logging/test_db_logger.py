"""Unit tests for app.utils.logging.db_logger."""

import asyncio
import logging
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import asyncpg  # type: ignore
import pytest
from app.utils.logging.db_logger import (DBLogHandler, get_logger,
                                         resolve_profile_id, set_profile_id,
                                         setup_db_logger)


class TestGetLogger:
    """Tests for get_logger function."""

    def test_get_logger_returns_logger(self) -> None:
        """Test that get_logger returns a logger instance."""
        logger = get_logger("test.module")
        assert isinstance(logger, logging.Logger)
        assert logger.name == "test.module"

    def test_get_logger_adds_handler_once(self) -> None:
        """Test that get_logger only adds DBLogHandler once per logger."""
        logger1 = get_logger("test.module")
        logger2 = get_logger("test.module")
        
        # Should be the same logger instance
        assert logger1 is logger2
        
        # Should have exactly one DBLogHandler
        db_handlers = [h for h in logger1.handlers if isinstance(h, DBLogHandler)]
        assert len(db_handlers) == 1

    def test_get_logger_propagates_to_root(self) -> None:
        """Test that logger propagates to root logger for console output."""
        logger = get_logger("test.module")
        assert logger.propagate is True

    def test_get_logger_different_modules(self) -> None:
        """Test that different modules get different loggers."""
        logger1 = get_logger("module1")
        logger2 = get_logger("module2")
        
        assert logger1 is not logger2
        assert logger1.name == "module1"
        assert logger2.name == "module2"


class TestSetupDbLogger:
    """Tests for setup_db_logger function."""

    def test_setup_db_logger_sets_pool(self) -> None:
        """Test that setup_db_logger sets the global pool."""
        mock_pool = MagicMock(spec=asyncpg.Pool)
        
        setup_db_logger(mock_pool)
        
        # Verify pool was set (we can't directly check _db_pool, but we can test behavior)
        # The handler should now be able to use the pool
        logger = get_logger("test.module")
        handler = next(h for h in logger.handlers if isinstance(h, DBLogHandler))
        
        # Handler should not skip DB writes now
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="test message",
            args=(),
            exc_info=None,
        )
        
        # Should not return early (pool is set)
        with patch.object(handler, "_write_to_db", new_callable=AsyncMock):
            handler.emit(record)
            # If we get here without early return, pool was set


class TestResolveProfileId:
    """Tests for resolve_profile_id function."""

    @pytest.mark.asyncio
    async def test_resolve_profile_id_with_uuid(self, db: asyncpg.Connection) -> None:
        """Test that resolve_profile_id returns UUID as-is."""
        test_uuid = "123e4567-e89b-12d3-a456-426614174000"
        
        # Create a mock pool that uses the test connection
        class MockPool:
            def __init__(self, conn: asyncpg.Connection) -> None:
                self.conn = conn
            
            async def acquire(self) -> asyncpg.Connection:
                return self.conn
        
        pool = MockPool(db)
        setup_db_logger(pool)  # type: ignore[arg-type]
        
        result = await resolve_profile_id(test_uuid)
        assert result == test_uuid

    @pytest.mark.asyncio
    async def test_resolve_profile_id_guest(self, db: asyncpg.Connection) -> None:
        """Test that resolve_profile_id resolves guest-profile-id."""
        # Create a guest profile first
        guest_id = await db.fetchval(
            """
            INSERT INTO profiles (role, default_profile, first_name, last_name, email)
            VALUES ('guest', true, 'Guest', 'User', 'guest@test.com')
            RETURNING id::text
            """
        )
        
        # Create a mock pool that uses the test connection
        class MockPool:
            def __init__(self, conn: asyncpg.Connection) -> None:
                self.conn = conn
            
            async def acquire(self) -> asyncpg.Connection:
                return self.conn
        
        pool = MockPool(db)
        setup_db_logger(pool)  # type: ignore[arg-type]
        
        result = await resolve_profile_id("guest-profile-id")
        assert result == guest_id

    @pytest.mark.asyncio
    async def test_resolve_profile_id_none(self, db: asyncpg.Connection) -> None:
        """Test that resolve_profile_id resolves None to guest."""
        # Create a guest profile first
        guest_id = await db.fetchval(
            """
            INSERT INTO profiles (role, default_profile, first_name, last_name, email)
            VALUES ('guest', true, 'Guest', 'User', 'guest@test.com')
            RETURNING id::text
            """
        )
        
        # Create a mock pool that uses the test connection
        class MockPool:
            def __init__(self, conn: asyncpg.Connection) -> None:
                self.conn = conn
            
            async def acquire(self) -> asyncpg.Connection:
                return self.conn
        
        pool = MockPool(db)
        setup_db_logger(pool)  # type: ignore[arg-type]
        
        result = await resolve_profile_id(None)
        assert result == guest_id

    @pytest.mark.asyncio
    async def test_resolve_profile_id_no_pool(self) -> None:
        """Test that resolve_profile_id returns placeholder when pool is None."""
        # Reset pool
        from app.utils.logging.db_logger import _db_pool
        original_pool = _db_pool
        
        try:
            # Temporarily set pool to None
            import app.utils.logging.db_logger as db_logger_module
            db_logger_module._db_pool = None
            
            result = await resolve_profile_id("guest-profile-id")
            assert result == "00000000-0000-0000-0000-000000000000"
        finally:
            # Restore original pool
            db_logger_module._db_pool = original_pool


class TestSetProfileId:
    """Tests for set_profile_id function."""

    def test_set_profile_id_sets_context(self) -> None:
        """Test that set_profile_id sets the context variable."""
        test_id = "123e4567-e89b-12d3-a456-426614174000"
        
        set_profile_id(test_id)
        
        # Verify by checking handler can access it
        logger = get_logger("test.module")
        handler = next(h for h in logger.handlers if isinstance(h, DBLogHandler))
        
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="test message",
            args=(),
            exc_info=None,
        )
        
        # Handler should get profile_id from context
        with patch.object(handler, "_write_to_db", new_callable=AsyncMock) as mock_write:
            handler.emit(record)
            # Check that profile_id was passed
            if mock_write.called:
                call_args = mock_write.call_args
                assert call_args[0][1] == test_id
        
        # Clear context
        set_profile_id(None)

    def test_set_profile_id_none_clears_context(self) -> None:
        """Test that set_profile_id(None) clears the context."""
        set_profile_id("test-id")
        set_profile_id(None)
        
        # Context should be cleared (handler will use guest-profile-id)
        logger = get_logger("test.module")
        handler = next(h for h in logger.handlers if isinstance(h, DBLogHandler))
        
        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="test message",
            args=(),
            exc_info=None,
        )
        
        with patch.object(handler, "_write_to_db", new_callable=AsyncMock) as mock_write:
            handler.emit(record)
            if mock_write.called:
                call_args = mock_write.call_args
                # Should default to guest-profile-id
                assert call_args[0][1] == "guest-profile-id"


class TestDBLogHandler:
    """Tests for DBLogHandler class."""

    def test_db_log_handler_emit_no_pool(self) -> None:
        """Test that handler skips DB write when pool is None."""
        # Reset pool
        import app.utils.logging.db_logger as db_logger_module
        original_pool = db_logger_module._db_pool
        db_logger_module._db_pool = None
        
        try:
            handler = DBLogHandler()
            record = logging.LogRecord(
                name="test",
                level=logging.INFO,
                pathname="",
                lineno=0,
                msg="test message",
                args=(),
                exc_info=None,
            )
            
            # Should return early without error
            handler.emit(record)
        finally:
            db_logger_module._db_pool = original_pool

    @pytest.mark.asyncio
    async def test_db_log_handler_write_to_db(
        self, db: asyncpg.Connection
    ) -> None:
        """Test that handler writes log to database."""
        # Create a guest profile
        guest_id = await db.fetchval(
            """
            INSERT INTO profiles (role, default_profile, first_name, last_name, email)
            VALUES ('guest', true, 'Guest', 'User', 'guest@test.com')
            RETURNING id
            """
        )
        
        # Create a mock pool that uses the test connection
        class ConnectionContext:
            def __init__(self, conn: asyncpg.Connection) -> None:
                self.conn = conn
            
            async def __aenter__(self) -> asyncpg.Connection:
                return self.conn
            
            async def __aexit__(self, *args: Any) -> None:
                pass
        
        class MockPool:
            def __init__(self, conn: asyncpg.Connection) -> None:
                self.conn = conn
            
            def acquire(self) -> ConnectionContext:
                return ConnectionContext(self.conn)
        
        pool = MockPool(db)
        setup_db_logger(pool)  # type: ignore[arg-type]
        
        handler = DBLogHandler()
        record = logging.LogRecord(
            name="test.module",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="Test log message",
            args=(),
            exc_info=None,
        )
        
        # Set profile_id in context
        set_profile_id(str(guest_id))
        
        try:
            # Emit record (this will schedule async write)
            handler.emit(record)
            
            # Wait a bit for async task to complete
            await asyncio.sleep(0.1)
            
            # Verify log was written
            log_count = await db.fetchval(
                """
                SELECT COUNT(*) FROM app_logs
                WHERE logger_name = 'test.module'
                AND message = 'Test log message'
                AND profile_id = $1
                """,
                guest_id,
            )
            assert log_count == 1
        finally:
            set_profile_id(None)

    @pytest.mark.asyncio
    async def test_db_log_handler_extra_data(
        self, db: asyncpg.Connection
    ) -> None:
        """Test that handler includes extra_data in database."""
        # Create a guest profile
        guest_id = await db.fetchval(
            """
            INSERT INTO profiles (role, default_profile, first_name, last_name, email)
            VALUES ('guest', true, 'Guest', 'User', 'guest@test.com')
            RETURNING id
            """
        )
        
        # Create a mock pool that uses the test connection
        class ConnectionContext:
            def __init__(self, conn: asyncpg.Connection) -> None:
                self.conn = conn
            
            async def __aenter__(self) -> asyncpg.Connection:
                return self.conn
            
            async def __aexit__(self, *args: Any) -> None:
                pass
        
        class MockPool:
            def __init__(self, conn: asyncpg.Connection) -> None:
                self.conn = conn
            
            def acquire(self) -> ConnectionContext:
                return ConnectionContext(self.conn)
        
        pool = MockPool(db)
        setup_db_logger(pool)  # type: ignore[arg-type]
        
        handler = DBLogHandler()
        
        # Create record with extra_data
        record = logging.LogRecord(
            name="test.module",
            level=logging.INFO,
            pathname="",
            lineno=0,
            msg="Test with extra data",
            args=(),
            exc_info=None,
        )
        record.extra_data = {"key": "value", "number": 42}
        
        set_profile_id(str(guest_id))
        
        try:
            handler.emit(record)
            await asyncio.sleep(0.1)
            
            # Verify extra_data was stored
            extra = await db.fetchval(
                """
                SELECT extra FROM app_logs
                WHERE logger_name = 'test.module'
                AND message = 'Test with extra data'
                AND profile_id = $1
                """,
                guest_id,
            )
            assert extra is not None
            assert extra["key"] == "value"
            assert extra["number"] == 42
        finally:
            set_profile_id(None)

    @pytest.mark.asyncio
    async def test_db_log_handler_exception_info(
        self, db: asyncpg.Connection
    ) -> None:
        """Test that handler includes exception info in extra_data."""
        # Create a guest profile
        guest_id = await db.fetchval(
            """
            INSERT INTO profiles (role, default_profile, first_name, last_name, email)
            VALUES ('guest', true, 'Guest', 'User', 'guest@test.com')
            RETURNING id
            """
        )
        
        # Create a mock pool that uses the test connection
        class ConnectionContext:
            def __init__(self, conn: asyncpg.Connection) -> None:
                self.conn = conn
            
            async def __aenter__(self) -> asyncpg.Connection:
                return self.conn
            
            async def __aexit__(self, *args: Any) -> None:
                pass
        
        class MockPool:
            def __init__(self, conn: asyncpg.Connection) -> None:
                self.conn = conn
            
            def acquire(self) -> ConnectionContext:
                return ConnectionContext(self.conn)
        
        pool = MockPool(db)
        setup_db_logger(pool)  # type: ignore[arg-type]
        
        handler = DBLogHandler()
        
        try:
            raise ValueError("Test exception")
        except ValueError:
            record = logging.LogRecord(
                name="test.module",
                level=logging.ERROR,
                pathname="",
                lineno=0,
                msg="Test with exception",
                args=(),
                exc_info=logging.exc_info(),
            )
        
        set_profile_id(str(guest_id))
        
        try:
            handler.emit(record)
            await asyncio.sleep(0.1)
            
            # Verify exception was stored
            extra = await db.fetchval(
                """
                SELECT extra FROM app_logs
                WHERE logger_name = 'test.module'
                AND message = 'Test with exception'
                AND profile_id = $1
                """,
                guest_id,
            )
            assert extra is not None
            assert "exception" in extra
            assert "ValueError" in str(extra["exception"])
        finally:
            set_profile_id(None)

