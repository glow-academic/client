"""Query client with three-tier caching and stale-while-revalidate."""

import asyncio
import contextlib
import hashlib
import json
import logging
import pickle
import time
from collections.abc import Awaitable, Callable, Iterable
from typing import Any

from cachetools import TTLCache  # type: ignore

try:
    import redis.asyncio as redis
except ImportError:
    redis = None  # type: ignore

from app.cache.keys import Key

logger = logging.getLogger(__name__)

Fetcher = Callable[[], Awaitable[Any]]


def hash_key(key: Key) -> str:
    """Generate stable hash for a Key object."""
    material = key.material()
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


class QueryClient:
    """
    Three-tier query cache client with stale-while-revalidate.

    Cache hierarchy:
    1. Local LRU (sub-millisecond, process-scoped)
    2. Redis (milliseconds, shared across instances)
    3. Fresh DB fetch (10-100ms)

    Features:
    - Fresh TTL: serve cached data within this window
    - Stale TTL: serve cached data + background refresh
    - Tag-based invalidation with Redis Pub/Sub
    """

    def __init__(
        self,
        redis_client: Any,
        *,
        local_maxsize: int = 2048,
        channel: str = "qc:invalidate",
        max_concurrent_refreshes: int = 20,  # Match increased pool capacity
    ):
        """
        Initialize query client.

        Args:
            redis_client: Redis async client instance
            local_maxsize: Maximum entries in local LRU cache
            channel: Redis Pub/Sub channel for invalidation broadcasts
            max_concurrent_refreshes: Maximum number of concurrent background refresh tasks
        """
        self.redis = redis_client
        # Local cache with no TTL - we manage expiry manually
        self.local: TTLCache[str, Any] = TTLCache(maxsize=local_maxsize, ttl=86400)
        self.channel = channel
        self._stop = asyncio.Event()
        self._listener_task: asyncio.Task[Any] | None = None
        self._refresh_tasks: set[asyncio.Task[Any]] = set()
        # Semaphore to limit concurrent refresh operations
        self._refresh_semaphore = asyncio.Semaphore(max_concurrent_refreshes)

    async def start(self) -> None:
        """Start the Pub/Sub listener for cache invalidation."""
        if not self.redis:
            logger.warning("Redis not available, skipping Pub/Sub listener")
            return

        async def _listen() -> None:
            """Listen for invalidation messages and clear local cache."""
            try:
                pubsub = self.redis.pubsub()
                await pubsub.subscribe(self.channel)
                logger.info(f"Query cache listening on Redis channel: {self.channel}")

                async for msg in pubsub.listen():
                    if self._stop.is_set():
                        break
                    if msg.get("type") != "message":
                        continue

                    try:
                        payload = json.loads(msg["data"])
                        hash_keys = payload.get("hash_keys", [])
                        for hkey in hash_keys:
                            self.local.pop(hkey, None)
                        logger.debug(
                            f"Invalidated {len(hash_keys)} local cache entries"
                        )
                    except Exception as e:
                        logger.error(f"Error processing invalidation message: {e}")
            except asyncio.CancelledError:
                logger.info("Query cache listener cancelled")
            except Exception as e:
                logger.error(f"Query cache listener error: {e}")
            finally:
                with contextlib.suppress(Exception):
                    await pubsub.close()

        self._listener_task = asyncio.create_task(_listen())

    async def stop(self) -> None:
        """Stop the Pub/Sub listener and cleanup."""
        self._stop.set()

        # Cancel listener task
        if self._listener_task:
            self._listener_task.cancel()
            with contextlib.suppress(Exception):
                await self._listener_task

        # Cancel all pending refresh tasks
        for task in self._refresh_tasks:
            task.cancel()

        if self._refresh_tasks:
            await asyncio.gather(*self._refresh_tasks, return_exceptions=True)

        self._refresh_tasks.clear()
        logger.info("Query cache stopped")

    async def query(
        self,
        key: Key,
        fetcher: Fetcher,
        *,
        tags: Iterable[str],
        fresh_ttl: int = 30,
        stale_ttl: int = 300,
    ) -> Any:
        """
        Execute query with three-tier caching.

        Flow:
        1. Check local cache - if fresh, return
        2. If stale locally, return stale + refresh in background
        3. Check Redis - if fresh, return (update local)
        4. If stale in Redis, return stale + refresh in background
        5. If not cached, fetch fresh and store

        Args:
            key: Cache key object
            fetcher: Async function to fetch fresh data
            tags: List of tags for invalidation
            fresh_ttl: Seconds to consider data fresh
            stale_ttl: Seconds to serve stale data (with background refresh)

        Returns:
            Cached or fresh data
        """
        if not self.redis:
            # No Redis, just fetch fresh
            return await fetcher()

        now = time.time()
        hkey = hash_key(key)
        tag_list = list(tags)

        # 1. Try local cache
        item = self.local.get(hkey)
        if item:
            data, ts, fttl, sttl = item
            age = now - ts
            if age <= fttl:
                # Fresh data
                return data
            if age <= sttl:
                # Stale but acceptable - return and refresh in background
                self._schedule_refresh(
                    hkey, key, fetcher, tag_list, fresh_ttl, stale_ttl
                )
                return data
            # Expired locally, fall through to Redis

        # 2. Try Redis
        rkey = f"qc:data:{hkey}"
        try:
            raw = await self.redis.get(rkey)
            if raw:
                data, ts, fttl, sttl = pickle.loads(raw)
                age = now - ts

                # Update local cache
                self.local[hkey] = (data, ts, fttl, sttl)

                if age <= fttl:
                    # Fresh data
                    return data
                if age <= sttl:
                    # Stale but acceptable - return and refresh in background
                    self._schedule_refresh(
                        hkey, key, fetcher, tag_list, fresh_ttl, stale_ttl
                    )
                    return data
                # Expired in Redis too, fall through to fresh fetch
        except Exception as e:
            logger.error(f"Error reading from Redis cache: {e}")

        # 3. Fetch fresh data
        data = await fetcher()
        await self._write(hkey, data, tag_list, fresh_ttl, stale_ttl)
        return data

    def _schedule_refresh(
        self,
        hkey: str,
        key: Key,
        fetcher: Fetcher,
        tags: list[str],
        fresh_ttl: int,
        stale_ttl: int,
    ) -> None:
        """Schedule a background refresh task."""
        task = asyncio.create_task(
            self._refresh(hkey, key, fetcher, tags, fresh_ttl, stale_ttl)
        )
        self._refresh_tasks.add(task)
        task.add_done_callback(self._refresh_tasks.discard)

    async def _refresh(
        self,
        hkey: str,
        key: Key,
        fetcher: Fetcher,
        tags: list[str],
        fresh_ttl: int,
        stale_ttl: int,
    ) -> None:
        """Background refresh of stale data with concurrency limiting."""
        try:
            # Use semaphore to limit concurrent refresh operations
            async with self._refresh_semaphore:
                data = await fetcher()
                await self._write(hkey, data, tags, fresh_ttl, stale_ttl)
                logger.debug(
                    f"Background refresh completed for key: {key.material()[:50]}"
                )
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(
                f"Background refresh failed for key {key.material()[:50]}: {e}"
            )

    async def _write(
        self, hkey: str, data: Any, tags: list[str], fresh_ttl: int, stale_ttl: int
    ) -> None:
        """Write data to both local and Redis caches."""
        if not self.redis:
            return

        now = time.time()
        blob = pickle.dumps((data, now, fresh_ttl, stale_ttl))
        rkey = f"qc:data:{hkey}"

        try:
            # Store in Redis with stale_ttl expiration
            await self.redis.set(rkey, blob, ex=stale_ttl)

            # Maintain reverse index: tag -> set of hash keys
            pipe = self.redis.pipeline()
            for tag in tags:
                pipe.sadd(f"qc:tag:{tag}", hkey)
                pipe.expire(f"qc:tag:{tag}", stale_ttl)
            await pipe.execute()

            # Update local cache
            self.local[hkey] = (data, now, fresh_ttl, stale_ttl)
        except Exception as e:
            logger.error(f"Error writing to cache: {e}")

    async def invalidate(
        self, *, tags: Iterable[str] = (), keys: Iterable[Key] = ()
    ) -> None:
        """
        Invalidate cache entries by tags or keys.

        This removes entries from Redis and broadcasts invalidation
        via Pub/Sub so other instances drop their local cache.

        Args:
            tags: Tags to invalidate (e.g., ["profile:123", "profile:*"])
            keys: Specific Key objects to invalidate
        """
        if not self.redis:
            return

        hash_keys: set[str] = set()

        # Resolve hash keys from tags
        try:
            for tag in tags:
                members = await self.redis.smembers(f"qc:tag:{tag}")
                for member in members:
                    if isinstance(member, bytes):
                        hash_keys.add(member.decode("utf-8"))
                    else:
                        hash_keys.add(member)
        except Exception as e:
            logger.error(f"Error resolving tags: {e}")

        # Resolve hash keys from explicit keys
        for key in keys:
            hash_keys.add(hash_key(key))

        if not hash_keys:
            return

        try:
            # Delete data blobs from Redis
            pipe = self.redis.pipeline()
            for hk in hash_keys:
                pipe.delete(f"qc:data:{hk}")
            await pipe.execute()

            # Broadcast invalidation to other instances
            await self.redis.publish(
                self.channel, json.dumps({"hash_keys": list(hash_keys)})
            )

            # Drop from local cache
            for hk in hash_keys:
                self.local.pop(hk, None)

            logger.info(f"Invalidated {len(hash_keys)} cache entries")
        except Exception as e:
            logger.error(f"Error invalidating cache: {e}")
