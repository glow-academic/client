# BFF Routes Refactoring Plan

## Goal
Centralize all v2 BFF routes to use memoized server fetcher functions following DRY principles.

## Pattern
1. Create `client/lib/api/v2/server/{resource}.ts` with `cache()` wrapped functions
2. Update BFF routes to call these centralized functions
3. Use these same functions in server components for prefetching

## Resources to Refactor

### Completed ✅
- personas (detail, detail-default)
- documents (detail, detail-bulk)

### To Do
- scenarios (detail, detail-default)
- simulations (detail, detail-default)
- rubrics (detail, detail-default)
- cohorts (detail, detail-default)
- parameters (detail, detail-default)
- departments (detail, detail-default)
- providers (detail)
- models (detail - under providers)
- staff (detail, detail-bulk)
- agents (detail)
- feedback (list - readonly)
- logs (list - readonly)

## Implementation Steps
For each resource:
1. Create server fetcher file with cache()
2. Update corresponding BFF route(s)
3. Use in server components when needed
