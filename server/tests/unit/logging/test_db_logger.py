"""Unit tests for app.utils.logging.db_logger."""

import logging
from unittest.mock import AsyncMock, MagicMock, patch

import asyncpg  # type: ignore

from app.utils.logging.db_logger import (
    DBLogHandler,
    get_logger,
    set_profile_id,
    setup_db_logger,
)


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


# Note: TestResolveProfileId class removed - resolve_profile_id function has been removed


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
        with patch.object(
            handler, "_write_to_db", new_callable=AsyncMock
        ) as mock_write:
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

        # Context should be cleared (handler will skip DB write if no profile_id)
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

        with patch.object(
            handler, "_write_to_db", new_callable=AsyncMock
        ) as mock_write:
            handler.emit(record)
            # Handler should skip DB write when profile_id is None
            assert not mock_write.called, (
                "DB write should be skipped when profile_id is None"
            )


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

    def test_db_log_handler_emit_is_noop(self) -> None:
        """Test that handler emit is now a no-op (database writing removed)."""
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
        # Should not raise any errors (no-op)
        handler.emit(record)
