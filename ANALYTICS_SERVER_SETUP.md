# Analytics Server API Setup - Complete ✅

## Overview

This document describes the newly created server-side analytics API structure that mirrors the client-side routes. The server routes are now ready to replace the direct database calls currently made by the client.

## What Was Created

### 1. **Pydantic Schemas** (`server/app/schemas/analytics.py`)

Complete set of request and response models including:
- **Request Models**: `AnalyticsFilters`, `ProfileRole`, `SimulationFilter`, `Method` enums
- **Response Models**: 
  - Header metrics (10): `MetricResponse`
  - Primary analytics (3): `RubricHeatmapResponse`, `GrowthDataResponse`, `PersonaPerformanceResponse`
  - Secondary analytics (3): `AttemptImprovementResponse`, `CohortPerformanceResponse`, `SkillPerformanceResponse`
  - Footer analytics (4): `ScenarioPerformanceResponse`, `ScenarioStatsResponse`, `SimulationCompositionResponse`, `SimulationPerformanceResponse`
  - Bundles (2): `LeaderboardBundleResponse`, `ReportsBundleResponse`
  - Pages (3): `HomeOverviewResponse`, `AttemptHistoryResponse`, `PracticeOverviewResponse`
  - Utility: `RefreshResponse`

### 2. **Analytics Repository** (`server/app/repositories/analytics_repository.py`)

Repository layer that:
- Calls PostgreSQL analytics functions (e.g., `analytics_average_score_fn`)
- Handles filter preparation and type conversion
- Parses database JSON responses into Pydantic models
- Provides clean interface for all 23 analytics endpoints

Key methods:
- Header: `get_average_score`, `get_completion_percentage`, `get_first_attempt_pass_rate`, `get_highest_score`, `get_messages_per_session`, `get_persona_response_times`, `get_session_efficiency`, `get_stagnation_rate`, `get_time_spent`, `get_total_attempts`
- Primary: `get_rubric_heatmap`, `get_growth_data`, `get_persona_performance`
- Secondary: `get_attempt_improvement`, `get_cohort_performance`, `get_skill_performance`
- Footer: `get_scenario_performance`, `get_scenario_stats`, `get_simulation_composition`, `get_simulation_performance`
- Bundles: `get_reports_bundle`, `get_leaderboard_bundle`
- Pages: `get_home_overview`, `get_attempt_history`, `get_practice_overview`
- Utility: `refresh_materialized_view`

### 3. **API Routes** (`server/app/api/v1/analytics/`)

FastAPI routers organized by category:

#### **Header Router** (`header.py`)
10 endpoints for header metrics:
- `POST /api/v1/analytics/header/average-score`
- `POST /api/v1/analytics/header/completion-percentage`
- `POST /api/v1/analytics/header/first-attempt-pass-rate`
- `POST /api/v1/analytics/header/highest-score`
- `POST /api/v1/analytics/header/messages-per-session`
- `POST /api/v1/analytics/header/persona-response-times`
- `POST /api/v1/analytics/header/session-efficiency`
- `POST /api/v1/analytics/header/stagnation-rate`
- `POST /api/v1/analytics/header/time-spent`
- `POST /api/v1/analytics/header/total-attempts`

#### **Primary Router** (`primary.py`)
3 endpoints for primary analytics:
- `POST /api/v1/analytics/primary/growth-data`
- `POST /api/v1/analytics/primary/persona-performance`
- `POST /api/v1/analytics/primary/rubric-heatmap`

#### **Secondary Router** (`secondary.py`)
3 endpoints for secondary analytics:
- `POST /api/v1/analytics/secondary/attempt-improvement`
- `POST /api/v1/analytics/secondary/cohort-performance`
- `POST /api/v1/analytics/secondary/skill-performance`

#### **Footer Router** (`footer.py`)
4 endpoints for footer analytics:
- `POST /api/v1/analytics/footer/scenario-performance`
- `POST /api/v1/analytics/footer/scenario-stats`
- `POST /api/v1/analytics/footer/simulation-composition`
- `POST /api/v1/analytics/footer/simulation-performance`

