# Migration 276 - SQL Compile Issues Report

## Summary

After running migration 276 and `make sql-compile`, **63 SQL files** reference dropped tables and need updates.

## Migration Status

✅ **Migration 276 completed successfully**
- Created: `profile_cohorts`, `simulation_positions_resource`, `eval_runs_rubrics`, `eval_groups_rubrics`, `simulation_rubrics`, `scenario_rubrics`
- Dropped: `cohort_profiles`, `document_tree`, `document_schema_field_items`, `rubric_grade_agents`, `rubric_grade_agents_audio`, `rubric_groups`, `scenario_video_images`, `scenario_groups`, `scenario_scenario_flags`, `simulation_simulation_scenario_flags`, `tool_schema_field_items`
- Removed column: `cohort_simulations.position` (migrated to `simulation_positions_resource`)

## Issues by Category

### 1. cohort_profiles → profile_cohorts (28 files)

**Dropped Table**: `cohort_profiles`  
**Replacement**: `profile_cohorts` (note: direction reversed - profiles own cohorts now)

**Affected Files**:
- `app/sql/v4/documents/get_certificate_data_complete.sql`
- `app/sql/v4/reports/get_per_simulation_metrics_complete.sql`
- `app/sql/v4/reports/get_reports_bundle_complete.sql`
- `app/sql/v4/cohorts/delete_cohort_complete.sql`
- `app/sql/v4/cohorts/duplicate_cohort_complete.sql`
- `app/sql/v4/cohorts/get_cohort_search_complete.sql`
- `app/sql/v4/cohorts/get_cohorts_list_complete.sql`
- `app/sql/v4/cohorts/leave_cohort_complete.sql`
- `app/sql/v4/dashboard/get_dashboard_history_complete.sql`
- `app/sql/v4/departments/get_department_complete.sql`
- `app/sql/v4/home/get_home_history_complete.sql`
- `app/sql/v4/practice/get_practice_history_complete.sql`
- `app/sql/v4/pricing/get_pricing_analytics_complete.sql`
- `app/sql/v4/pricing/get_pricing_runs_complete.sql`
- `app/sql/v4/profile/create_or_update_profile_complete.sql`
- `app/sql/v4/profile/create_profile_complete.sql`
- `app/sql/v4/profile/get_profile_complete.sql`
- `app/sql/v4/profile/get_profile_context_complete.sql`
- `app/sql/v4/profile/get_profile_detail_complete.sql`
- `app/sql/v4/profile/profile_staff_create_or_update_staff_complete.sql`
- `app/sql/v4/profile/update_profile_complete.sql`
- `app/sql/v4/reports/get_reports_history_complete.sql`
- `app/sql/v4/staff/get_create_staff_data_complete.sql`
- `app/sql/v4/staff/get_staff_complete.sql`
- `app/sql/v4/staff/get_staff_detail_complete.sql`
- `app/sql/v4/staff/get_staff_list_complete.sql`
- `app/sql/v4/staff/get_staff_search_complete.sql`
- `app/sql/v4/staff/upsert_staff_complete.sql`
- `tests/sql/v4/integration/api/cohorts/test_create_cohort_profile_link_v4_complete.sql`

**High-Level Fix**:
- Replace `cohort_profiles` with `profile_cohorts`
- **Important**: Column order reversed - `cohort_profiles(cohort_id, profile_id)` → `profile_cohorts(profile_id, cohort_id)`
- Update JOINs: `FROM cohort_profiles WHERE cohort_id = ...` → `FROM profile_cohorts WHERE cohort_id = ...`
- Update INSERTs: `INSERT INTO cohort_profiles(cohort_id, profile_id, ...)` → `INSERT INTO profile_cohorts(profile_id, cohort_id, ...)`

### 2. rubric_grade_agents Pattern → Direct Rubric Links (18 files)

**Dropped Tables**: 
- `rubric_grade_agents`
- `eval_runs_rubric_grade_agents`
- `eval_groups_rubric_grade_agents`
- `simulation_scenarios_scenario_rubric_grade_agents`

**Replacements**:
- `eval_runs_rubrics` (direct: eval_id, run_id, rubric_id)
- `eval_groups_rubrics` (direct: eval_id, group_id, rubric_id)
- `scenario_rubrics` (direct: scenario_id, rubric_id)
- `simulation_rubrics` (direct: simulation_id, rubric_id)

**Affected Files**:
- `app/sql/v4/analytics/create_analytics_view_complete.sql`
- `app/sql/v4/attempts/get_eval_attempt_complete.sql`
- `app/sql/v4/benchmark/add_eval_groups_complete.sql`
- `app/sql/v4/benchmark/add_eval_runs_complete.sql`
- `app/sql/v4/benchmark/get_benchmark_bundle_complete.sql`
- `app/sql/v4/benchmark/get_benchmark_history_complete.sql`
- `app/sql/v4/benchmark/get_benchmark_overview_complete.sql`
- `app/sql/v4/benchmark/get_eval_detail_complete.sql`
- `app/sql/v4/benchmark/get_evals_list_complete.sql`
- `app/sql/v4/benchmark/get_rubric_grade_agent_for_run_or_group_complete.sql`
- `app/sql/v4/benchmark/get_rubric_grade_agent_v4_complete.sql`
- `app/sql/v4/infrastructure/evals/get_rubric_grade_agent_v4_complete.sql`
- `app/sql/v4/practice/get_practice_overview_complete.sql`
- `app/sql/v4/attempts/get_simulation_attempt_complete.sql`
- `app/sql/v4/grading/get_grading_regeneration_run_context_and_create_run_complete.sql`
- `app/sql/v4/grading/get_grading_run_context_and_create_run_complete.sql`
- `app/sql/v4/rubric/delete_rubric_complete.sql`
- `app/sql/v4/rubric/get_rubrics_list_complete.sql`
- `app/sql/v4/simulations/duplicate_simulation_complete.sql`
- `app/sql/v4/simulations/get_simulation_by_id_complete.sql`
- `app/sql/v4/simulations/get_simulation_complete.sql`
- `app/sql/v4/simulations/get_simulations_list_complete.sql`
- `app/sql/v4/simulations/start_simulation_attempt_complete.sql`

