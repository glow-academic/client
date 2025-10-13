## Analytics Query Pattern: Developer Guide

This guide shows how to add new analytics queries or migrate existing stored procedures to Python SQL.

## Pattern Overview

All analytics queries follow this pattern:

```
Query Builder → Service → Repository → API
```

Each layer has a specific responsibility:
- **Query Builder**: Construct SQL query string + parameters
- **Service**: Execute query and parse results
- **Repository**: Delegate to service (compatibility layer)
- **API**: Handle HTTP requests (unchanged)

## Adding a New Metric

### Step 1: Create Query Builder Method

Location: `server/app/queries/analytics/<category>_queries.py`

```python
# server/app/queries/analytics/header_queries.py

class HeaderQueries:
    def my_new_metric(
        self,
        start_date: str,
        end_date: str,
        cohort_ids: Optional[List[str]] = None,
        roles: Optional[List[str]] = None,
        sim_filters: Optional[List[str]] = None,
        profile_id: Optional[str] = None,
        department_ids: Optional[List[str]] = None,
    ) -> Tuple[str, dict]:
        """Build my new metric query."""
        
        # Option A: Use the builder for simple metrics
        return self.builder.build_metric_query(
            metric_expression="your_sql_expression",
            aggregate_func="AVG",  # or SUM, MAX, MIN, COUNT
            method="avg",  # for response
            start_date=start_date,
            end_date=end_date,
            cohort_ids=cohort_ids,
            roles=roles,
            sim_filters=sim_filters,
            profile_id=profile_id,
            department_ids=department_ids,
            use_normalization=False,  # True for score-based metrics
        )
        
        # Option B: Write custom SQL for complex metrics
        where_clause, params = self.builder.filters.build_base_filter(
            start_date, end_date, cohort_ids, roles,
            sim_filters, profile_id, department_ids
        )
        
        query = f"""
            WITH filt AS (
                SELECT * FROM analytics a WHERE {where_clause}
            ),
            -- Your custom CTEs here
            aggregated AS (
                SELECT
                    to_char(attempt_created_at, 'YYYY-MM-DD') AS date,
                    AVG(your_metric)::float AS value,
                    COUNT(*)::int AS count
                FROM filt
                GROUP BY date
            )
            SELECT
                (SELECT COUNT(*) > 0 FROM filt) AS has_data,
                'avg' AS method,
                NULL AS value_field,
                NULL AS key_field,
                COALESCE((SELECT json_agg(json_build_object(
                    'date', date,
                    'value', ROUND(value)::int,
                    'count', count
                ) ORDER BY date) FROM aggregated), '[]'::json) AS trend_data,
                '[]'::json AS data_points
        """
        
        return query, params
```

### Step 2: Add Service Method

Location: `server/app/services/analytics_service.py`

```python
class AnalyticsService:
    def get_my_new_metric(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get my new metric."""
        query, params = self.header_queries.my_new_metric(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=filters.simulationFilters,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        return self._execute_metric_query(query, params)
```

### Step 3: Add Repository Method

Location: `server/app/repositories/analytics_repository.py`

```python
class AnalyticsRepository:
    def get_my_new_metric(self, filters: AnalyticsFilters) -> MetricResponse:
        """Get my new metric."""
        return self.service.get_my_new_metric(filters)
```

### Step 4: Add API Endpoint

Location: `server/app/api/v1/analytics/header.py` (or appropriate router)

```python
@router.post("/my-new-metric", response_model=MetricResponse)
async def get_my_new_metric(
    filters: AnalyticsFilters,
    db: Annotated[Session, Depends(get_session)],
) -> MetricResponse:
    """Get my new metric."""
    try:
        repo = get_analytics_repository(db)
        return repo.get_my_new_metric(filters)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

## Migrating a Stored Procedure

### Step 1: Analyze the Stored Procedure

Example stored procedure: `analytics_average_score_fn`

```sql
CREATE OR REPLACE FUNCTION analytics_average_score_fn(
  p_start timestamptz,
  p_end timestamptz,
  -- ... other params
) RETURNS jsonb
LANGUAGE sql AS $$
  WITH base AS (
    SELECT * FROM analytics
    WHERE attempt_created_at >= p_start
      AND attempt_created_at < p_end
  ),
  aggregated AS (
    SELECT AVG(grade_percent) AS avg_score
    FROM base
  )
  SELECT jsonb_build_object('result', avg_score)
  FROM aggregated;
