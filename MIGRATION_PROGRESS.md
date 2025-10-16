# AsyncPG Raw SQL Migration Progress

## Completed ✅

### Phase 1: Infrastructure Setup (COMPLETE)
- ✅ Updated `requirements.txt` - Removed SQLModel/psycopg2, added asyncpg 0.30.0
- ✅ Created new async `db.py` with asyncpg connection pool
- ✅ Updated `main.py` lifespan to init/close asyncpg pool
- ✅ Removed SQLModel imports from `main.py`
- ✅ Updated error handling in `main.py` to use raw SQL
- ✅ Added pgbouncer to `docker-compose.yml`
- ✅ Configured server and client to connect via pgbouncer
- ✅ Set up pgbouncer with transaction pooling

### Phase 2: Query Layer Updates (IN PROGRESS - 23% Complete)
- ✅ Converted `queries/profile_queries.py` to asyncpg positional params ($1, $2, etc.)
- ✅ Converted `queries/log_queries.py` to asyncpg positional params
- ✅ Converted `queries/feedback_queries.py` to asyncpg positional params
- ✅ Converted `queries/agent_queries.py` to asyncpg positional params
- ✅ Converted `queries/assistant_queries.py` to asyncpg positional params (also made it fully async)
- ✅ Converted `queries/provider_queries.py` to asyncpg positional params
- ⏳ Remaining ~24 query files to convert

### Phase 3: Service Layer (IN PROGRESS)
- ✅ Converted `services/profile_service.py` to async with asyncpg.Connection
- ⏳ Remaining ~17 services to convert

### Phase 4: Repository Layer (IN PROGRESS)
- ✅ Converted `repositories/profile_repository.py` to async
- ⏳ Remaining ~17 repositories to convert

### Phase 5: API Endpoints (IN PROGRESS)
- ⏳ Started `api/v2/profile.py` conversion (imports updated)
- ⏳ Remaining ~14 API files to convert

## In Progress 🔄

### Current Task
Converting API endpoints to use async/await with asyncpg.Connection dependency

### Files Currently Being Modified
- `api/v2/profile.py` - Partially converted (imports done, endpoints need async/await)

## Remaining Work 📋

### Query Builders to Convert (~29 files)
- `queries/analytics/base.py`
- `queries/analytics/header_queries.py`
- `queries/analytics/primary_queries.py`
- `queries/analytics/secondary_queries.py`
- `queries/analytics/footer_queries.py`
- `queries/analytics/page_queries.py`
- `queries/analytics/bundle_queries.py`
- `queries/analytics/leaderboard_queries.py`
- `queries/analytics/pricing_queries.py`
- `queries/agent_queries.py`
- `queries/cohort_queries.py`
- `queries/department_queries.py`
- `queries/document_queries.py`
- `queries/feedback_queries.py`
- `queries/log_queries.py`
- `queries/parameter_queries.py`
- `queries/persona_queries.py`
- `queries/provider_queries.py`
- `queries/rubric_queries.py`
- `queries/scenario_queries.py`
- `queries/simulation_queries.py`
- `queries/staff_queries.py`
- `queries/assistant_queries.py`

### Services to Convert (~17 files)
- `services/agent_service.py`
- `services/analytics_service.py`
- `services/attempts_service.py`
- `services/cohort_service.py`
- `services/department_service.py`
- `services/document_service.py`
- `services/feedback_service.py`
- `services/log_service.py`
- `services/parameter_service.py`
- `services/persona_service.py`
- `services/provider_service.py`
- `services/rubric_service.py`
- `services/scenario_service.py`
- `services/simulation_service.py`
- `services/staff_service.py`
- `services/analytics_insights.py`
- `services/permissions_service.py`

### WebSocket Handlers (2 files - CRITICAL)
- `web/simulations.py` - Heavy ORM usage, needs complete rewrite
- `web/assistants.py` - Heavy ORM usage, needs complete rewrite

### Agent Services (7 files)
- `services/agents/collection/guardrail.py`
- `services/agents/collection/simulation.py`
- `services/agents/collection/grade.py`
- `services/agents/collection/hint.py`
- `services/agents/collection/scenario.py`
- `services/agents/collection/classify.py`
- `services/agents/collection/title.py`
- `services/agents/collection/assistant.py`
- `services/agents/generic.py`

