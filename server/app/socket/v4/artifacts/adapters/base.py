"""Base adapter interface for artifact generation."""

from abc import ABC, abstractmethod
from typing import Any


class ArtifactAdapter(ABC):
    """Base interface for artifact generation adapters.
    
    All adapters must implement the generate method which handles
    provider-specific artifact generation logic.
    """

    @abstractmethod
    async def generate(
        self,
        context: dict[str, Any],
        **kwargs: Any,
    ) -> Any:
        """Generate artifact using provider-specific logic.
        
        Args:
            context: Context dictionary containing agent config, run info, etc.
            **kwargs: Additional provider-specific parameters
            
        Returns:
            Result of artifact generation (type depends on adapter implementation)
        """
        pass

