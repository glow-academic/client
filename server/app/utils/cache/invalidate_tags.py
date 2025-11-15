"""Invalidate all cache entries for given tags."""

import logging
from typing import Iterable

from app.main import redis_client
from app.utils.cache.tag_set_name import tag_set_name

logger = logging.getLogger(__name__)


async def invalidate_tags(tags: Iterable[str]) -> None:
    """Invalidate all cache entries for given tags."""
    if not redis_client:
        return

    try:
        pipe = redis_client.pipeline()
        for tag in tags:
            set_name = tag_set_name(tag)
            # Get all keys for this tag
            keys = await redis_client.smembers(set_name)
            if keys:
                # Delete all cached responses
                key_list = [
                    k.decode("utf-8") if isinstance(k, bytes) else k for k in keys
                ]
                pipe.delete(*key_list)
            # Delete tag set
            pipe.delete(set_name)
        await pipe.execute()
        logger.info(f"Invalidated cache for tags: {list(tags)}")
    except Exception as e:
        logger.error(f"Error invalidating cache: {e}")

