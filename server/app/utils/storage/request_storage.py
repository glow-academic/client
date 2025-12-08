"""Request-scoped storage abstraction with Redis backend and in-memory fallback."""

import asyncio
import json
import uuid
from abc import ABC, abstractmethod
from typing import Any

from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


def build_storage_key(
    operation_type: str,
    profile_id: str | None,
    primary_id: str | None,
) -> str:
    """Build a composite storage key from operation type, profile_id, and primary_id.
    
    Args:
        operation_type: Type of operation (e.g., "scenario_generation", "image_generation")
        profile_id: Profile ID (required for tenant isolation)
        primary_id: Primary identifier (scenario_id, trace_id, chat_id, etc.)
        
    Returns:
        Composite key in format: {operation_type}:{profile_id}:{primary_id}
        
    Raises:
        ValueError: If profile_id is None (required for tenant isolation)
    """
    if not profile_id:
        raise ValueError("profile_id is required for storage key (tenant isolation)")
    
    if not primary_id:
        # Generate a UUID if no primary_id provided (should be rare)
        primary_id = str(uuid.uuid4())
        logger.warning(
            f"No primary_id provided for {operation_type}, generated UUID: {primary_id}"
        )
    
    return f"{operation_type}:{profile_id}:{primary_id}"


class RequestStorage(ABC):
    """Abstract base class for request-scoped storage."""
    
    @abstractmethod
    async def get(self, key: str, field: str | None = None) -> Any:
        """Get a value from storage.
        
        Args:
            key: Storage key (composite key from build_storage_key)
            field: Optional field name to get from stored dict
            
        Returns:
            Value if found, None otherwise
        """
        pass
    
    @abstractmethod
    async def get_all(self, key: str) -> dict[str, Any]:
        """Get all values for a key as a dictionary.
        
        Args:
            key: Storage key
            
        Returns:
            Dictionary of all stored values, empty dict if not found
        """
        pass
    
    @abstractmethod
    async def set(self, key: str, field: str, value: Any) -> None:
        """Set a field value in storage.
        
        Args:
            key: Storage key
            field: Field name to set
            value: Value to store
        """
        pass
    
    @abstractmethod
    async def set_all(self, key: str, data: dict[str, Any]) -> None:
        """Set all values for a key at once.
        
        Args:
            key: Storage key
            data: Dictionary of values to store
        """
        pass
    
    @abstractmethod
    async def delete(self, key: str, field: str | None = None) -> None:
        """Delete a key or field from storage.
        
        Args:
            key: Storage key
            field: Optional field name to delete (if None, deletes entire key)
        """
        pass
    
    @abstractmethod
    async def clear(self, key: str) -> None:
        """Clear all data for a key (equivalent to delete entire key).
        
        Args:
            key: Storage key
        """
        pass


class RedisRequestStorage(RequestStorage):
    """Redis-backed request storage with JSON serialization."""
    
    def __init__(self, redis_client: Any, ttl_seconds: int = 3600):
        """Initialize Redis storage.
        
        Args:
            redis_client: Redis async client instance
            ttl_seconds: Time-to-live in seconds (default 1 hour)
        """
        self.redis = redis_client
        self.ttl = ttl_seconds
    
    async def get(self, key: str, field: str | None = None) -> Any:
        """Get a value from Redis storage."""
        try:
            data_str = await self.redis.get(key)
            if not data_str:
                return None
            
            data = json.loads(data_str)
            if field:
                return data.get(field)
            return data
        except Exception as e:
            logger.error(f"Redis get error for key {key}: {e}", exc_info=True)
            return None
    
    async def get_all(self, key: str) -> dict[str, Any]:
        """Get all values for a key from Redis."""
        try:
            data_str = await self.redis.get(key)
            if not data_str:
                return {}
            return json.loads(data_str)
        except Exception as e:
            logger.error(f"Redis get_all error for key {key}: {e}", exc_info=True)
            return {}
    
    async def set(self, key: str, field: str, value: Any) -> None:
        """Set a field value in Redis storage."""
        try:
            # Get existing data
            data_str = await self.redis.get(key)
            if data_str:
                data = json.loads(data_str)
            else:
                data = {}
            
            # Update field
            data[field] = value
            
            # Store back with TTL
            await self.redis.setex(key, self.ttl, json.dumps(data))
        except Exception as e:
            logger.error(f"Redis set error for key {key}, field {field}: {e}", exc_info=True)
    
    async def set_all(self, key: str, data: dict[str, Any]) -> None:
        """Set all values for a key in Redis."""
        try:
            await self.redis.setex(key, self.ttl, json.dumps(data))
        except Exception as e:
            logger.error(f"Redis set_all error for key {key}: {e}", exc_info=True)
    
    async def delete(self, key: str, field: str | None = None) -> None:
        """Delete a key or field from Redis."""
        try:
            if field:
                # Delete specific field
                data_str = await self.redis.get(key)
                if data_str:
                    data = json.loads(data_str)
                    if field in data:
                        del data[field]
                        await self.redis.setex(key, self.ttl, json.dumps(data))
            else:
                # Delete entire key
                await self.redis.delete(key)
        except Exception as e:
            logger.error(f"Redis delete error for key {key}, field {field}: {e}", exc_info=True)
    
    async def clear(self, key: str) -> None:
        """Clear all data for a key in Redis."""
        await self.delete(key)


class MemoryRequestStorage(RequestStorage):
    """In-memory request storage (fallback when Redis unavailable)."""
    
    def __init__(self):
        """Initialize in-memory storage."""
        self._storage: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock()
    
    async def get(self, key: str, field: str | None = None) -> Any:
        """Get a value from in-memory storage."""
        async with self._lock:
            if key not in self._storage:
                return None
            
            data = self._storage[key]
            if field:
                return data.get(field)
            return dict(data)
    
    async def get_all(self, key: str) -> dict[str, Any]:
        """Get all values for a key from in-memory storage."""
        async with self._lock:
            return self._storage.get(key, {}).copy()
    
    async def set(self, key: str, field: str, value: Any) -> None:
        """Set a field value in in-memory storage."""
        async with self._lock:
            if key not in self._storage:
                self._storage[key] = {}
            self._storage[key][field] = value
    
    async def set_all(self, key: str, data: dict[str, Any]) -> None:
        """Set all values for a key in in-memory storage."""
        async with self._lock:
            self._storage[key] = data.copy()
    
    async def delete(self, key: str, field: str | None = None) -> None:
        """Delete a key or field from in-memory storage."""
        async with self._lock:
            if key not in self._storage:
                return
            
            if field:
                if field in self._storage[key]:
                    del self._storage[key][field]
            else:
                del self._storage[key]
    
    async def clear(self, key: str) -> None:
        """Clear all data for a key in in-memory storage."""
        await self.delete(key)


def create_request_storage(redis_client: Any | None, ttl_seconds: int = 3600) -> RequestStorage:  # type: ignore[return]
    """Create a request storage instance (Redis if available, else memory).
    
    Args:
        redis_client: Redis async client instance (None if unavailable)
        ttl_seconds: TTL for Redis keys (ignored for memory storage)
        
    Returns:
        RequestStorage instance (RedisRequestStorage or MemoryRequestStorage)
        
    Note:
        Redis connection is tested on first use, not during initialization.
        This avoids blocking during startup.
    """
    if redis_client:
        return RedisRequestStorage(redis_client, ttl_seconds)
    else:
        logger.info("Using in-memory request storage (Redis not configured)")
        return MemoryRequestStorage()

