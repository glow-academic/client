"""Base service class with caching decorator support."""

from functools import wraps
from typing import Any, Awaitable, Callable, TypeVar

import asyncpg  # type: ignore
from app.cache.keys import Key
from app.db import get_pool
from app.extensions import get_query_client

T = TypeVar('T')


def with_cache(
    cache_key_func: Callable[..., Key],
    fresh_ttl: int = 30,
    stale_ttl: int = 300,
) -> Callable[[Callable[..., Awaitable[T]]], Callable[..., Awaitable[T]]]:
    """
    Decorator to add caching to service methods.
    
    This eliminates the repetitive cache-check-and-fetch pattern that appears
    in every cached method across services.
    
    The decorator handles:
    - Cache availability check
    - Direct execution if no cache
    - Pool-aware fetcher creation for background refresh
    - Proper connection management for asyncpg
    
    Args:
        cache_key_func: Function that takes (self, *args, **kwargs) and returns a Key
        fresh_ttl: Seconds to consider data fresh
        stale_ttl: Seconds to serve stale data (with background refresh)
        
    Usage:
        @with_cache(lambda self, filters: keys.cohort_list(filters))
        async def get_cohorts_list(self, filters: CohortsFilters):
            # Method implementation - executes directly if no cache,
            # or used as fetcher for background refresh if cached
            ...
    """
    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        @wraps(func)
        async def wrapper(self: 'BaseService', *args: Any, **kwargs: Any) -> Any:
            qc = get_query_client()
            
            # No cache available - execute directly with request connection
            if not qc:
                return await func(self, *args, **kwargs)
            
            # Get cache key
            key = cache_key_func(self, *args, **kwargs)
            
            # Create pool-aware fetcher for background refresh
            # This is critical: asyncpg connections can only handle one operation at a time,
            # so background refresh must acquire its own connection from the pool
            async def fetcher() -> T:
                pool = get_pool()
                if not pool:
                    # Fallback to direct execution if pool unavailable
                    return await func(self, *args, **kwargs)
                
                # Acquire new connection from pool for background refresh
                async with pool.acquire() as conn:
                    # Create temporary service instance with new connection
                    temp_service = self.__class__(conn)
                    
                    # Copy query object attributes (but NOT nested service instances)
                    # This transfers query builders like self.queries, self.staff_queries, etc.
                    for attr_name, attr_value in self.__dict__.items():
                        if attr_name == 'conn':
                            # Skip connection - already set in temp_service.__init__
                            continue
                        if attr_name.endswith('_queries') or attr_name == 'queries':
                            # Copy query builder instances
                            setattr(temp_service, attr_name, attr_value)
                        # Skip everything else (especially service instances - anti-pattern)
                    
                    # Execute method with temp service instance
                    return await func(temp_service, *args, **kwargs)
            
            # Query cache with fetcher
            return await qc.query(
                key, 
                fetcher, 
                tags=list(key.tags()), 
                fresh_ttl=fresh_ttl, 
                stale_ttl=stale_ttl
            )
        
        return wrapper
    return decorator


class BaseService:
    """
    Base service class with database connection.
    
    All services should inherit from this class to ensure consistent
    connection handling and access to caching decorators.
    
    Attributes:
        conn: asyncpg database connection for this service instance
    """
    
    def __init__(self, conn: asyncpg.Connection):
        """
        Initialize service with database connection.
        
        Args:
            conn: asyncpg connection from the request or pool
        """
        self.conn = conn
    
    async def _invalidate_cache(self, tags: list[str]) -> None:
        """
        Invalidate cache tags if cache is available.
        
        This is a convenience wrapper to eliminate repetitive cache availability checks.
        Safe to call even if cache is disabled - will silently skip invalidation.
        
        Args:
            tags: List of cache tag strings to invalidate
            
        Example:
            await self._invalidate_cache([
                keys.tag_cohort_all(),
                keys.tag_profile_all(),
            ])
        """
        qc = get_query_client()
        if qc:
            await qc.invalidate(tags=tags)

