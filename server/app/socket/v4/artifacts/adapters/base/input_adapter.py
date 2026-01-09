"""Base input adapter interface for preparing inputs for provider APIs."""

import uuid
from abc import ABC, abstractmethod
from typing import Any


class BaseInputAdapter(ABC):
    """Base interface for input preparation adapters."""

    @abstractmethod
    async def prepare_input(
        self,
        conn: Any,
        resource_type: str,
        resource_id: uuid.UUID,
        agent_config: Any,  # AgentConfig from types
        messages: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        """Prepare input for provider API.

        Handles fallbacks:
        - If model doesn't support document input → convert to text
        - If model doesn't support image/video/audio input → convert to text description

        Args:
            conn: Database connection
            resource_type: Resource type (e.g., "texts", "images", "documents")
            resource_id: Resource ID
            agent_config: Agent configuration
            messages: Existing messages (optional)
            **kwargs: Additional parameters

        Returns:
            Prepared input dict for provider API
        """
        pass
