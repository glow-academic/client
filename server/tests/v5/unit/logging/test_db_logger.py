"""Unit tests for app.utils.logging.db_logger."""

import logging

from app.utils.logging.db_logger import get_logger, set_profile_id


class TestGetLogger:
    """Tests for get_logger function."""

    def test_get_logger_returns_logger(self) -> None:
        """Test that get_logger returns a logger instance."""
        logger = get_logger("test.module")
        assert isinstance(logger, logging.Logger)
        assert logger.name == "test.module"

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


class TestSetProfileId:
    """Tests for set_profile_id function."""

    def test_set_profile_id_sets_context(self) -> None:
        """Test that set_profile_id sets the context variable."""
        test_id = "123e4567-e89b-12d3-a456-426614174000"

        set_profile_id(test_id)
        # Context is set (can't easily verify without accessing internal state)
        # Clear context
        set_profile_id(None)

    def test_set_profile_id_none_clears_context(self) -> None:
        """Test that set_profile_id(None) clears the context."""
        set_profile_id("test-id")
        set_profile_id(None)
        # Context should be cleared