**High-Level Fix**:
- Replace `eval_runs_rubric_grade_agents` JOINs with `eval_runs_rubrics`
- Replace `eval_groups_rubric_grade_agents` JOINs with `eval_groups_rubrics`
- Replace `simulation_scenarios_scenario_rubric_grade_agents` JOINs with `scenario_rubrics`
- Extract `rubric_id` directly (no need to join through `rubric_grade_agents`)
- For functions that need `agent_id`, use arbitrary/default agent_id if required
- Pattern: `JOIN rubric_grade_agents rga ON ...` → Direct `rubric_id` from new tables

### 3. document_tree (3 files)

**Dropped Table**: `document_tree`  
**Replacement**: None (functionality removed)

**Affected Files**:
- `app/sql/v4/documents/complete_document_creation_complete.sql`
- `app/sql/v4/documents/insert_document_tree_complete.sql`
- `app/sql/v4/scenario/get_scenario_detail_complete.sql`
- `app/sql/v4/scenario/get_scenario_new_complete.sql`

**High-Level Fix**:
- Remove all references to `document_tree`
- Remove INSERT/UPDATE/DELETE operations on `document_tree`
- Remove SELECT queries that reference `document_tree`
- Document hierarchy functionality is no longer supported

### 4. scenario_scenario_flags (2 files)

**Dropped Table**: `scenario_scenario_flags`  
**Replacement**: Use `scenario_flags` directly (via `scenario_flags` junction table)

**Affected Files**:
- `app/sql/v4/scenarios/get_scenario_complete.sql`
- `app/sql/v4/scenarios/save_scenario_complete.sql`

**High-Level Fix**:
- Replace `scenario_scenario_flags` with `scenario_flags` junction table
- Use `scenario_flags(scenario_id, flag_id, value, ...)` directly

### 5. analytics Materialized View (6 files)

**Issue**: Materialized view `analytics` needs to be refreshed after migration

**Affected Files**:
- `app/sql/v4/dashboard/get_dashboard_bundle_complete.sql`
- `app/sql/v4/home/get_home_overview_complete.sql`
- `app/sql/v4/leaderboard/get_leaderboard_bundle_complete.sql`
- `app/sql/v4/reports/get_reports_overview_complete.sql`
- `app/sql/v4/leaderboard/get_leaderboard_complete.sql`
- `app/sql/v4/leaderboard/get_leaderboard_list_complete.sql`

**High-Level Fix**:
- Refresh materialized view: `REFRESH MATERIALIZED VIEW analytics;`
- Update `create_analytics_view_complete.sql` to remove `rubric_grade_agents` references
- Use direct rubric links in analytics view definition

## High-Level Fix Strategy

### Phase 1: Update cohort_profiles References
1. Search and replace `cohort_profiles` with `profile_cohorts`
2. Reverse column order in all INSERT/UPDATE/SELECT statements
3. Update WHERE clauses: `cohort_profiles.cohort_id` → `profile_cohorts.cohort_id` (same column name, different table)
4. Update JOINs: `JOIN cohort_profiles ON ...` → `JOIN profile_cohorts ON ...`

### Phase 2: Update rubric_grade_agents Pattern
1. Replace `eval_runs_rubric_grade_agents` with `eval_runs_rubrics`
2. Replace `eval_groups_rubric_grade_agents` with `eval_groups_rubrics`
3. Replace `simulation_scenarios_scenario_rubric_grade_agents` with `scenario_rubrics`
4. Remove JOINs through `rubric_grade_agents` - use `rubric_id` directly
5. For functions requiring `agent_id`, use arbitrary/default agent_id
6. Pattern example:
   ```sql
   -- OLD:
   JOIN eval_runs_rubric_grade_agents erga ON ...
   JOIN rubric_grade_agents rga ON erga.rubric_grade_agent_id = rga.id
   SELECT rga.rubric_id, rga.grade_agent_id
   
   -- NEW:
   JOIN eval_runs_rubrics err ON ...
   SELECT err.rubric_id  -- Direct rubric_id, no agent needed
   ```

### Phase 3: Remove document_tree References
1. Remove all INSERT/UPDATE/DELETE on `document_tree`
2. Remove SELECT queries referencing `document_tree`
3. Document hierarchy functionality removed - update UI/docs accordingly

### Phase 4: Fix scenario_scenario_flags
1. Replace `scenario_scenario_flags` with `scenario_flags` junction table
2. Use direct flag relationships via `scenario_flags(scenario_id, flag_id, value)`

### Phase 5: Refresh Analytics View
1. Update `create_analytics_view_complete.sql` to use direct rubric links
2. Refresh materialized view: `REFRESH MATERIALIZED VIEW analytics;`
3. Update all queries that depend on analytics view

## Notes

- All fixes should maintain backward compatibility where possible
- Test each SQL file after updating
- Some functions may need `agent_id` - use arbitrary/default value for now
- The `grades` table had a foreign key constraint `grades_rubric_grade_agent_id_fkey` that was dropped - may need to update grades table references