#### **Bundles Router** (`bundles.py`)
2 bundle endpoints:
- `POST /api/v1/analytics/leaderboard`
- `POST /api/v1/analytics/reports`

#### **Pages Router** (`pages.py`)
3 page-specific endpoints:
- `POST /api/v1/analytics/home`
- `POST /api/v1/analytics/history`
- `POST /api/v1/analytics/practice`

#### **Utility Router** (`utility.py`)
1 utility endpoint:
- `POST /api/v1/analytics/refresh`

### 4. **Main Router Integration** (`server/app/api/v1/router.py`)

Main v1 router that combines all analytics sub-routers and is mounted in `main.py`.

## Architecture

```
Client Request
    ↓
FastAPI Endpoint (server/app/api/v1/analytics/*.py)
    ↓
Analytics Repository (server/app/repositories/analytics_repository.py)
    ↓
PostgreSQL Function (e.g., analytics_average_score_fn)
    ↓
Pydantic Validation (server/app/schemas/analytics.py)
    ↓
JSON Response
```

## Current State vs. Future State

### **Current** (Client-side)
```
Client Route → analyticsRepo (client) → Database
```

### **Future** (Server-side)
```
Client Route → Server API → analyticsRepository (server) → Database
```

## Testing the API

### Start the server:
```bash
cd server && make run
```

### Example request:
```bash
curl -X POST http://localhost:8000/api/v1/analytics/header/average-score \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2025-12-31T23:59:59Z",
    "cohortIds": ["550e8400-e29b-41d4-a716-446655440000"],
    "profileId": "550e8400-e29b-41d4-a716-446655440001",
    "departmentIds": ["550e8400-e29b-41d4-a716-446655440002"]
  }'
```

## Next Steps (Migration Path)

### Phase 1: ✅ Server Routes Created (COMPLETE)
- ✅ Pydantic schemas defined
- ✅ Repository layer implemented
- ✅ API routes created
- ✅ Integrated into main app

### Phase 2: Update Client to Call Server (TODO)
- Update client analytics routes to call server instead of direct repo
- Example:
  ```typescript
  // OLD (current)
  const result = await analyticsRepo.getAverageScore(filters);
  
  // NEW (future)
  const response = await fetch('/api/v1/analytics/header/average-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(filters)
  });
  const result = await response.json();
  ```

### Phase 3: Remove Direct Database Access (TODO)
- Remove or deprecate `analyticsRepo` direct database calls
- Keep repo as an API client wrapper

### Phase 4: Add Server-Side Optimizations (TODO)
- Add caching layer (Redis)
- Add rate limiting
- Add request logging/monitoring
- Add authentication/authorization

## File Structure

```
server/app/
├── api/
│   ├── __init__.py
│   └── v1/
│       ├── __init__.py
│       ├── router.py                    # Main v1 router
│       └── analytics/
│           ├── __init__.py
│           ├── router.py                # Analytics main router
│           ├── header.py                # Header metrics (10 endpoints)
│           ├── primary.py               # Primary analytics (3 endpoints)
│           ├── secondary.py             # Secondary analytics (3 endpoints)
│           ├── footer.py                # Footer analytics (4 endpoints)
│           ├── bundles.py               # Bundle endpoints (2 endpoints)
│           ├── pages.py                 # Page-specific (3 endpoints)
│           └── utility.py               # Utility (1 endpoint)
├── repositories/
│   ├── __init__.py
│   └── analytics_repository.py          # Analytics data access layer
├── schemas/
│   ├── __init__.py
│   └── analytics.py                     # Pydantic models (23 response types)
└── main.py                              # FastAPI app (updated with v1 router)
```

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

All 23 analytics endpoints will be documented with request/response schemas.

## Notes

- All endpoints use `POST` method (as per client convention)
- All endpoints accept `AnalyticsFilters` in request body
- All endpoints return JSON responses matching TypeScript schemas
- Error responses return 500 status with error message
- Database functions are called directly (no ORM queries)
- All routes use dependency injection for database session