$$;
```

### Step 2: Extract Components

Identify:
1. **Filtering logic** → Use `AnalyticsFilters.build_base_filter()`
2. **CTEs** → Convert to Python string formatting
3. **Aggregations** → Use `MetricQueryBuilder` or write custom
4. **Response structure** → Match expected JSON format

### Step 3: Implement in Python

```python
def average_score(self, start_date, end_date, ...):
    # 1. Build base filter
    where_clause, params = self.builder.filters.build_base_filter(...)
    
    # 2. Construct query (same logic as SQL)
    query = f"""
        WITH base AS (
            SELECT * FROM analytics WHERE {where_clause}
        ),
        aggregated AS (
            SELECT AVG(grade_percent) AS avg_score
            FROM base
        )
        SELECT
            (SELECT COUNT(*) > 0 FROM base) AS has_data,
            'avg' AS method,
            ...
    """
    
    return query, params
```

### Step 4: Test Equivalence

```python
# Compare results
sql_result = db.execute("SELECT analytics_average_score_fn(...)")
python_result = service.get_average_score(filters)

assert sql_result == python_result
```

## Common Patterns

### Pattern 1: Simple Aggregation

For metrics that just aggregate a field:

```python
return self.builder.build_metric_query(
    metric_expression="field_name",
    aggregate_func="AVG",  # or SUM, MAX, MIN
    method="avg",
    # ... filters
)
```

### Pattern 2: Normalized Scores

For score-based metrics that need attempt normalization:

```python
return self.builder.build_metric_query(
    metric_expression="grade_percent",
    aggregate_func="AVG",
    method="avg",
    use_normalization=True,  # Key difference
    # ... filters
)
```

### Pattern 3: Rate Calculations

For percentage/rate metrics:

```python
where_clause, params = self.builder.filters.build_base_filter(...)

query = f"""
    WITH filt AS (
        SELECT * FROM analytics a WHERE {where_clause}
    ),
    with_rate AS (
        SELECT
            (100.0 * COUNT(*) FILTER (WHERE condition) / NULLIF(COUNT(*), 0)) AS rate
        FROM filt
    )
    SELECT ... AS has_data, 'rate' AS method, ...
"""
```

### Pattern 4: Time-Based Calculations

For time/duration metrics:

```python
query = f"""
    WITH filt AS (
        SELECT * FROM analytics a WHERE {where_clause}
    ),
    time_data AS (
        SELECT
            (field_seconds / 60.0) AS minutes  -- Convert to minutes
        FROM filt
    )
    SELECT ... AS has_data, 'avg' AS method, ...
"""
```

### Pattern 5: Window Functions

For metrics needing LAG/LEAD:

```python
query = f"""
    WITH filt AS (
        SELECT * FROM analytics a WHERE {where_clause}
    ),
    with_previous AS (
        SELECT
            *,
            LAG(field) OVER (PARTITION BY group_by ORDER BY date) AS prev
        FROM filt
    )
    SELECT ...
"""
```

## Response Format

All queries must return this structure:

```sql
SELECT
    <boolean> AS has_data,
    '<method>' AS method,
    <string_or_null> AS value_field,
    <string_or_null> AS key_field,
    <json_array> AS trend_data,
    <json_array> AS data_points
