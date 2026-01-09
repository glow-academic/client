"""Base output adapter interface for generating outputs from provider APIs."""

from abc import ABC, abstractmethod
from typing import Any

from app.socket.v4.artifacts.adapters.base.config import (
    AdapterConfig, AdapterEventCallbacks)


class BaseOutputAdapter(ABC):
    """Base interface for output generation adapters - database-free."""

    @abstractmethod
    async def generate_output(
        self,
        sid: str,
        config: AdapterConfig,
        callbacks: AdapterEventCallbacks,
    ) -> Any:
        """Generate output using provider API.

        Returns unified result type for the modality.

        Args:
            sid: Socket ID
            config: AdapterConfig with all necessary data (no database access)
            callbacks: Event callbacks for progress, completion, and error events

        Returns:
            ModalityGenerationResult (ImageGenerationResult, VideoGenerationResult, etc.)
        """
        pass
