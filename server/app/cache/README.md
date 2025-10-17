# Query Cache System

A three-tier caching system with Redis and local LRU cache, featuring stale-while-revalidate and tag-based invalidation for FastAPI services.

## Architecture

### Cache Hierarchy

1. **Local LRU Cache** (sub-millisecond, process-scoped)
   - Fast in-memory cache using `cachetools.TTLCache`
   - First line of defense for hot data
   - Automatically invalidated via Redis Pub/Sub

2. **Redis Cache** (milliseconds, shared across instances)
   - Shared cache for multi-instance deployments
   - Source of truth for cached data
   - Supports tag-based invalidation

3. **Fresh Database Fetch** (10-100ms, fallback)
   - Direct query to PostgreSQL
   - Only executed on cache miss or expiry

### Cache Flow

```
Request
   ↓
Local Cache (fresh < 30s?) → YES → Return
   ↓ NO
Local Cache (stale < 300s?) → YES → Return + Background Refresh
   ↓ NO
Redis Cache (fresh < 30s?) → YES → Return + Update Local
   ↓ NO
Redis Cache (stale < 300s?) → YES → Return + Update Local + Background Refresh
   ↓ NO
Fresh DB Fetch → Store in Redis & Local → Return
```

### TTL Configuration

- **Fresh TTL**: 30 seconds (serve directly, no refresh)
- **Stale TTL**: 300 seconds (serve + refresh in background)
- Adjustable per query if needed

## Usage

### Adding Cache to Read Operations

**Pattern**:
```python
from app.cache import keys
from app.extensions import get_query_client

async def get_something(self, filters: SomeFilters) -> SomeResponse:
    """Get something with caching."""
    qc = get_query_client()
    if not qc:
        # No cache available, execute directly
        query, params = self.queries.something(...)
        return await self._execute_query(query, params)
    
    # Create cache key
    key = keys.something_key(filters)
    
    # Define fetcher function
    async def fetcher() -> SomeResponse:
        query, params = self.queries.something(...)
        return await self._execute_query(query, params)
    
    # Query with cache
    return await qc.query(
        key,
        fetcher,
        tags=list(key.tags()),
        fresh_ttl=30,
        stale_ttl=300
    )
```

**Key Points**:
- Always check if `qc` is available (graceful degradation)
- Use key factories from `keys.py`
- Tags are automatically generated from the key
- Fetcher function contains the original query logic

### Adding Invalidation to Mutations

**Pattern**:
```python
from app.cache import keys
from app.extensions import get_query_client

async def update_something(self, id: str, updates: Dict) -> Something:
    """Update something and invalidate caches."""
    # Perform the update
    query, params = self.queries.update(id, updates)
    result = await self.conn.execute(query, *params)
    
    # Invalidate affected caches
    qc = get_query_client()
    if qc:
        await qc.invalidate(tags=[
            keys.tag_something_by_id(id),  # Fine-grained
            keys.tag_something_all(),      # Coarse-grained
            keys.tag_analytics_all(),      # Related caches
        ])
    
    return result
```

**Key Points**:
- Invalidate immediately after successful mutation
- Use tag helpers for consistency
- Include related namespaces (e.g., mutations affecting analytics)
- Fine-grained tags first, then coarse

## Key System

### Creating Key Factories

Add new key factories to `keys.py`:

```python
# In keys.py

def my_service_by_id(entity_id: str, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for entity by ID query."""
    return Key(
        ns="my_service",
        name="by_id",
        params={"entity_id": entity_id},
        v=v
    )

def my_service_list(filters: Any, *, v: int = GLOBAL_CACHE_VERSION) -> Key:
    """Key for entity list query."""
    return Key(
        ns="my_service",
        name="list",
        params={"filters": _serialize_filters(filters)},
        v=v
    )
```

### Tag Patterns

Tags follow a hierarchy for granular vs. broad invalidation:

1. **Coarse** (`{namespace}:*`): Invalidate entire namespace
2. **Medium** (`{namespace}:{category}:{name}`): Invalidate query type
3. **Fine** (`{namespace}:{entity_id}`): Invalidate specific entity

**Example**:
```python
# Coarse: Invalidate all analytics
keys.tag_analytics_all()  # → "analytics:*"

# Fine: Invalidate specific profile
keys.tag_profile_by_id("123")  # → "profile:123"
```

### Tag Helpers

Create tag helpers for common invalidation patterns:

```python
# In keys.py

def tag_my_service_all() -> str:
    """Invalidate all my_service caches."""
    return f"{NS_MY_SERVICE}:*"

def tag_my_service_by_id(entity_id: str) -> str:
    """Invalidate specific entity caches."""
    return f"{NS_MY_SERVICE}:{entity_id}"
```

## Reference Implementations

### Analytics Service (Read-Only)

File: `server/app/services/analytics_service.py`