```

Where:
- `has_data`: True if any data exists
- `method`: avg, max, sum, rate, countDistinct, min, slope
- `value_field`: Optional field name for values
- `key_field`: Optional field name for grouping
- `trend_data`: Array of `{date, value, count}` objects
- `data_points`: Array of individual data points

## Testing Checklist

When adding/migrating a metric:

- [ ] Query builder returns `(str, dict)` tuple
- [ ] Service method calls query builder correctly
- [ ] Repository delegates to service
- [ ] API endpoint handles errors
- [ ] Response matches schema
- [ ] Filters work correctly (cohorts, roles, dates, etc.)
- [ ] Performance acceptable (check `EXPLAIN ANALYZE`)
- [ ] Results match stored procedure (if migrating)
- [ ] Unit test for query builder
- [ ] Integration test for service
- [ ] API test for endpoint

## Performance Tips

1. **Use CTEs wisely** - Materialized CTEs can improve performance
2. **Filter early** - Apply WHERE clauses in base CTE
3. **Index usage** - Ensure analytics view has proper indexes
4. **Limit data** - Use date ranges to limit dataset
5. **Avoid N+1** - Pre-aggregate in CTEs instead of subqueries
6. **Test with EXPLAIN** - Always check query plans

## Debugging

### Enable SQL logging:

```python
# In service
import logging
logging.basicConfig(level=logging.DEBUG)

# Logs will show generated SQL
```

### Print generated query:

```python
query, params = self.header_queries.my_metric(...)
print(f"Query: {query}")
print(f"Params: {params}")
```

### Test in psql:

```sql
-- Copy generated query and test directly
WITH filt AS (
    SELECT * FROM analytics
    WHERE attempt_created_at >= '2025-01-01'
    ...
)
SELECT * FROM filt LIMIT 10;
```

## File Organization

```
server/app/queries/analytics/
├── base.py                    # Base classes & utilities
├── header_queries.py          # Header metrics (10)
├── primary_queries.py         # Primary analytics (3)
├── secondary_queries.py       # Secondary analytics (3)
├── footer_queries.py          # Footer analytics (4)
├── bundle_queries.py          # Bundles (2)
├── page_queries.py            # Page-specific (3)
└── leaderboard_queries.py     # Leaderboard (3)
```

Create new files as needed for logical grouping.

## Common Pitfalls

1. **SQL Injection** - Always use parameterized queries
   ```python
   # ❌ BAD
   query = f"WHERE date = '{user_date}'"
   
   # ✅ GOOD
   query = "WHERE date = :user_date"
   params = {"user_date": user_date}
   ```

2. **NULL handling** - Use COALESCE for arrays
   ```python
   # ❌ BAD
   conditions.append("a.cohort_ids && :cohort_ids")
   
   # ✅ GOOD
   if cohort_ids:
       params["cohort_ids"] = cohort_ids
       conditions.append("a.cohort_ids && :cohort_ids")
   ```

3. **JSON parsing** - Ensure correct format
   ```sql
   -- ✅ GOOD
   COALESCE((SELECT json_agg(...)), '[]'::json)
   
   -- ❌ BAD (might return NULL)
   (SELECT json_agg(...))
   ```

4. **Float precision** - Round appropriately
   ```sql
   -- ✅ GOOD
   ROUND(AVG(value))::int
   
   -- ❌ BAD (loses precision control)
   AVG(value)::int
   ```

## Quick Reference

### Import Statements

```python
from typing import List, Optional, Tuple
from app.queries.analytics.base import AnalyticsQueryBuilder
```

### Method Signature

```python
def metric_name(
    self,
    start_date: str,
    end_date: str,
    cohort_ids: Optional[List[str]] = None,
    roles: Optional[List[str]] = None,
    sim_filters: Optional[List[str]] = None,
    profile_id: Optional[str] = None,
    department_ids: Optional[List[str]] = None,
) -> Tuple[str, dict]:
```

### Common Builders

```python
# Simple metric
self.builder.build_metric_query(...)

# Base filter only
self.builder.filters.build_base_filter(...)

# Normalization
self.builder.normalization.build_normalized_score_cte(...)

# Trend query
self.builder.metric_builder.build_trend_query(...)
```

---

**Need Help?** Check existing implementations in `header_queries.py` for examples.

