# Remaining Typecheck Errors - BCNF Migration

## Summary: 54 errors in 14 files

### Category 1: Crowdsourcing (DELETED) - 2 errors
**File**: `server/app/utils/dashboard.py`
- Line 8: `SimulationChatCrowdsourcedFeedbacks` - REMOVE
- Line 8: `SimulationCrowdsourcedMessages` - REMOVE

**Action**: Remove crowdsourcing imports and all related code

---

### Category 2: Cohort Arrays → Junctions - 9 errors
**Files**:
1. `server/app/utils/dashboard.py` (Lines: 1254, 1256, 1267, 1290, 1294, 1315, 1316)
   - `cohort.simulation_ids` - Use `t_cohort_simulations` junction
   - `cohort.profile_ids` - Use `t_cohort_profiles` junction

2. `server/app/services/mcp/tools/search/find_cohorts.py` (Line: 188)
   - `cohort.profile_ids` - Use `t_cohort_profiles` junction

3. `server/app/services/mcp/tools/analytics/cohort_pass_matrix.py` (Line: 53)
   - `cohort.profile_ids` - Use `t_cohort_profiles` junction

**Action**: Replace all array access with junction queries

---

### Category 3: Scenario Fields - 25 errors

#### 3.1 description → problem_statement (7 errors)
- `server/app/utils/scenario.py` (Lines: 136)
- `server/app/utils/chat.py` (Line: 183)
- `server/app/services/mcp/tools/lookup/persona_overview.py` (Line: 55)
- `server/app/services/mcp/tools/analytics/student_sim_report.py` (Line: 97)
- `server/app/routes/scenarios.py` (Lines: 115, 142)
- `server/app/web/simulations.py` (Lines: 172, 372)

#### 3.2 document_ids → Junction (10 errors)
- `server/app/utils/scenario.py` (Lines: 122, 206)
- `server/app/services/agents/collection/hint.py` (Lines: 218, 220)
- `server/app/services/agents/collection/simulation.py` (Lines: 107, 108)
- `server/app/routes/scenarios.py` (Lines: 100, 119, 145)
- `server/app/web/simulations.py` (Lines: 176, 376)

#### 3.3 parameter_item_ids → Junction (5 errors)
- `server/app/utils/scenario.py` (Lines: 209, 251)
- `server/app/routes/scenarios.py` (Lines: 101, 120, 146)
- `server/app/web/simulations.py` (Lines: 177, 377)

#### 3.4 parent_id → scenario_tree (1 error)
- `server/app/services/mcp/tools/lookup/persona_overview.py` (Line: 46)

#### 3.5 objectives → Junction (1 error)
- `server/app/routes/scenarios.py` (Line: 143)

#### 3.6 practice_scenario → Removed (1 error)
- `server/app/routes/scenarios.py` (Line: 98)

---

### Category 4: Documents.tags → Removed - 6 errors
- `server/app/utils/scenario.py` (Lines: 153, 171, 450, 501, 526)
- `server/app/utils/document.py` (Line: 105)

**Action**: Remove all `.tags` access - tags now managed via simulation_tags junction

---

### Category 5: Simulation.scenario_ids → Junction - 1 error
- `server/app/services/mcp/tools/lookup/scenario_overview.py` (Line: 52)

---

### Category 6: Undefined Variables - 2 errors
- `server/app/web/simulations.py` (Lines: 530, 536) - `scenario_ids` not defined

---

### Category 7: Type Ambiguity - 2 errors
- `server/app/utils/chat.py` (Lines: 181) - TypedDict ambiguity (non-critical)

---

## Priority Order

1. **HIGH**: Fix simulations.py undefined variables (breaks runtime)
2. **HIGH**: Fix scenario_overview.py simulation.scenario_ids (breaks MCP)
3. **MEDIUM**: Fix all scenario field references (breaks various features)
4. **MEDIUM**: Fix cohort array access (breaks dashboard/analytics)
5. **LOW**: Remove crowdsourcing code (deprecated feature)
6. **LOW**: Remove Documents.tags references (old feature)

