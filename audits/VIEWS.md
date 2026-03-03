# Views Audit — Materialized View Integrity Check

You are a views auditor for the GLOW project. Your job is to verify that all materialized views (MVs) in `server/app/v5/sql/views/` follow the canonical rules defined below. You do NOT fix anything. You REPORT errors, inconsistencies, and violations.

Run each audit step in order. For each step, inspect the SQL files and compare against the rules. Collect all errors into a final report at the end.

---

## Database Credentials

```
psql postgresql://myuser:mypassword@localhost:5432/mydb
```

---

## The Three View Types

| Type | Naming Convention | Location | Purpose |
|------|------------------|----------|---------|
| **Materialized View** | `mv_{domain}_{name}` | `server/app/v5/sql/views/{domain}/` | Pre-computed read-side aggregations, refreshed on demand |
| **Union View** | `view_{entity}_entry` | `server/app/v5/sql/views/shared/` | Consolidate domain-specific entry tables into unified entry views |
| **Draft MV** | `mv_draft_{artifact}` | `server/app/v5/sql/views/drafts/` | Per-artifact draft state snapshots |

---

## The Rules

### Rule 1: Only materialized views — no regular views

All read-side aggregation MUST use `CREATE MATERIALIZED VIEW`. Regular `CREATE VIEW` statements are only permitted for union views in `shared/` that consolidate entry tables. No other regular views should exist.

**Why:** Regular views execute on every query. MVs are pre-computed and refreshed on demand, giving predictable read performance.

### Rule 2: MVs may ONLY join entry tables and connection tables

A materialized view may reference:
- `*_entry` tables (analytical/operational data)
- `*_connection` tables (entry-to-resource links)
- `*_junction` tables (artifact-to-resource links, for ID collection only)
- Union views from `shared/` (which themselves only touch entry tables)

A materialized view MUST NOT reference:
- `*_resource` tables (hydration happens in Python)
- `*_artifact` tables (except for ID lookups via junctions)

**Why:** MVs collect IDs. The Python views layer hydrates those IDs into full objects via `_internal()` resource functions. This keeps MVs simple, fast to refresh, and decoupled from resource schema changes.

### Rule 3: MVs are independent — no MV-to-MV dependencies

A materialized view MUST NOT read from another materialized view. Each MV queries entry/connection tables directly.

**Why:** MV-to-MV dependencies create refresh ordering constraints. If `mv_A` depends on `mv_B`, then `mv_B` must be refreshed first. This creates cascading refresh chains that are fragile, slow, and hard to reason about. Independent MVs can be refreshed in any order, in parallel.

### Rule 4: MV naming follows `mv_{domain}_{name}`

| Convention | Example |
|-----------|---------|
| File name | `mv_{domain}_{name}.sql` |
| MV name inside SQL | `mv_{domain}_{name}` |
| Domain folder | `server/app/v5/sql/views/{domain}/` |

No `z_` prefixes, no `_complete` suffixes, no numbered prefixes (like `00_`). The file name must match the MV name exactly.

### Rule 5: MV SQL follows the 6-step pattern

Every MV SQL file must follow this structure in order:

```sql
-- Step 1: Drop indexes (IF EXISTS, one per index)
-- Step 2: Drop MV (IF EXISTS, with CASCADE)
-- Step 3: Create MV (CREATE MATERIALIZED VIEW ... AS ...)
-- Step 4: Create unique index (one, on the grain PK)
-- Step 5: Create filter indexes (one per filterable column/combo)
-- Step 6: Refresh MV (REFRESH MATERIALIZED VIEW CONCURRENTLY ...)
```

No custom types, no functions, no DO blocks. The MV is the only object created.

### Rule 6: Each MV has exactly one grain

Every MV must have a clearly defined grain — the unique key that identifies one row. This is enforced by the unique index in Step 4.

| Domain | MV | Grain |
|--------|----|-------|
| activity | `mv_activity_audits` | `audit_id` |
| activity | `mv_activity_daily` | `(date, endpoint)` |
| activity | `mv_activity_feedbacks` | `feedback_id` |
| activity | `mv_activity_logins` | `login_id` |
| activity | `mv_activity_problems` | `problem_id` |
| activity | `mv_activity_session_facts` | `session_id` |
| activity | `mv_activity_summary` | single row |
| analytics | `mv_analytics_chat_facts` | `chat_id` |
| analytics | `mv_analytics_attempt_facts` | `attempt_id` |
| analytics | `mv_analytics_daily_metrics` | `(date, cohort_id, simulation_id, attempt_type, is_archived)` |
| analytics | `mv_analytics_profile_metrics` | `(profile_id, attempt_type, is_archived)` |
| benchmark | `mv_benchmark_attempt_facts` | `test_id` |
| benchmark | `mv_benchmark_bundle` | `bundle_id` |
| benchmark | `mv_benchmark_eval_summary` | `eval_id` |
| benchmark | `mv_benchmark_invocations` | `invocation_id` |
| benchmark | `mv_benchmark_tests` | `test_id` |
| config | `mv_config` | `config_id` |
| drafts | `mv_draft_{artifact}` | `draft_id` (one per artifact type) |
| health | `mv_health_metrics_hourly` | `date_hour` |
| health | `mv_health_service_hourly` | `(date_hour, service)` |
| pricing | `mv_pricing_run_facts` | `run_id` |
| pricing | `mv_pricing_daily` | `(date, model_id, agent_id)` |
| pricing | `mv_pricing_group_summary` | `group_id` |
| attempt | `mv_attempt_list` | `attempt_id` |
| attempt | `mv_attempt_chats` | `chat_id` |
| attempt | `mv_attempt_messages` | `message_id` |
| training | `mv_training` | `training_id` |
| training | `mv_training_bundle` | `bundle_id` |
| training | `mv_training_context` | `training_id` |
| artifacts | `mv_artifact_session_list` | `session_id` |

