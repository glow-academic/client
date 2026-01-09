"""Multi-modality coordinator for handling models that produce multiple modalities in a single API call."""

import uuid
from typing import Any

from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest

from .types import AgentConfig

internal_sio = get_internal_sio()


class MultiModalityCoordinator:
    """Coordinates generation when model outputs multiple modalities in a single API call."""

    async def generate(
        self,
        provider: str,
        output_modalities: list[str],
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID,
        conn: Any,
    ) -> dict[str, Any]:
        """Generate multiple modalities from single API call.

        Strategy:
        1. Determine if model supports multi-modality in single call
        2. Call appropriate provider adapter (e.g., OpenAI Realtime for text+audio)
        3. Parse response to extract each modality
        4. Route each modality to its output adapter for persistence
        5. Emit completion events for each modality

        Args:
            provider: Provider name ("openai", "gemini")
            output_modalities: List of modalities the model outputs (e.g., ["text", "audio"])
            sid: Socket ID
            data: Request data
            profile_id: Profile ID
            conn: Database connection

        Returns:
            Dict with results for each modality
        """
        # Check if this is a multi-modality scenario
        if len(output_modalities) <= 1:
            # Single modality - shouldn't use coordinator
            raise ValueError(
                "MultiModalityCoordinator should only be used for multiple output modalities"
            )

        # Route to provider-specific multi-modality handler
        if provider == "openai":
            return await self._handle_openai_multimodal(
                output_modalities, sid, data, profile_id, conn
            )
        elif provider == "gemini":
            return await self._handle_gemini_multimodal(
                output_modalities, sid, data, profile_id, conn
            )
        else:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Multi-modality not yet supported for provider {provider}",
                    resource_id=data.get("resource_id"),
                    group_id=data.get("group_id"),
                    resource_type=data.get("resource_type"),
                ),
                sid=sid,
            )
            return {}

    async def _handle_openai_multimodal(
        self,
        output_modalities: list[str],
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID,
        conn: Any,
    ) -> dict[str, Any]:
        """Handle OpenAI multi-modality generation (e.g., Realtime API for text+audio)."""
        # Check if this is text+audio (Realtime API scenario)
        if "text" in output_modalities and "audio" in output_modalities:
            # Use OpenAI Realtime API which produces both text and audio
            # This is handled by the audio adapter's initialize_session for WebRTC
            # The actual generation happens via WebRTC events, not here
            # So we just return that this is handled
            return {
                "type": "webrtc",
                "modalities": output_modalities,
                "message": "Multi-modality handled via WebRTC session",
            }

        # Other multi-modality combinations not yet supported
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"OpenAI multi-modality combination {output_modalities} not yet supported",
                resource_id=data.get("resource_id"),
                group_id=data.get("group_id"),
                resource_type=data.get("resource_type"),
            ),
            sid=sid,
        )
        return {}

    async def _handle_gemini_multimodal(
        self,
        output_modalities: list[str],
        sid: str,
        data: dict[str, Any],
        profile_id: uuid.UUID,
        conn: Any,
    ) -> dict[str, Any]:
        """Handle Gemini multi-modality generation."""
        # Gemini multi-modality support to be implemented
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Gemini multi-modality combination {output_modalities} not yet supported",
                resource_id=data.get("resource_id"),
                group_id=data.get("group_id"),
                resource_type=data.get("resource_type"),
            ),
            sid=sid,
        )
        return {}
