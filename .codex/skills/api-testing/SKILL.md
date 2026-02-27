---
name: api-testing
description: Guide for testing API endpoints at localhost:8000, including authentication headers, cache bypass, and standard analytics parameters. Use when asked to test endpoints or verify API responses.
---

# API Testing Guide

Call the API at `localhost:8000` to test endpoints and verify they return expected data.

## Authentication Header

For v4 API endpoints, use this header:

```
X-Profile-Id: 019b3be4-36f0-788c-9df2-481eb5917940
```

## Cache Bypass Header

To bypass Redis cache during testing, add this header:

```
X-Bypass-Cache: 1
```

## Analytics Endpoint Parameters

For analytics endpoints (home, dashboard, reports, pricing, etc.), use these standard parameters.

**IMPORTANT:** `cohort_ids`, `department_ids`, `accessible_cohort_ids`, and `accessible_department_ids` must use `*_resource` IDs (not `*_artifact` IDs). The MVs join against `cohorts_resource` and `departments_resource`.

```json
{
  "start_date": "2025-08-01T00:00:00.000Z",
  "end_date": "2026-02-28T23:59:59.999Z",
  "cohort_ids": [
    "019bb25e-e605-7406-b985-0a3e9f95395c",
    "019bb25e-e605-7497-9ea7-9ab10588dcce",
    "019bb25e-e605-749f-a376-47857f500e1c",
    "019bb25e-e605-74a0-a4af-37a6a4b2375d"
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
    "practice"
  ],
  "department_ids": [
    "019bb25e-e624-73da-8cef-166028a1065a",
    "019bb25e-e624-744f-a6b0-21686815b719",
    "019bb25e-e624-7450-8897-a72c55c26107",
    "019bb25e-e624-7455-a0f7-2248e8c5a63b",
    "019bb25e-e624-7459-b42d-b7ee5595e1c7",
    "019bb25e-e624-745f-85ac-d4c79657d7e1",
    "019bb25e-e624-7461-ae69-85ba6cc54ae7"
  ],
  "accessible_cohort_ids": [
    "019bb25e-e605-7406-b985-0a3e9f95395c",
    "019bb25e-e605-7497-9ea7-9ab10588dcce",
    "019bb25e-e605-749f-a376-47857f500e1c",
    "019bb25e-e605-74a0-a4af-37a6a4b2375d"
  ],
  "accessible_department_ids": [
    "019bb25e-e624-73da-8cef-166028a1065a",
    "019bb25e-e624-744f-a6b0-21686815b719",
    "019bb25e-e624-7450-8897-a72c55c26107",
    "019bb25e-e624-7455-a0f7-2248e8c5a63b",
    "019bb25e-e624-7459-b42d-b7ee5595e1c7",
    "019bb25e-e624-745f-85ac-d4c79657d7e1",
    "019bb25e-e624-7461-ae69-85ba6cc54ae7"
  ]
}
```

## ID Reference

### Cohort Resource IDs (`cohorts_resource`)
| Name | ID |
|------|-----|
| First Time GTA's | `019bb25e-e605-7406-b985-0a3e9f95395c` |
| [DEMO] TESTING SIMULATIONS | `019bb25e-e605-7497-9ea7-9ab10588dcce` |
| Returning GTAs | `019bb25e-e605-749f-a376-47857f500e1c` |
| Department Mix | `019bb25e-e605-74a0-a4af-37a6a4b2375d` |
| Practice Cohort | `019bb25e-e605-7500-8000-000000000001` |

### Department Resource IDs (`departments_resource`)
| Name | ID |
|------|-----|
| Purdue CS | `019bb25e-e624-73da-8cef-166028a1065a` |
| Purdue Math | `019bb25e-e624-744f-a6b0-21686815b719` |
| Purdue Chem | `019bb25e-e624-7450-8897-a72c55c26107` |
| Biology | `019bb25e-e624-7455-a0f7-2248e8c5a63b` |
| Earth, Atmospheric, and Planetary Sciences | `019bb25e-e624-7459-b42d-b7ee5595e1c7` |
| Physics | `019bb25e-e624-745f-85ac-d4c79657d7e1` |
| Statistics | `019bb25e-e624-7461-ae69-85ba6cc54ae7` |

**Note:** Use `snake_case` for API request bodies (e.g., `start_date`, `cohort_ids`, `department_ids`), not `camelCase`.