### Rule 7: MVs expose IDs, not names

MVs store resource IDs (UUIDs) and aggregate metrics. They do NOT store resource names, descriptions, or other denormalized resource fields. Name resolution happens in the Python views layer via `_internal()` resource functions.

**Exception:** Columns that are intrinsic to the entry/connection (timestamps, counts, scores, flags) are fine. Only *resource metadata* is excluded.

### Rule 8: No legacy folders or prefixes

The views folder must not contain:
- `z_legacy/` or `legacy/` folders
- `z_` prefixed file names (e.g., `mv_z_artifact_session_list.sql`)
- `_complete` suffixed file names (MV definitions are not compiled SQL functions)
- Numbered prefixes for ordering (e.g., `mv_pricing_00_run_facts.sql`)
- Deprecated/empty files (e.g., files that only contain DROP statements)

If a view is no longer needed, delete the file entirely.

### Rule 9: Union views are the only regular views allowed

Union views in `shared/` consolidate domain-specific entry tables:

```sql
CREATE OR REPLACE VIEW view_{entity}_entry AS
    SELECT ... FROM simulation_{entity}_entry
    UNION ALL
    SELECT ... FROM benchmark_{entity}_entry;
```

These are permitted because they provide a stable read interface across domains without materialization overhead. They must:
- Live in `server/app/v5/sql/views/shared/`
- Only reference `*_entry` tables
- Use `UNION ALL` (not `UNION`)
- Follow naming: `view_{entity}_entry`

### Rule 10: MV refresh is always independent

Every MV must be refreshable with a single command:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_{domain}_{name};
```

No prerequisites. No ordering. No dependent refreshes. This means:
- No MV reads from another MV (Rule 3)
- No MV depends on a function that reads another MV
- The Python refresh endpoints can refresh any MV at any time

---

## Folder Structure

```
server/app/v5/sql/views/
├── activity/
│   ├── mv_activity_audits.sql
│   ├── mv_activity_daily.sql
│   ├── mv_activity_feedbacks.sql
│   ├── mv_activity_logins.sql
│   ├── mv_activity_problems.sql
│   ├── mv_activity_session_facts.sql
│   └── mv_activity_summary.sql
├── analytics/
│   ├── mv_analytics_attempt_facts.sql
│   ├── mv_analytics_chat_facts.sql
│   ├── mv_analytics_daily_metrics.sql
│   └── mv_analytics_profile_metrics.sql
├── artifacts/
│   └── mv_artifact_session_list.sql
├── benchmark/
│   ├── mv_benchmark_attempt_facts.sql
│   ├── mv_benchmark_bundle.sql
│   ├── mv_benchmark_eval_summary.sql
│   ├── mv_benchmark_invocations.sql
│   └── mv_benchmark_tests.sql
├── config/
│   └── mv_config.sql
├── drafts/
│   ├── mv_draft_agent.sql
│   ├── mv_draft_auth.sql
│   ├── ... (one per artifact type)
│   └── mv_draft_training_bundle.sql
├── health/
│   ├── mv_health_metrics_hourly.sql
│   └── mv_health_service_hourly.sql
├── pricing/
│   ├── mv_pricing_daily.sql
│   ├── mv_pricing_group_summary.sql
│   └── mv_pricing_run_facts.sql
├── shared/
│   ├── create_union_view_attempts_entry_complete.sql
│   ├── create_union_view_chats_entry_complete.sql
│   ├── create_union_view_feedbacks_entry_complete.sql
│   ├── create_union_view_grades_entry_complete.sql
│   ├── create_union_view_hints_entry_complete.sql
│   ├── create_union_view_improvements_entry_complete.sql
│   ├── create_union_view_message_tree_entry_complete.sql
│   ├── create_union_view_messages_entry_complete.sql
│   └── create_union_view_strengths_entry_complete.sql
├── attempt/
│   ├── mv_attempt_list.sql
│   ├── mv_attempt_chats.sql
│   └── mv_attempt_messages.sql
└── training/
    ├── mv_training.sql
    ├── mv_training_bundle.sql
    └── mv_training_context.sql
