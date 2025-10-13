# Analytics Routes: Quick Reference

## Complete One-to-One Mapping (Client ↔ Server)

All routes use **POST** method and accept `AnalyticsFilters` in the request body.

### Header Analytics (10 routes)

| # | Client Route | Server Route | Status |
|---|--------------|--------------|--------|
| 1 | `/api/v1/analytics/header/average-score` | `/api/v1/analytics/header/average-score` | ✅ Ready |
| 2 | `/api/v1/analytics/header/completion-percentage` | `/api/v1/analytics/header/completion-percentage` | ✅ Ready |
| 3 | `/api/v1/analytics/header/first-attempt-pass-rate` | `/api/v1/analytics/header/first-attempt-pass-rate` | ✅ Ready |
| 4 | `/api/v1/analytics/header/highest-score` | `/api/v1/analytics/header/highest-score` | ✅ Ready |
| 5 | `/api/v1/analytics/header/messages-per-session` | `/api/v1/analytics/header/messages-per-session` | ✅ Ready |
| 6 | `/api/v1/analytics/header/persona-response-times` | `/api/v1/analytics/header/persona-response-times` | ✅ Ready |
| 7 | `/api/v1/analytics/header/session-efficiency` | `/api/v1/analytics/header/session-efficiency` | ✅ Ready |
| 8 | `/api/v1/analytics/header/stagnation-rate` | `/api/v1/analytics/header/stagnation-rate` | ✅ Ready |
| 9 | `/api/v1/analytics/header/time-spent` | `/api/v1/analytics/header/time-spent` | ✅ Ready |
| 10 | `/api/v1/analytics/header/total-attempts` | `/api/v1/analytics/header/total-attempts` | ✅ Ready |

### Primary Analytics (3 routes)

| # | Client Route | Server Route | Status |
|---|--------------|--------------|--------|
| 11 | `/api/v1/analytics/primary/growth-data` | `/api/v1/analytics/primary/growth-data` | ✅ Ready |
| 12 | `/api/v1/analytics/primary/persona-performance` | `/api/v1/analytics/primary/persona-performance` | ✅ Ready |
| 13 | `/api/v1/analytics/primary/rubric-heatmap` | `/api/v1/analytics/primary/rubric-heatmap` | ✅ Ready |

### Secondary Analytics (3 routes)

| # | Client Route | Server Route | Status |
|---|--------------|--------------|--------|
| 14 | `/api/v1/analytics/secondary/attempt-improvement` | `/api/v1/analytics/secondary/attempt-improvement` | ✅ Ready |
| 15 | `/api/v1/analytics/secondary/cohort-performance` | `/api/v1/analytics/secondary/cohort-performance` | ✅ Ready |
| 16 | `/api/v1/analytics/secondary/skill-performance` | `/api/v1/analytics/secondary/skill-performance` | ✅ Ready |

### Footer Analytics (4 routes)

| # | Client Route | Server Route | Status |
|---|--------------|--------------|--------|
| 17 | `/api/v1/analytics/footer/scenario-performance` | `/api/v1/analytics/footer/scenario-performance` | ✅ Ready |
| 18 | `/api/v1/analytics/footer/scenario-stats` | `/api/v1/analytics/footer/scenario-stats` | ✅ Ready |
| 19 | `/api/v1/analytics/footer/simulation-composition` | `/api/v1/analytics/footer/simulation-composition` | ✅ Ready |
| 20 | `/api/v1/analytics/footer/simulation-performance` | `/api/v1/analytics/footer/simulation-performance` | ✅ Ready |

### Bundle Analytics (2 routes)

| # | Client Route | Server Route | Status |
|---|--------------|--------------|--------|
| 21 | `/api/v1/analytics/leaderboard` | `/api/v1/analytics/leaderboard` | ✅ Ready |
| 22 | `/api/v1/analytics/reports` | `/api/v1/analytics/reports` | ✅ Ready |

### Page-Specific Analytics (3 routes)

| # | Client Route | Server Route | Status |
|---|--------------|--------------|--------|
| 23 | `/api/v1/analytics/home` | `/api/v1/analytics/home` | ✅ Ready |
| 24 | `/api/v1/analytics/history` | `/api/v1/analytics/history` | ✅ Ready |
| 25 | `/api/v1/analytics/practice` | `/api/v1/analytics/practice` | ✅ Ready |

### Utility (1 route)

| # | Client Route | Server Route | Status |
|---|--------------|--------------|--------|
| 26 | `/api/v1/analytics/refresh` | `/api/v1/analytics/refresh` | ✅ Ready |

---

**Total: 26 routes** (all complete)

## Implementation Details

### Server Files Created

```
server/app/
├── schemas/analytics.py              # 800+ lines of Pydantic models
├── repositories/analytics_repository.py  # Data access layer
└── api/v1/analytics/
    ├── header.py                     # 10 endpoints
    ├── primary.py                    # 3 endpoints
    ├── secondary.py                  # 3 endpoints
    ├── footer.py                     # 4 endpoints
    ├── bundles.py                    # 2 endpoints
    ├── pages.py                      # 3 endpoints
    ├── utility.py                    # 1 endpoint
    └── router.py                     # Main router
```

### Request Format (All Routes)

```json
{
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z",
  "cohortIds": ["uuid1", "uuid2"],
  "roles": ["student", "instructor"],
  "simulationFilters": ["general", "practice"],
  "profileId": "uuid",
  "departmentIds": ["uuid1"]
}
```

### Response Formats

- **Header routes**: Return `MetricResponse` with trend data and data points
- **Primary routes**: Return complex nested data structures (heatmaps, growth data, persona performance)
- **Secondary routes**: Return fact-based analytics (attempts, cohorts, skills)
- **Footer routes**: Return scenario and simulation performance data
- **Bundle routes**: Return aggregated data for reports and leaderboards
- **Page routes**: Return page-specific overview data
- **Refresh route**: Returns success/failure status

## Testing

```bash
# Start server
cd server && make run

# Test endpoint (example)
curl -X POST http://localhost:8000/api/v1/analytics/header/average-score \
  -H "Content-Type: application/json" \
  -d '{"startDate":"2025-01-01T00:00:00Z","endDate":"2025-12-31T23:59:59Z"}'
```

## Next Steps

When ready to migrate client to use server routes:

1. Update `client/app/api/v1/analytics/<route>/route.ts` files
2. Replace `analyticsRepo.<method>(filters)` calls with `fetch()` to server
3. Test all endpoints end-to-end
4. Deploy server and client together
5. Monitor for any data discrepancies

---

For detailed documentation, see:
- `ANALYTICS_API_MAPPING.md` - Full mapping with schemas
- `ANALYTICS_SERVER_SETUP.md` - Architecture and setup guide

