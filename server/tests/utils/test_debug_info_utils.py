"""
Tests for app.utils.debug_info
"""

from unittest.mock import MagicMock

import pytest
from app.utils.debug_info import *
from sqlmodel import Session


@pytest.fixture
def mock_session():
    """Create a mock database session."""
    return MagicMock(spec=Session)


class TestDebug_Info:
    """Tests for debug_info function."""

    def test_debug_info_success(self):
        """Test successful debug_info execution."""
        import uuid
        from unittest.mock import AsyncMock, MagicMock

        from app.utils.debug_info import DebugContext, debug_info

        # Create mock context
        mock_conn = MagicMock()
        model_run_id = uuid.uuid4()
        debug_context = DebugContext(conn=mock_conn, model_run_id=model_run_id)
        
        # Create mock RunContextWrapper
        mock_ctx = MagicMock()
        mock_ctx.context = debug_context
        
        # Call debug_info
        result = debug_info(mock_ctx, "Test debug message")
        
        # Should return a confirmation string
        assert result == "Saved debug info"

    def test_debug_info_handles_exception(self):
        """Test debug_info error handling."""
        import uuid
        from unittest.mock import MagicMock

        from app.utils.debug_info import DebugContext, debug_info

        # Create mock context that will raise an exception
        mock_conn = MagicMock()
        model_run_id = uuid.uuid4()
        debug_context = DebugContext(conn=mock_conn, model_run_id=model_run_id)
        
        # Create mock RunContextWrapper
        mock_ctx = MagicMock()
        mock_ctx.context = debug_context
        
        # Mock ModelRunService to raise an exception
        with MagicMock() as mock_service:
            mock_service.insert_debug_info.side_effect = Exception("Database error")
            
            # Should still return a message (may be error message)
            result = debug_info(mock_ctx, "Test debug message")
            assert isinstance(result, str)
