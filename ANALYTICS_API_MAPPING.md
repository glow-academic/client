# Analytics API Mapping: Client to Server

This document maps the client-side analytics routes to their corresponding server-side endpoints.

## Current Architecture
- **Client Routes**: `/client/app/api/v1/analytics/*` - Currently call `analyticsRepo` directly
- **Server Routes**: `/server/app/api/v1/analytics/*` - To be created (will replace direct repo calls)

## Route Mapping

### Header Analytics (10 metrics)

| Client Route | Server Route | Method | Request Body | Response Type |
|-------------|--------------|--------|--------------|---------------|
| `/api/v1/analytics/header/average-score` | `/api/v1/analytics/header/average-score` | POST | `AnalyticsFilters` | `MetricResponse` |
| `/api/v1/analytics/header/completion-percentage` | `/api/v1/analytics/header/completion-percentage` | POST | `AnalyticsFilters` | `MetricResponse` |
| `/api/v1/analytics/header/first-attempt-pass-rate` | `/api/v1/analytics/header/first-attempt-pass-rate` | POST | `AnalyticsFilters` | `MetricResponse` |
| `/api/v1/analytics/header/highest-score` | `/api/v1/analytics/header/highest-score` | POST | `AnalyticsFilters` | `MetricResponse` |
| `/api/v1/analytics/header/messages-per-session` | `/api/v1/analytics/header/messages-per-session` | POST | `AnalyticsFilters` | `MetricResponse` |
| `/api/v1/analytics/header/persona-response-times` | `/api/v1/analytics/header/persona-response-times` | POST | `AnalyticsFilters` | `MetricResponse` |
| `/api/v1/analytics/header/session-efficiency` | `/api/v1/analytics/header/session-efficiency` | POST | `AnalyticsFilters` | `MetricResponse` |
| `/api/v1/analytics/header/stagnation-rate` | `/api/v1/analytics/header/stagnation-rate` | POST | `AnalyticsFilters` | `MetricResponse` |
| `/api/v1/analytics/header/time-spent` | `/api/v1/analytics/header/time-spent` | POST | `AnalyticsFilters` | `MetricResponse` |
| `/api/v1/analytics/header/total-attempts` | `/api/v1/analytics/header/total-attempts` | POST | `AnalyticsFilters` | `MetricResponse` |

### Primary Analytics (3 complex metrics)

| Client Route | Server Route | Method | Request Body | Response Type |
|-------------|--------------|--------|--------------|---------------|
| `/api/v1/analytics/primary/growth-data` | `/api/v1/analytics/primary/growth-data` | POST | `AnalyticsFilters` | `GrowthDataResponse` |
| `/api/v1/analytics/primary/persona-performance` | `/api/v1/analytics/primary/persona-performance` | POST | `AnalyticsFilters` | `PersonaPerformanceResponse` |
| `/api/v1/analytics/primary/rubric-heatmap` | `/api/v1/analytics/primary/rubric-heatmap` | POST | `AnalyticsFilters` | `RubricHeatmapResponse` |

### Secondary Analytics (3 complex metrics)

| Client Route | Server Route | Method | Request Body | Response Type |
|-------------|--------------|--------|--------------|---------------|
| `/api/v1/analytics/secondary/attempt-improvement` | `/api/v1/analytics/secondary/attempt-improvement` | POST | `AnalyticsFilters` | `AttemptImprovementResponse` |
| `/api/v1/analytics/secondary/cohort-performance` | `/api/v1/analytics/secondary/cohort-performance` | POST | `AnalyticsFilters` | `CohortPerformanceResponse` |
| `/api/v1/analytics/secondary/skill-performance` | `/api/v1/analytics/secondary/skill-performance` | POST | `AnalyticsFilters` | `SkillPerformanceResponse` |

### Footer Analytics (4 metrics)

| Client Route | Server Route | Method | Request Body | Response Type |
|-------------|--------------|--------|--------------|---------------|
| `/api/v1/analytics/footer/scenario-performance` | `/api/v1/analytics/footer/scenario-performance` | POST | `AnalyticsFilters` | `ScenarioPerformanceResponse` |
| `/api/v1/analytics/footer/scenario-stats` | `/api/v1/analytics/footer/scenario-stats` | POST | `AnalyticsFilters` | `ScenarioStatsResponse` |
| `/api/v1/analytics/footer/simulation-composition` | `/api/v1/analytics/footer/simulation-composition` | POST | `AnalyticsFilters` | `SimulationCompositionResponse` |
| `/api/v1/analytics/footer/simulation-performance` | `/api/v1/analytics/footer/simulation-performance` | POST | `AnalyticsFilters` | `SimulationPerformanceResponse` |

### Bundle Analytics

| Client Route | Server Route | Method | Request Body | Response Type |
|-------------|--------------|--------|--------------|---------------|
| `/api/v1/analytics/leaderboard` | `/api/v1/analytics/leaderboard` | POST | `AnalyticsFilters` | `LeaderboardBundleResponse` |
| `/api/v1/analytics/reports` | `/api/v1/analytics/reports` | POST | `AnalyticsFilters` | `ReportsBundleResponse` |

### Page-specific Analytics

| Client Route | Server Route | Method | Request Body | Response Type |
|-------------|--------------|--------|--------------|---------------|
| `/api/v1/analytics/home` | `/api/v1/analytics/home` | POST | `AnalyticsFilters` | `HomeOverviewResponse` |
| `/api/v1/analytics/history` | `/api/v1/analytics/history` | POST | `AnalyticsFilters` | `AttemptHistoryResponse` |
| `/api/v1/analytics/practice` | `/api/v1/analytics/practice` | POST | `AnalyticsFilters` | `PracticeOverviewResponse` |

### Utility Endpoints

| Client Route | Server Route | Method | Request Body | Response Type |
|-------------|--------------|--------|--------------|---------------|
| `/api/v1/analytics/refresh` | `/api/v1/analytics/refresh` | POST | None | `{ success: boolean, message: string, status: string }` |

## Request Body Schema

### AnalyticsFilters

```typescript
{
  startDate: string;           // ISO timestamp
  endDate: string;             // ISO timestamp
  cohortIds?: string[];        // Optional array of UUID strings
  roles?: string[];            // Optional array of role strings
  simulationFilters?: ('general' | 'practice' | 'archived')[];
  profileId?: string;          // Optional UUID string
  departmentIds?: string[];    // Optional array of UUID strings
}
```

## Python/FastAPI Implementation Notes

1. **Router Structure**: Create nested routers matching the client structure
2. **Request/Response Models**: Use Pydantic models that match the TypeScript schemas
3. **Database Functions**: All routes call PostgreSQL analytics functions (e.g., `analytics_average_score_fn`)
4. **Error Handling**: Return 500 status with error message on failure
5. **Validation**: Use Pydantic for request validation

## Migration Path

1. ✅ **Phase 1**: Create server routes (COMPLETE - see `ANALYTICS_SERVER_SETUP.md`)
   - ✅ Pydantic schemas created (`server/app/schemas/analytics.py`)
   - ✅ Repository layer created (`server/app/repositories/analytics_repository.py`)
   - ✅ API routes created (`server/app/api/v1/analytics/`)
   - ✅ Integrated into main FastAPI app
   - ✅ All 23 endpoints tested (linting passed)
2. **Phase 2**: Update client routes to call server endpoints instead of repo
3. **Phase 3**: Remove direct database access from client repo
4. **Phase 4**: Add caching/optimization on server side

