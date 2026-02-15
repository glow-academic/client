"""OpenAI Realtime API adapter for voice mode.

This adapter connects to the OpenAI Realtime API via WebSocket and handles
bidirectional audio streaming between the client and OpenAI.

Architecture:
- Uplink loop: Consumes from session.inbound_queue, sends to OpenAI WebSocket
- Downlink loop: Receives from OpenAI WebSocket, emits via internal_sio

The adapter uses the server-side WebSocket approach (not WebRTC ephemeral keys)
to maintain control over the connection and enable server-side processing.
"""

import asyncio
import base64
import json
import logging
from typing import Any, Literal

import websockets
from websockets.asyncio.client import ClientConnection

from app.infra.v4.websocket.adapters.audio.base import (
    AudioSessionConfig,
    BaseAudioAdapter,
)
from app.infra.v4.websocket.session_store import AudioSession
from app.main import get_internal_sio

logger = logging.getLogger(__name__)

internal_sio = get_internal_sio()

# OpenAI Realtime API endpoint
OPENAI_REALTIME_URL = "wss://api.openai.com/v1/realtime"

# Default model for realtime
DEFAULT_REALTIME_MODEL = "gpt-4o-realtime-preview-2024-12-17"


class OpenAIRealtimeAdapter(BaseAudioAdapter):
    """OpenAI Realtime API adapter using WebSocket connection.

    This adapter maintains a WebSocket connection to OpenAI's Realtime API
    and handles bidirectional audio streaming.
    """

    def __init__(self) -> None:
        self._tasks: dict[
            str, list[asyncio.Task[Any]]
        ] = {}  # group_id -> [uplink_task, downlink_task]

    def get_implementation_type(self) -> Literal["webrtc", "websocket"]:
        """This adapter uses WebSocket (server-side connection)."""
        return "websocket"

    async def initialize_session(
        self,
        session: AudioSession,
        api_key: str,
        model: str | None = None,
        voice: str | None = None,
        instructions: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AudioSessionConfig:
        """Initialize a realtime session with OpenAI.

        Establishes WebSocket connection and starts uplink/downlink loops.

        Args:
            session: The AudioSession containing queues and metadata
            api_key: Decrypted OpenAI API key
            model: Model to use (defaults to gpt-4o-realtime-preview)
            voice: Voice for TTS (e.g., "alloy", "echo", "shimmer")
            instructions: System instructions for the session
            tools: Tools available to the model
            **kwargs: Additional options (turn_detection, etc.)

        Returns:
            AudioSessionConfig with session details
        """
        model = model or DEFAULT_REALTIME_MODEL
        voice = voice or "alloy"

        # Build WebSocket URL with model
        ws_url = f"{OPENAI_REALTIME_URL}?model={model}"

        # Connect to OpenAI Realtime API
        headers = {
            "Authorization": f"Bearer {api_key}",
            "OpenAI-Beta": "realtime=v1",
        }

        try:
            ws = await websockets.connect(ws_url, additional_headers=headers)
            session.oa_ws_connection = ws

            logger.info(
                f"Connected to OpenAI Realtime API - group_id={session.group_id}"
            )

            # Configure the session
            session_config: dict[str, Any] = {
                "modalities": ["text", "audio"],
                "voice": voice,
                "input_audio_format": "pcm16",
                "output_audio_format": "pcm16",
                "input_audio_transcription": {
                    "model": "whisper-1",
                },
                "turn_detection": kwargs.get(
                    "turn_detection",
                    {
                        "type": "server_vad",
                        "threshold": 0.5,
                        "prefix_padding_ms": 300,
                        "silence_duration_ms": 500,
                    },
                ),
            }

            if instructions:
                session_config["instructions"] = instructions

            if tools:
                session_config["tools"] = self._format_tools(tools)
                session_config["tool_choice"] = "auto"

            # Send session.update to configure
            await ws.send(
                json.dumps(
                    {
                        "type": "session.update",
                        "session": session_config,
                    }
                )
            )

            # Start uplink and downlink loops
            uplink_task = asyncio.create_task(
                self._uplink_loop(session),
                name=f"uplink-{session.group_id}",
            )
            downlink_task = asyncio.create_task(
                self._downlink_loop(session),
                name=f"downlink-{session.group_id}",
            )

            self._tasks[session.group_id] = [uplink_task, downlink_task]

            logger.info(f"Started uplink/downlink loops - group_id={session.group_id}")

            return AudioSessionConfig(
                model=model,
                voice=voice,
                instructions=instructions,
                tools=tools,
                turn_detection=session_config.get("turn_detection"),
            )

        except Exception as e:
            logger.exception(f"Failed to connect to OpenAI Realtime API: {e}")
            raise

    async def stop_session(self, session: AudioSession) -> None:
        """Stop the audio session and clean up resources.

        Cancels uplink/downlink tasks and closes the WebSocket connection.
        """
        group_id = session.group_id

        # Cancel tasks
        tasks = self._tasks.pop(group_id, [])
        for task in tasks:
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        # Close WebSocket
        ws = session.oa_ws_connection
        if ws:
            try:
                await ws.close()
            except Exception:
                pass
            session.oa_ws_connection = None

        logger.info(f"Stopped audio session - group_id={group_id}")

    async def _uplink_loop(self, session: AudioSession) -> None:
        """Consume from inbound_queue and send to OpenAI.

        Handles:
        - audio: Send PCM16 audio to OpenAI
        - mic.set_muted: Handle mute state changes
        """
        ws: ClientConnection = session.oa_ws_connection
        group_id = session.group_id

        try:
            while True:
                # Get message from inbound queue
                msg = await session.inbound_queue.get()
                msg_type = msg.get("type")

                if msg_type == "audio":
                    # Send audio to OpenAI
                    audio_data = msg.get("pcm16_bytes")
                    if audio_data and not session.muted:
                        # Convert to base64 if bytes
                        if isinstance(audio_data, bytes):
                            audio_b64 = base64.b64encode(audio_data).decode("utf-8")
                        else:
                            # Already base64 string
                            audio_b64 = audio_data

                        await ws.send(
                            json.dumps(
                                {
                                    "type": "input_audio_buffer.append",
                                    "audio": audio_b64,
                                }
                            )
                        )

                elif msg_type == "mic.set_muted":
                    session.muted = msg.get("muted", False)
                    logger.debug(f"Mic muted={session.muted} - group_id={group_id}")

                    # If unmuting, clear the buffer to start fresh
                    if not session.muted:
                        await ws.send(
                            json.dumps(
                                {
                                    "type": "input_audio_buffer.clear",
                                }
                            )
                        )

        except asyncio.CancelledError:
            logger.info(f"Uplink loop cancelled - group_id={group_id}")
            raise
        except Exception as e:
            logger.exception(f"Uplink loop error - group_id={group_id}: {e}")
            await self._emit_error(session, f"Uplink error: {str(e)}")

    async def _downlink_loop(self, session: AudioSession) -> None:
        """Receive from OpenAI and emit internal events.

        Translates OpenAI Realtime events to internal events:
        - response.audio.delta -> generate_audio_delta
        - input_audio_buffer.speech_started -> generate_user_speech_start
        - conversation.item.input_audio_transcription.completed -> generate_user_speech_delta
        """
        ws: ClientConnection = session.oa_ws_connection
        group_id = session.group_id

        # Track current item for user speech
        current_user_item_id: str | None = None

        try:
            async for message in ws:
                if isinstance(message, bytes):
                    # Binary message - shouldn't happen with Realtime API
                    continue

                event = json.loads(message)
                event_type = event.get("type", "")

                # Log events for debugging (except frequent audio deltas)
                if event_type != "response.audio.delta":
                    logger.debug(f"OpenAI event: {event_type} - group_id={group_id}")

                # Handle different event types
                if event_type == "session.created":
                    logger.info(f"Session created - group_id={group_id}")

                elif event_type == "session.updated":
                    logger.info(f"Session updated - group_id={group_id}")

                elif event_type == "input_audio_buffer.speech_started":
                    # User started speaking
                    item_id = event.get("item_id", f"user-{group_id}")
                    current_user_item_id = item_id

                    await internal_sio.emit(
                        "generate_user_speech_start",
                        {
                            "group_id": group_id,
                            "item_id": item_id,
                        },
                    )

                elif event_type == "input_audio_buffer.speech_stopped":
                    # User stopped speaking - VAD detected end
                    pass  # Transcription will come separately

                elif (
                    event_type
                    == "conversation.item.input_audio_transcription.completed"
                ):
                    # User speech transcribed — this is the final transcript
                    transcript = event.get("transcript", "")
                    item_id = event.get(
                        "item_id", current_user_item_id or f"user-{group_id}"
                    )

                    await internal_sio.emit(
                        "generate_user_speech_delta",
                        {
                            "group_id": group_id,
                            "item_id": item_id,
                            "transcript": transcript,
                        },
                    )

                    # Emit speech complete so the user message gets finalized in DB
                    await internal_sio.emit(
                        "generate_user_speech_complete",
                        {
                            "group_id": group_id,
                            "item_id": item_id,
                            "transcript": transcript,
                        },
                    )

                elif event_type == "response.audio.delta":
                    # Assistant audio chunk
                    audio_b64 = event.get("delta", "")
                    if audio_b64:
                        # Decode base64 to bytes for client
                        audio_bytes = base64.b64decode(audio_b64)

                        await internal_sio.emit(
                            "generate_audio_delta",
                            {
                                "group_id": group_id,
                                "audio": audio_bytes,
                            },
                        )

                elif event_type == "response.audio_transcript.delta":
                    # Assistant transcript delta (optional - for display)
                    transcript = event.get("delta", "")
                    if transcript:
                        await internal_sio.emit(
                            "generate_assistant_transcript_delta",
                            {
                                "group_id": group_id,
                                "transcript": transcript,
                            },
                        )

                elif event_type == "response.done":
                    # Response completed
                    response = event.get("response", {})
                    usage = response.get("usage", {})
                    logger.info(f"Response done - group_id={group_id}, usage={usage}")

                elif event_type == "error":
                    # Error from OpenAI
                    error = event.get("error", {})
                    error_msg = error.get("message", "Unknown error")
                    logger.error(f"OpenAI error - group_id={group_id}: {error_msg}")
                    await self._emit_error(session, error_msg)

        except asyncio.CancelledError:
            logger.info(f"Downlink loop cancelled - group_id={group_id}")
            raise
        except websockets.exceptions.ConnectionClosed as e:
            logger.warning(f"WebSocket closed - group_id={group_id}: {e}")
        except Exception as e:
            logger.exception(f"Downlink loop error - group_id={group_id}: {e}")
            await self._emit_error(session, f"Downlink error: {str(e)}")

    async def _emit_error(self, session: AudioSession, message: str) -> None:
        """Emit an error event."""
        await internal_sio.emit(
            "generate_audio_error",
            {
                "group_id": session.group_id,
                "error_message": message,
            },
        )

    def _format_tools(self, tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Format tools for OpenAI Realtime API.

        Realtime API expects tools in a specific format.
        """
        formatted = []
        for tool in tools:
            if tool.get("type") == "function":
                # Already in correct format
                formatted.append(tool)
            elif "function" in tool:
                # Convert from Chat Completions format
                func = tool["function"]
                formatted.append(
                    {
                        "type": "function",
                        "name": func.get("name"),
                        "description": func.get("description"),
                        "parameters": func.get("parameters", {}),
                    }
                )
        return formatted
