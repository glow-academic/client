"""Invalidate all cache entries for given tags."""

import asyncio
from collections.abc import Iterable

from app.main import get_redis_client
from app.utils.cache.tag_set_name import tag_set_name
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


async def invalidate_tags(tags: Iterable[str]) -> None:
    """Invalidate all cache entries for given tags."""
    redis_client = get_redis_client()
    if not redis_client:
        return

    try:
        # Convert tags to list to allow multiple iterations
        tags_list = list(tags)
        if not tags_list:
            return

        # Fetch all tag keys in parallel
        set_names = [tag_set_name(tag) for tag in tags_list]
        keys_results = await asyncio.gather(
            *[redis_client.smembers(set_name) for set_name in set_names],  # type: ignore[misc]
            return_exceptions=True,
        )

        # Build pipeline with all delete operations
        pipe = redis_client.pipeline()
        for tag, set_name, keys_result in zip(tags_list, set_names, keys_results):
            # Handle exceptions from smembers
            if isinstance(keys_result, Exception):
                logger.warning(f"Error fetching keys for tag {tag}: {keys_result}")
                # Still delete the tag set even if fetching keys failed
                pipe.delete(set_name)
                continue

            # keys_result is now guaranteed to be a set (not an Exception)
            keys: set[bytes | str] = keys_result  # type: ignore[assignment]
            if keys:
                # Delete all cached responses
                key_list = [
                    k.decode("utf-8") if isinstance(k, bytes) else k for k in keys
                ]
                pipe.delete(*key_list)
            # Delete tag set
            pipe.delete(set_name)

        # Execute all delete operations in a single batch
        await pipe.execute()
        logger.info(f"Invalidated cache for tags: {tags_list}")
    except Exception as e:
        logger.error(f"Error invalidating cache: {e}")