**Cached Methods** (23 total):
- Header metrics (10): `get_average_score`, `get_completion_percentage`, etc.
- Primary metrics (3): `get_rubric_heatmap`, `get_growth_data`, `get_persona_performance`
- Other metrics: Secondary, footer, page, bundle queries

**Pattern**: All read methods use caching, no mutations to invalidate.

### Profile Service (Read + Write)

File: `server/app/services/profile_service.py`

**Cached Methods**:
- `get_profile(profile_id)` → Uses `keys.profile_by_id()`

**Invalidating Methods**:
- `update_profile()` → Invalidates `profile:{id}`, `profile:*`, `analytics:*`
- Any profile mutation affects analytics (profile changes impact metrics)

### Attempts Service (Write-Only)

File: `server/app/services/attempts_service.py`

**Invalidating Methods**:
- `bulk_archive_attempts()` → Invalidates `analytics:*`
- `update_chat_created_at()` → Invalidates `analytics:*`
- `update_chat_completed_at()` → Invalidates `analytics:*`

**Pattern**: All mutations invalidate analytics (attempts are the source data for metrics).

## Invalidation Mapping

### When to Invalidate What

| Mutation In          | Invalidate Tags                                      |
|----------------------|------------------------------------------------------|
| Profile updates      | `profile:{id}`, `profile:*`, `analytics:*`           |
| Attempt changes      | `analytics:*`                                        |
| Simulation updates   | `simulation:{id}`, `simulation:*`, `analytics:*`     |
| Scenario changes     | `scenario:{id}`, `scenario:*`, `analytics:*`         |
| Cohort updates       | `cohort:{id}`, `cohort:*`, `analytics:*`, `profile:*`|

**Rule of Thumb**: If the mutation affects data used in analytics queries, invalidate `analytics:*`.

## Adding Cache to New Services

### Step-by-Step Checklist

1. **Add imports**:
   ```python
   from app.cache import keys
   from app.extensions import get_query_client
   ```

2. **Create key factories** in `keys.py`:
   - One key factory per query type
   - Use descriptive names: `{namespace}_{query_name}`
   - Include version parameter

3. **Add tag helpers** in `keys.py`:
   - `tag_{namespace}_all()`
   - `tag_{namespace}_by_id(id)` if applicable

4. **Update `_extract_primary_id()`** in `keys.py`:
   - Add logic to extract entity IDs for fine-grained tags

5. **Wrap read methods** with caching:
   - Check `qc = get_query_client()`
   - Fallback to direct query if no cache
   - Create key and fetcher
   - Call `qc.query()`

6. **Add invalidation to mutations**:
   - After successful DB operation
   - Use tag helpers
   - Include related namespaces

## Performance Tuning

### Adjusting TTLs

Default TTLs work for most cases, but adjust if needed:

```python
# More aggressive caching (less fresh, more stale tolerance)
return await qc.query(key, fetcher, tags=list(key.tags()), 
                      fresh_ttl=60, stale_ttl=600)

# More aggressive freshness (stricter refresh)
return await qc.query(key, fetcher, tags=list(key.tags()),
                      fresh_ttl=10, stale_ttl=60)
```

**Guidelines**:
- High-traffic, rarely-changing data: Increase both TTLs
- Rapidly-changing data: Decrease fresh TTL, keep stale TTL moderate
- Critical freshness: Decrease both TTLs

### Cache Key Versions

Bump the global version to invalidate **all** caches after schema changes:

```python
# In keys.py
GLOBAL_CACHE_VERSION = 2  # Increment to bust all caches
```

Or use per-query versions for surgical cache busts:

```python
key = keys.analytics_average_score(filters, v=2)  # Override version
```

## Monitoring

### Logging

Query cache logs important events:

- **INFO**: Cache initialization, Pub/Sub listener status
- **DEBUG**: Cache hits, misses, background refreshes
- **ERROR**: Redis connection issues, invalidation failures

### Metrics to Track

Monitor these in production:

- Cache hit rate (local vs. Redis vs. miss)
- Background refresh frequency
- Invalidation broadcast count
- Redis latency

## Troubleshooting

### Cache Not Working

1. Check Redis connection:
   ```bash
   redis-cli ping  # Should return PONG
   ```

2. Verify QueryClient initialization:
   - Check logs for "Query cache client initialized"
   - Ensure `init_query_client()` called in `main.py` lifespan

3. Confirm key factories exist for your queries

### Stale Data After Mutation

1. Verify invalidation is called after mutation
2. Check correct tags are used
3. Ensure Pub/Sub listener is running
4. Test in single-instance first (local cache only)

### Redis Connection Issues

The system gracefully degrades:
- If Redis is unavailable, queries execute directly
- No crashes, just no caching
- Check `REDIS_URL` environment variable

## Next Steps

To extend the cache system to additional services:

1. **Simulation Service**: Cache `get_simulation_by_id`, invalidate on updates
2. **Scenario Service**: Cache scenario queries, invalidate on mutations
3. **Document Service**: Cache document metadata queries

Follow the patterns demonstrated in analytics and profile services.