```

---

## Current Violations (Audit Baseline)

This section documents known violations as of the initial audit. Each should be resolved over time.

### V1: MV-to-MV Dependencies (Rule 3 violations)

| MV | Depends On | Fix |
|----|-----------|-----|
| `mv_attempt_facts` | `mv_chat_facts` | Rewrite to query entry/connection tables directly |
| `mv_daily_metrics` | `mv_chat_facts` | Rewrite to query entry/connection tables directly |
| `mv_profile_metrics` | `mv_chat_facts` | Rewrite to query entry/connection tables directly |
| `mv_pricing_daily` | `mv_pricing_run_facts` | Rewrite to query entry/connection tables directly |
| `mv_pricing_group_summary` | `mv_pricing_run_facts` | Rewrite to query entry/connection tables directly |
| `mv_artifact_session_list` | `mv_pricing_group_summary` | Rewrite to query entry/connection tables directly |

### V2: Resource Table References in MVs (Rule 2 violations)

| MV | Resource Tables Referenced | Fix |
|----|--------------------------|-----|
| `mv_activity_problems` | `names_resource` | Move name resolution to Python |
| `mv_artifact_session_list` | `names_resource` | Move name resolution to Python |
| `mv_benchmark_attempt_facts` | `run_rubrics_resource`, `group_rubrics_resource` | Expose rubric IDs, hydrate in Python |
| `mv_benchmark_eval_summary` | `run_rubrics_resource`, `group_rubrics_resource`, `flags_resource` | Expose IDs, hydrate in Python |
| `mv_benchmark_tests` | `run_rubrics_resource`, `group_rubrics_resource` | Expose rubric IDs, hydrate in Python |
| `mv_config` | `agents_resource` | Expose agent IDs, hydrate in Python |
| `mv_pricing_run_facts` | `pricing_resource`, `artifact_units_relation` | Expose pricing IDs, hydrate in Python |
| `mv_attempt_chats` | `scenario_time_limits_resource` | Expose time_limit ID, hydrate in Python |
| `mv_training_bundle` | `flags_resource` | Expose flag IDs, hydrate in Python |
| `mv_training_context` | `scenario_positions_resource`, `scenario_time_limits_resource`, `standard_groups_resource` | Expose IDs, hydrate in Python |

### V3: Legacy/Naming Violations (Rule 4, Rule 8)

| File | Issue | Fix |
|------|-------|-----|
| `artifacts/mv_z_artifact_session_list.sql` | `z_` prefix in filename | Rename to `mv_artifact_session_list.sql` |
| `pricing/mv_pricing_00_run_facts.sql` | `00_` numbered prefix | Rename to `mv_pricing_run_facts.sql` |
| `analytics/mv_attempt_facts_complete.sql` | `_complete` suffix | Rename to `mv_analytics_attempt_facts.sql` |
| `analytics/mv_chat_facts_complete.sql` | `_complete` suffix | Rename to `mv_analytics_chat_facts.sql` |
| `analytics/mv_daily_metrics_complete.sql` | `_complete` suffix | Rename to `mv_analytics_daily_metrics.sql` |
| `analytics/mv_profile_metrics_complete.sql` | `_complete` suffix | Rename to `mv_analytics_profile_metrics.sql` |
| `z_legacy/` | Legacy folder | Delete folder and contents |
| `legacy/` | Legacy folder | Delete folder and contents |
| `benchmark/mv_benchmark_messages.sql` | Deprecated (DROP only) | Delete file |
| `create_user_profile_view_complete.sql` | Root-level regular view | Delete or move to shared/ |
| `create_grade_per_standard_group_view_complete.sql` | Root-level regular view | Delete or move to shared/ |
| `attempt/` | Contains regular views, not MVs | Delete or migrate to shared/ union views |
| `attempt/mv_attempt_list.sql` | Renamed from `simulation/mv_simulation_attempts.sql` | Done |
| `attempt/mv_attempt_chats.sql` | Renamed from `simulation/mv_simulation_chats.sql` | Done |
| `attempt/mv_attempt_messages.sql` | Renamed from `simulation/mv_simulation_messages.sql` | Done |
| `legacy/create_legacy_simulation_mvs_complete.sql` | Legacy MV file | Delete if MVs are recreated elsewhere |

---

## Type Flow: MV to API

```
MV SQL (server/app/v5/sql/views/{domain}/)
    ↓ REFRESH MATERIALIZED VIEW CONCURRENTLY
PostgreSQL materialized view
    ↓ conn.fetch() or execute_sql_typed()
Python Views Layer (server/app/v5/api/views/{domain}/)
    ↓ _internal() functions return typed responses
Python Artifacts Layer (server/app/v5/api/main/{resource}/)
    ↓ hydrates IDs via resource _internal() functions
API Response → Client
```

The views layer is the **read path**. It never writes. It never mutates. It only queries MVs and returns structured data.
