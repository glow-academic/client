---
name: api-testing
description: Guide for testing API endpoints at localhost:8000, including authentication headers, cache bypass, and standard analytics parameters. Use when asked to test endpoints or verify API responses.
---

# API Testing Guide

Call the API at `localhost:8000` to test endpoints and verify they return expected data.

## Authentication Header

For v4 API endpoints, use this header:

```
X-Profile-Id: 019b3be4-36f0-7ebd-ac27-52e3dba461f1
```

## Cache Bypass Header

To bypass Redis cache during testing, add this header:

```
X-Bypass-Cache: 1
```

## Analytics Endpoint Parameters

For analytics endpoints (home, dashboard, reports, pricing, etc.), use these standard parameters:

```json
{
  "start_date": "2025-08-01T00:00:00.000Z",
  "end_date": "2025-11-01T23:59:59.999Z",
  "cohort_ids": [
    "019b3be4-3243-7621-83d6-0ea2db46965b",
    "019b3be4-3243-7679-89b8-826048d1bb5d",
    "019b3be4-3243-7685-af3f-4de552900f45"
  ],
  "roles": [
    "guest",
    "member",
    "instructional",
    "admin",
    "superadmin"
  ],
  "simulation_filters": [
    "general",
    "practice",
    "archived"
  ],
  "department_ids": [
    "019b3be4-3247-7cb0-bd74-9b2467b5e32d",
    "019b3be4-3247-7d4f-9974-77e974f7949c",
    "019b3be4-3247-7d5e-a958-5b9fb4e2725b",
    "019b3be4-3247-7d66-a799-96fb9b34bc2a",
    "019b3be4-3247-7d6c-9453-53b0a7155c04",
    "019b3be4-3247-7d75-b682-fd462e133f6c",
    "019b3be4-3247-7d7a-bded-a786d8eae83c"
  ]
}
```

**Note:** Use `snake_case` for API request bodies (e.g., `start_date`, `cohort_ids`, `department_ids`), not `camelCase`.