### MCP Tools (10 files)
- `services/mcp/tools/analytics/cohort_pass_matrix.py`
- `services/mcp/tools/analytics/persona_response_times.py`
- `services/mcp/tools/analytics/simulation_attempts.py`
- `services/mcp/tools/analytics/student_sim_report.py`
- `services/mcp/tools/lookup/cohort_overview.py`
- `services/mcp/tools/lookup/persona_overview.py`
- `services/mcp/tools/lookup/profile_overview.py`
- `services/mcp/tools/lookup/scenario_overview.py`
- `services/mcp/tools/lookup/simulation_overview.py`
- `services/mcp/tools/search/find_*.py` (5 files)
- `services/mcp/tools/log/recent_app_logs.py`
- `services/mcp/tools/log/assistant_usage.py`

### Utils (9 files)
- `utils/scenario.py`
- `utils/limit.py`
- `utils/chat.py`
- `utils/document.py`
- `utils/agents.py`
- `utils/guest.py`
- `utils/debug_info.py`
- `utils/personas.py`
- `utils/csv.py`
- `utils/rubric.py`

### API Endpoints (~14 files)
- `api/v2/profile.py` (in progress)
- `api/v2/simulations.py`
- `api/v2/scenarios.py`
- `api/v2/cohorts.py`
- `api/v2/documents.py`
- `api/v2/parameters.py`
- `api/v2/providers.py`
- `api/v2/rubrics.py`
- `api/v2/personas.py`
- `api/v2/agents.py`
- `api/v2/departments.py`
- `api/v2/feedback.py`
- `api/v2/logs.py`
- `api/v2/attempts.py`
- `api/v2/assistant.py`
- `api/v2/analytics/*` (9 files)

### Repositories (~17 files)
- Similar to services, all need async conversion

### Final Steps
- Transaction optimization (combine related queries)
- Query optimization (replace N+1 with JOINs)
- Delete `models.py` (1091 lines)
- Update tests to use asyncpg mocking
- Run full test suite
- Update AGENTS.md documentation

## Migration Strategy

### Conversion Pattern
For each service/repository/API file:
1. Change imports: `Session` → `asyncpg.Connection`, `get_session` → `get_db`
2. Add `async` to all methods/functions
3. Change `db.execute(text(query), params)` → `await conn.fetchrow/fetch(query, *params)`
4. Replace ORM operations (`db.add()`, `db.commit()`) with raw SQL INSERT/UPDATE
5. Change return type hints as needed

### Query Builder Pattern
For each query file:
1. Change return type: `Tuple[str, Dict[str, Any]]` → `Tuple[str, List[Any]]`
2. Replace named params (`:name`) with positional (`$1`, `$2`)
3. Build param lists instead of dicts
4. Handle dynamic queries (e.g., filters, updates) with param counters

### Transaction Pattern
Use the transaction context manager for multi-query operations:
```python
from app.db import transaction

async with transaction(conn):
    await conn.execute(query1, *params1)
    await conn.execute(query2, *params2)
    # Auto-commits on success, rolls back on exception
```

## Next Steps

1. **Complete Query Conversions** - Convert remaining query builders to positional params
2. **Batch Convert Services** - Convert all service files to async
3. **Critical: WebSocket Handlers** - Rewrite `web/simulations.py` and `web/assistants.py`
4. **Agent Services** - Convert agent collection services
5. **Complete API Endpoints** - Add async/await to all routes
6. **Testing** - Update tests and run full suite
7. **Cleanup** - Remove `models.py` and verify no ORM imports remain

## Estimated Completion

- Infrastructure: ✅ 100% (Done)
- Query Builders: 🟡 3% (1/30)
- Services: 🟡 6% (1/18)
- Repositories: 🟡 6% (1/18)
- API Endpoints: 🟡 0% (0/15)
- WebSocket: 🔴 0% (0/2)
- Agent Services: 🔴 0% (0/9)
- MCP Tools: 🔴 0% (0/10)
- Utils: 🔴 0% (0/9)
- Total Progress: ~8%

**Note**: This is a big-bang migration affecting 60+ files. Infrastructure is complete and the pattern is established. The remaining work is systematic but requires careful attention to maintain functionality.

