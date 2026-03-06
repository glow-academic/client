"""Tests for infra.websocket.persist_message — message persistence chain.

Uses mocked black-box entry creators + real tmp_path for file I/O.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.websocket.persist_message import persist_message


MODULE = "app.infra.websocket.persist_message"


def _mock_response(id=None):
    """Minimal mock response with an .id attribute."""
    mock = AsyncMock()
    mock.id = id or uuid4()
    return mock


@pytest.mark.asyncio
class TestPersistMessage:
    async def test_full_chain_creates_all_entries(self, tmp_path):
        """Verify the full chain: file → upload → text → junctions → message → complete."""
        run_id = uuid4()
        session_id = uuid4()

        upload_res = _mock_response()
        text_res = _mock_response()
        text_upload_res = _mock_response()
        message_res = _mock_response()
        message_upload_res = _mock_response()
        completion_res = _mock_response()

        with (
            patch(f"{MODULE}.create_upload", new_callable=AsyncMock, return_value=upload_res) as mock_upload,
            patch(f"{MODULE}.create_text", new_callable=AsyncMock, return_value=text_res) as mock_text,
            patch(f"{MODULE}.create_text_upload", new_callable=AsyncMock, return_value=text_upload_res) as mock_text_upload,
            patch(f"{MODULE}.create_message", new_callable=AsyncMock, return_value=message_res) as mock_message,
            patch(f"{MODULE}.create_message_upload", new_callable=AsyncMock, return_value=message_upload_res) as mock_msg_upload,
            patch(f"{MODULE}.create_messages_completions_entry_internal", new_callable=AsyncMock, return_value=completion_res) as mock_complete,
        ):
            result = await persist_message(
                None,
                run_id=run_id,
                session_id=session_id,
                role="system",
                content="You are a helpful assistant.",
                upload_folder=tmp_path,
            )

        assert result == message_res.id

        # Verify file was written
        text_dir = tmp_path / "text"
        files = list(text_dir.glob("*.txt"))
        assert len(files) == 1
        assert files[0].read_text() == "You are a helpful assistant."

        # Verify upload created with correct path and size
        mock_upload.assert_called_once()
        call_kwargs = mock_upload.call_args
        assert call_kwargs.kwargs["mime_type"] == "text/plain"
        assert call_kwargs.kwargs["size"] == len("You are a helpful assistant.".encode())
        assert call_kwargs.kwargs["session_id"] == session_id

        # Verify text entry created
        mock_text.assert_called_once()
        assert mock_text.call_args.kwargs["session_id"] == session_id

        # Verify text ↔ upload junction
        mock_text_upload.assert_called_once()
        assert mock_text_upload.call_args.kwargs["text_id"] == text_res.id
        assert mock_text_upload.call_args.kwargs["upload_id"] == upload_res.id

        # Verify message created with correct role
        mock_message.assert_called_once()
        assert mock_message.call_args.kwargs["run_id"] == run_id
        assert mock_message.call_args.kwargs["role"] == "system"

        # Verify message ↔ upload junction
        mock_msg_upload.assert_called_once()
        assert mock_msg_upload.call_args.kwargs["message_id"] == message_res.id
        assert mock_msg_upload.call_args.kwargs["upload_id"] == upload_res.id

        # Verify completion marked
        mock_complete.assert_called_once()
        assert mock_complete.call_args.kwargs["message_id"] == message_res.id

    async def test_developer_role(self, tmp_path):
        """Works with developer role."""
        with (
            patch(f"{MODULE}.create_upload", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_text", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_text_upload", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_message", new_callable=AsyncMock, return_value=_mock_response()) as mock_message,
            patch(f"{MODULE}.create_message_upload", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_messages_completions_entry_internal", new_callable=AsyncMock, return_value=_mock_response()),
        ):
            await persist_message(
                None,
                run_id=uuid4(),
                session_id=uuid4(),
                role="developer",
                content="Generate a persona name.",
                upload_folder=tmp_path,
            )

        assert mock_message.call_args.kwargs["role"] == "developer"

    async def test_user_role(self, tmp_path):
        """Works with user role."""
        with (
            patch(f"{MODULE}.create_upload", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_text", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_text_upload", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_message", new_callable=AsyncMock, return_value=_mock_response()) as mock_message,
            patch(f"{MODULE}.create_message_upload", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_messages_completions_entry_internal", new_callable=AsyncMock, return_value=_mock_response()),
        ):
            await persist_message(
                None,
                run_id=uuid4(),
                session_id=uuid4(),
                role="user",
                content="Make it more friendly.",
                upload_folder=tmp_path,
            )

        assert mock_message.call_args.kwargs["role"] == "user"

    async def test_unicode_content(self, tmp_path):
        """Handles unicode content correctly."""
        content = "こんにちは 🎉 émojis"

        with (
            patch(f"{MODULE}.create_upload", new_callable=AsyncMock, return_value=_mock_response()) as mock_upload,
            patch(f"{MODULE}.create_text", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_text_upload", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_message", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_message_upload", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_messages_completions_entry_internal", new_callable=AsyncMock, return_value=_mock_response()),
        ):
            await persist_message(
                None,
                run_id=uuid4(),
                session_id=uuid4(),
                role="user",
                content=content,
                upload_folder=tmp_path,
            )

        # File written with correct encoding
        files = list((tmp_path / "text").glob("*.txt"))
        assert files[0].read_text(encoding="utf-8") == content

        # Size matches UTF-8 byte length
        assert mock_upload.call_args.kwargs["size"] == len(content.encode("utf-8"))

    async def test_creates_text_dir_if_missing(self, tmp_path):
        """Creates text/ subdirectory if it doesn't exist."""
        upload_folder = tmp_path / "uploads"
        # Don't create it — persist_message should mkdir

        with (
            patch(f"{MODULE}.create_upload", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_text", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_text_upload", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_message", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_message_upload", new_callable=AsyncMock, return_value=_mock_response()),
            patch(f"{MODULE}.create_messages_completions_entry_internal", new_callable=AsyncMock, return_value=_mock_response()),
        ):
            await persist_message(
                None,
                run_id=uuid4(),
                session_id=uuid4(),
                role="system",
                content="test",
                upload_folder=upload_folder,
            )

        assert (upload_folder / "text").is_dir()
