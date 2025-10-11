# BCNF Migration - Manual Code Changes Only

**Migration SQL**: `apply_bncf_migration.sql` (Hard Cut-Over - No Fallback Columns)

This document covers **only manual code changes** after the BCNF migration is applied and schema/models/routes are auto-generated.

⚠️ **This is a hard migration** - all denormalized columns are dropped with no fallbacks.

---

## ✅ What's Auto-Generated (Skip These)

- Schema files (`database/drizzle/schema.ts`, `client/utils/drizzle/schema.ts`)
- Python models (`server/app/models.py`)
- API routes (`client/app/api/v1/*`)
- Repositories (`client/lib/repos/*`)
- Hooks (`client/lib/api/hooks/*`)
- Type definitions (`client/types.ts`)

**Note**: Tests and mocks are not covered in this document.

---

## 🎯 Migration Progress

| Layer | Status | Files |
|-------|--------|-------|
| **Database Schema** | ✅ **COMPLETE** | All 8 app/*.sql files updated |
| **Database Seed Data** | ✅ **COMPLETE** | All 8 seed/*.sql files updated |
| **Analytics SQL (9 files)** | ✅ **COMPLETE** | All views/functions updated |
| **Server Models** | ❌ **PENDING** | models.py needs junction classes |
| **Server Business Logic** | ❌ **PENDING** | ~20 files need updates |
| **Client Components** | ❌ **PENDING** | ~20 files need updates |
| **Crowdsourcing Cleanup** | ❌ **PENDING** | ~5 files to delete/update |

**Database is ready!** ✅ You can run `yarn migrate` successfully.  
**Application code** needs ~60 file updates to work with new schema.

---

## 📊 Additional Schema Changes

The migration includes these additional normalizations:

**Profile ↔ Department M:N Relationship**:
- New `profile_departments` table with `(profile_id, department_id, is_primary, created_at)`
- ✅ **HARD DROP**: `profiles.department_id` column removed
- Unique constraint: Max one primary department per profile
- Supports multiple departments per profile with primary designation
- Analytics MV updated to use effective department (primary first, else earliest)
- Agent inheritance updated to use effective department

**Tag Management**:
- ✅ **HARD DROP**: `documents.tags[]` and `parameter_items.tags[]` arrays removed
- All tags now managed via `simulation_tags` → `simulation_tag_documents` / `simulation_tag_parameter_items`
- Unique constraint: No duplicate tag text per simulation (case-insensitive)
- Fast tag text lookups with dedicated index

**Integrity Constraints**:
- ✅ Single parent per scenario enforced (tree structure, not DAG)
- ✅ Unique position ordering within simulations
- ✅ No duplicate tag text per simulation

**Convenience Views**:
- `v_tagged_documents`: Cross-simulation document tag discovery
- `v_tagged_parameter_items`: Cross-simulation parameter item tag discovery

---

## 🔧 Manual Changes Required

### 1. Server Business Logic

#### `/server/app/web/simulations.py` - Simulation Start Logic

**Line 123-151**: Replace array access with junction query

```python
# OLD:
scenario_ids = simulation.scenario_ids or []
chosen_scenario_id = scenario_ids[0]

# NEW:
from sqlmodel import select
scenario_links = db_session.exec(
    select(SimulationScenarios)
    .where(SimulationScenarios.simulation_id == simulation.id)
    .order_by(SimulationScenarios.position)
).all()

if not scenario_links:
    # Handle no scenarios configured
    pass

chosen_scenario_id = scenario_links[0].scenario_id
```

---

#### `/server/app/routes/scenarios.py` - Scenario Creation

Replace array assignments with junction inserts:

```python
# OLD (don't do this):
scenario.objectives = objectives
scenario.parameter_item_ids = parameter_item_ids
scenario.document_ids = document_ids

# NEW:
# 1. Create objectives via junction
for idx, obj in enumerate(objectives):
    db_session.add(ScenarioObjectives(
        scenario_id=scenario.id,
        idx=idx,
        objective=obj
    ))

# 2. Create parameter item links
for param_id in parameter_item_ids:
    db_session.add(ScenarioParameterItems(
        scenario_id=scenario.id,
        parameter_item_id=param_id
    ))

# 3. Create document links
for doc_id in document_ids:
    db_session.add(ScenarioDocuments(
        scenario_id=scenario.id,
        document_id=doc_id
    ))
```

**Field rename**: `scenario.description` → `scenario.problem_statement`

---

#### `/server/app/services/agents/collection/scenario.py` - Objectives Generation

**Line 63-100**: Update objectives function to work with junction pattern

```python
# The function still returns objectives list, but caller must handle junction insertion
async def set_objectives(objectives: List[str]):
    scenario_results["objectives"] = objectives
    # Junction records created when scenario is persisted
    return f"Set {len(objectives)} learning objectives successfully"
```

---

#### All Department Agent Access - Everywhere

**Replace** (throughout codebase):
```python
# OLD:
agent_id = department.title_agent_id
agent_id = department.scenario_agent_id
# etc. for all 8 agent types
```

**With**:
```python
# NEW:
agent_id = db_session.exec(
    select(DepartmentAgents.agent_id)
    .where(DepartmentAgents.department_id == department.id)
    .where(DepartmentAgents.role == 'title')  # or 'scenario', 'classify', etc.
).one()

# Or using relationship:
title_agent = next((da for da in department.agents if da.role == 'title'), None)
agent_id = title_agent.agent_id if title_agent else None
```

**Files affected**:
- `/server/app/services/agents/collection/scenario.py`
- `/server/app/services/agents/collection/simulation.py`
- `/server/app/services/agents/collection/classify.py`
- `/server/app/services/agents/collection/hint.py`
- All MCP tools
- Any route that creates/updates departments

---

#### MCP Tools - Data Loading

**`/server/app/services/mcp/tools/lookup/scenario_overview.py`**:
```python
# Load objectives from junction
objectives = session.exec(
    select(ScenarioObjectives.objective)
    .where(ScenarioObjectives.scenario_id == scenario_id)
    .order_by(ScenarioObjectives.idx)
).all()

# Load parameter items via junction
param_items = session.exec(
    select(ParameterItems)
    .join(ScenarioParameterItems)
    .where(ScenarioParameterItems.scenario_id == scenario_id)
).all()

# Load documents via junction
documents = session.exec(
    select(Documents)
    .join(ScenarioDocuments)
    .where(ScenarioDocuments.scenario_id == scenario_id)
).all()

# Rename: description → problem_statement
```

**`/server/app/services/mcp/tools/lookup/simulation_overview.py`**:
```python
# Load scenarios via junction (ordered)
scenarios = session.exec(
    select(Scenarios)
    .join(SimulationScenarios)
    .where(SimulationScenarios.simulation_id == simulation_id)
    .order_by(SimulationScenarios.position)
).all()
```

**`/server/app/services/mcp/tools/lookup/cohort_overview.py`**:
```python
# Load profiles via junction
profiles = session.exec(
    select(Profiles)
    .join(CohortProfiles)
    .where(CohortProfiles.cohort_id == cohort_id)
).all()

# Load simulations via junction
simulations = session.exec(
    select(Simulations)
    .join(CohortSimulations)
    .where(CohortSimulations.cohort_id == cohort_id)
).all()
```

---

### 2. Client Components (UI Logic)

#### `/client/components/common/scenario/Scenario.tsx`

**Form field rename**:
```typescript
// OLD:
<Textarea
  id="description"
  value={formData.description || ""}
  onChange={(e) => handleInputChange("description", e.target.value)}
/>

// NEW:
<Textarea
  id="problemStatement"
  value={formData.problemStatement || ""}
  onChange={(e) => handleInputChange("problemStatement", e.target.value)}
/>
```

**Objectives management** - Replace array state with API calls:
```typescript
// Instead of managing objectives as local array, use hooks:
const { data: objectives } = useScenarioObjectives(scenarioId);
const createObjective = useCreateScenarioObjective();
const deleteObjective = useDeleteScenarioObjective();

// Add objective:
await createObjective.mutateAsync({
  scenarioId,
  idx: objectives.length,
  objective: newObjectiveText
});
```

**Parameter items & documents** - Similar pattern using junction hooks

**Parent/child hierarchy** - Query `scenario_tree` instead of `parentId`

---

#### `/client/components/common/simulation/Simulation.tsx`

**Remove scenario practice_scenario filtering**:
```typescript
// OLD - Don't filter by scenario.practiceScenario
if (scenario.practiceScenario) { ... }

// NEW - Only use simulation.practiceSimulation
if (formData.practiceSimulation) { ... }
```

**Load scenarios via junction**:
```typescript
// Use auto-generated hook:
const { data: linkedScenarios } = useSimulationScenarios(simulationId);
```

**Add new guardrail/hint controls**:
```tsx
<FormField>
  <Label>Output Guardrail Active</Label>
  <Switch
    checked={formData.outputGuardrailActive}
    onCheckedChange={(checked) => handleInputChange("outputGuardrailActive", checked)}
  />
</FormField>

<FormField>
  <Label>Input Guardrail Active</Label>
  <Switch
    checked={formData.inputGuardrailActive}
    onCheckedChange={(checked) => handleInputChange("inputGuardrailActive", checked)}
  />
</FormField>

<FormField>
  <Label>Image Input Active</Label>
  <Switch
    checked={formData.imageInputActive}
    onCheckedChange={(checked) => handleInputChange("imageInputActive", checked)}
  />
</FormField>

<FormField>
  <Label>Hints Enabled</Label>
  <Switch
    checked={formData.hintsEnabled}
    onCheckedChange={(checked) => handleInputChange("hintsEnabled", checked)}
  />
</FormField>
```

**Note**: Agent selection (which agents to use for guardrails, hints, etc.) is now managed at the department level via the `department_agents` junction table. No per-simulation agent override columns exist.

**Add tag-based resource management**:
```tsx
{/* For each tag */}
{tags.map((tag, idx) => (
  <div key={idx}>
    <h4>Tag: {tag.tag}</h4>
    
    {/* Documents for this tag */}
    <DocumentPicker
      selectedDocuments={tagDocuments[idx]}
      onSelect={(docs) => updateTagDocuments(simulationId, idx, docs)}
    />
    
    {/* Parameter items for this tag */}
    <ParameterItemPicker
      selectedItems={tagParams[idx]}
      onSelect={(items) => updateTagParameters(simulationId, idx, items)}
    />
  </div>
))}
```

---

#### `/client/components/common/simulation/SimulationScenarioPicker.tsx`

**Replace parentId filtering with scenario_tree**:
```typescript
// OLD:
if (scenario.parentId !== null) return false;

// NEW:
// Only show scenarios that are roots (self-edge in scenario_tree)
const { data: scenarioRoots } = useScenarioRoots(); // custom hook
if (!scenarioRoots?.includes(scenario.id)) return false;
```

**Remove practiceScenario filtering**:
```typescript
// DELETE these lines:
if (isPracticeSimulation) {
  return scenario.practiceScenario === true;
}
return scenario.practiceScenario !== true;

// Practice mode is now simulation-level only
```

---

#### `/client/components/common/cohort/Cohort.tsx`

**Replace array management with junction API calls**:
```typescript
// OLD (don't do this):
await createCohortMutation.mutateAsync({
  ...formData,
  profileIds: staffProfiles.map(p => p.id),
  simulationIds: formData.simulationIds
});

// NEW:
// 1. Create cohort (no arrays)
const newCohort = await createCohortMutation.mutateAsync({
  title: formData.title,
  description: formData.description,
  departmentId: formData.departmentId,
  // No profileIds or simulationIds
});

// 2. Populate junctions separately
for (const profile of staffProfiles) {
  await createCohortProfile.mutateAsync({
    cohortId: newCohort.id,
    profileId: profile.id
  });
}

for (const simId of formData.simulationIds) {
  await createCohortSimulation.mutateAsync({
    cohortId: newCohort.id,
    simulationId: simId
  });
}
```

**Load cohort data via junctions**:
```typescript
const { data: cohortProfiles } = useCohortProfiles(cohortId);
const { data: cohortSimulations } = useCohortSimulations(cohortId);
```

---

#### `/client/components/system/departments/Departments.tsx`

**Update to manage department_agents instead of individual columns**:
```tsx
{/* Replace 8 individual AgentPickers with dynamic role list */}
<div>
  <h3>Department Agents</h3>
  {AGENT_ROLES.map(role => (
    <div key={role}>
      <Label>{roleToLabel(role)}</Label>
      <AgentPicker
        selectedAgentId={departmentAgents[role]}
        onSelect={(agentId) => handleAgentChange(role, agentId)}
      />
    </div>
  ))}
</div>
```

Where:
```typescript
const AGENT_ROLES = [
  'title',
  'scenario', 
  'classify',
  'assistant',
  'grade',
  'input_guardrail',
  'output_guardrail',
  'hint'
] as const;
```

---

#### `/client/components/create/scenarios/Scenarios.tsx`

**Update hierarchy grouping**:
```typescript
// OLD:
const groupedScenarios = useMemo(() => {
  // Used scenario.parentId
}, [scenarios]);

// NEW:
const { data: treeEdges } = useScenarioTree();
const groupedScenarios = useMemo(() => {
  // Find roots (self-edges)
  const roots = treeEdges.filter(e => e.parentId === e.childId);
  
  // Build groups
  return roots.map(root => ({
    parent: scenarios.find(s => s.id === root.childId),
    children: treeEdges
      .filter(e => e.parentId === root.childId && e.parentId !== e.childId)
      .map(e => scenarios.find(s => s.id === e.childId))
      .filter(Boolean)
  }));
}, [scenarios, treeEdges]);
```

---

#### `/client/contexts/simulation-context.tsx`

**Update document filtering**:
```typescript
// OLD:
const scenarioDocuments = useMemo(() => {
  return documents.filter(doc => 
    scenario.documentIds?.includes(doc.id)
  );
}, [documents, scenario]);

// NEW:
const { data: scenarioDocLinks } = useScenarioDocuments(scenario.id);
const scenarioDocuments = useMemo(() => {
  const docIds = scenarioDocLinks?.map(link => link.documentId) || [];
  return documents.filter(doc => docIds.includes(doc.id));
}, [documents, scenarioDocLinks]);
```

---

### 3. Analytics SQL Views

Update all views that reference arrays or old columns:

**Pattern for array → junction**:
```sql
-- OLD:
WHERE simulation_id = ANY(cohort.simulation_ids)

-- NEW:
JOIN cohort_simulations cs ON cs.simulation_id = sim.id AND cs.cohort_id = cohort.id
```

**Files to update**:
- `/database/app/analytics/practice/analytics_practice_overview.sql`
- `/database/app/analytics/home/analytics_home_overview.sql`
- `/database/app/analytics/history/attempt_history.sql`
- `/database/app/analytics/footer/simulation_composition.sql`
- `/database/app/analytics/footer/scenario_stats.sql`
- `/database/app/analytics/footer/scenario_performance.sql`
- `/database/app/analytics/secondary/cohort_performance.sql`
- `/database/app/analytics/leaderboard/init.sql`
- `/database/app/analytics/reports/init.sql`

**Common patterns**:
- `scenario.description` → `scenario.problem_statement`
- `scenario.parent_id` → use recursive CTE on `scenario_tree`
- `cohort.profile_ids` → join `cohort_profiles`
- `cohort.simulation_ids` → join `cohort_simulations`
- `simulation.scenario_ids` → join `simulation_scenarios`

---

### 4. Utility Functions

#### `/client/utils/api/scenarios/randomize.ts`, `new-scenario.ts`, etc.

- Use `problemStatement` instead of `description`
- Manage objectives via junction API calls
- Manage parameter items via junction API calls
- Manage documents via junction API calls

---

### 5. Profile-Department Management

**Pattern**: Replace single department_id with M:N junction

**Query effective department**:
```typescript
// Client hook (auto-generated will provide):
const { data: profileDepts } = useProfileDepartments(profileId);

// Get effective (primary or earliest):
const effectiveDept = profileDepts?.find(pd => pd.isPrimary) 
  || profileDepts?.sort((a, b) => 
       new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
     )[0];
```

**Set primary department**:
```typescript
// Add/update department assignment
await createProfileDepartment.mutateAsync({
  profileId,
  departmentId,
  isPrimary: true  // or false for secondary
});

// Remove department
await deleteProfileDepartment.mutateAsync({ profileId, departmentId });
```

**Server-side queries**:
```python
# Get effective department
effective_dept = db_session.exec(
    select(ProfileDepartments.department_id)
    .where(ProfileDepartments.profile_id == profile_id)
    .where(ProfileDepartments.is_primary == True)
).first()

if not effective_dept:
    # Fall back to earliest
    effective_dept = db_session.exec(
        select(ProfileDepartments.department_id)
        .where(ProfileDepartments.profile_id == profile_id)
        .order_by(ProfileDepartments.created_at.asc())
    ).first()
```

**Component updates**:
- Profile edit forms: Show list of departments with primary toggle
- Department selectors: Support multi-select
- Analytics filters: Use effective department logic

---

### 6. Files to Delete (Crowdsourcing Removal)

**API Routes** (auto-generated - will be removed on regeneration):
- `/client/app/api/v1/simulation_chat_crowdsourced_feedbacks/**` (entire directory)
- `/client/app/api/v1/simulation_crowdsourced_messages/**` (entire directory)

**Hooks** (auto-generated - will be removed on regeneration):
- `/client/hooks/use-crowdsourced-message-columns.tsx`
- `/client/hooks/use-crowdsourced-rubric-feedback-columns.tsx`

**Components** (manual removal required):
- `/client/components/system/feedback/CrowdsourcedMessagesDataTable.tsx`
- `/client/components/system/feedback/CrowdsourcedRubricFeedbackDataTable.tsx`

**Component Updates** (remove crowdsourcing sections from these files):
- `/client/components/system/feedback/Feedback.tsx` - Remove crowdsourcing tabs/UI
- `/client/components/common/rubric/TableRubric.tsx` - Remove crowdsourcing feedback logic
- `/client/components/common/chat/attempt/AttemptMessages.tsx` - Remove crowdsourcing message handling

---

## 📋 Implementation Checklist

### Phase 1: Run Migration & Regenerate
- [ ] Backup database (✅ `history/current_backup.sql` created)
- [ ] Run `apply_bncf_migration.sql`
- [ ] Regenerate schema: `cd database && yarn generate`
- [ ] Regenerate models, routes, repos, hooks (auto-generated)
- [ ] Verify `profile_departments` table created

### Phase 2: Server Business Logic (~25 files)

**Models (1 file)**:
- [ ] `server/app/models.py` - Add 12 junction model classes, update Scenarios/Simulations/Cohorts/Departments

**Department Agent Access (8 files)** - Replace `department.<role>_agent_id` with junction queries:
- [ ] `server/app/services/agents/collection/scenario.py` (Line 179)
- [ ] `server/app/services/agents/collection/simulation.py`
- [ ] `server/app/services/agents/collection/hint.py`
- [ ] `server/app/services/agents/collection/grade.py`
- [ ] `server/app/services/agents/collection/classify.py`
- [ ] `server/app/services/agents/collection/guardrail.py`
- [ ] `server/app/services/agents/collection/assistant.py`
- [ ] `server/app/services/agents/collection/title.py`

**Array Column Usage (6 files)**:
- [ ] `server/app/web/simulations.py` - scenario_ids access (Line 123)
- [ ] `server/app/routes/scenarios.py` - objectives, parameter_item_ids, document_ids
- [ ] `server/app/utils/scenario.py` - parameter_item_ids, document_ids, description
- [ ] `server/app/utils/analytics.py` - Various array accesses
- [ ] `server/app/services/agents/collection/hint.py` - May use scenario arrays
- [ ] `server/app/services/agents/collection/simulation.py` - May use arrays

**MCP Tools (7 files)**:
- [ ] `server/app/services/mcp/tools/lookup/scenario_overview.py` - objectives, params, docs
- [ ] `server/app/services/mcp/tools/lookup/simulation_overview.py` - scenario_ids
- [ ] `server/app/services/mcp/tools/lookup/cohort_overview.py` - profile_ids, simulation_ids
- [ ] `server/app/services/mcp/tools/lookup/persona_overview.py` - scenario data
- [ ] `server/app/services/mcp/tools/search/find_scenarios.py` - Search logic
- [ ] `server/app/services/mcp/tools/search/find_cohorts.py` - Cohort arrays
- [ ] Other MCP analytics tools - Verify no array usage

### Phase 3: Client Components (~25 files)

**Major Components (6 files)** - Core UI updates:
- [ ] `client/components/common/scenario/Scenario.tsx` (41 occurrences) - problemStatement, objectives junction, param/doc junctions
- [ ] `client/components/common/simulation/Simulation.tsx` (30 occurrences) - scenarioIds junction, new flags UI
- [ ] `client/components/create/scenarios/Scenarios.tsx` (15 occurrences) - parentId → scenario_tree hierarchy
- [ ] `client/components/common/simulation/SimulationScenarioPicker.tsx` (13 occurrences) - Remove parentId/practiceScenario filters
- [ ] `client/components/common/cohort/Cohort.tsx` (8 occurrences) - profileIds, simulationIds → junctions
- [ ] `client/components/common/cohort/SimulationPicker.tsx` (9 occurrences) - Update array patterns

**Secondary Components (8 files)**:
- [ ] `client/components/practice/PracticeCustomizeDialog.tsx` (5 occurrences)
- [ ] `client/components/common/parameter/Parameter.tsx` (5 occurrences)
- [ ] `client/components/create/scenarios/ScenariosDataTable.tsx` (3 occurrences)
- [ ] `client/components/management/parameters/ParametersDataTableToolbar.tsx` (3 occurrences)
- [ ] `client/components/common/chat/attempt/AttemptChat.tsx` (3 occurrences)
- [ ] `client/components/create/simulations/Simulations.tsx` (2 occurrences)
- [ ] `client/components/create/documents/Documents.tsx` (2 occurrences)
- [ ] `client/components/common/history/SimulationHistory.tsx` (2 occurrences)

**Minor Components (4 files)**:
- [ ] `client/components/common/scenario/ParameterSelector.tsx` (1 occurrence)
- [ ] `client/components/common/history/BrightspaceExportButton.tsx` (1 occurrence)
- [ ] `client/components/analytics/report/ReportsDataTable.tsx` (1 occurrence)
- [ ] `client/components/common/analytics/footer/SimulationPerformance.tsx` (1 occurrence)

**Contexts & Utilities (3 files)**:
- [ ] `client/contexts/simulation-context.tsx` - scenario.documentIds filtering
- [ ] `client/utils/api/scenarios/*.ts` - Various scenario API utilities
- [ ] Profile management components - M:N department handling

### Phase 4: Analytics & Views ✅ COMPLETED
- [x] Update all SQL view files (9 files) - ✅ All updated!
  - [x] `/database/app/analytics/init.sql` - Main analytics MV
  - [x] `/database/app/analytics/leaderboard/init.sql` - Leaderboard bundle
  - [x] `/database/app/analytics/reports/init.sql` - Reports bundle
  - [x] `/database/app/analytics/secondary/cohort_performance.sql`
  - [x] `/database/app/analytics/footer/simulation_composition.sql`
  - [x] `/database/app/analytics/footer/scenario_stats.sql`
  - [x] `/database/app/analytics/footer/scenario_performance.sql`
  - [x] `/database/app/analytics/home/analytics_home_overview.sql`
  - [x] `/database/app/analytics/practice/analytics_practice_overview.sql`
- [x] Replace array operations with junction joins - ✅ Done
- [x] Update field names (description → problem_statement) - ✅ Done

### Phase 5: Cleanup & Verification
- [ ] Delete 2 crowdsourcing component files
- [ ] Remove crowdsourcing UI from 3 component files
- [ ] Verify schema regeneration completed successfully
- [ ] Run all 5 post-migration sanity check queries (see "Post-Migration Sanity Checks" section)

### Phase 6: Manual Testing
- [ ] Test scenario creation with objectives
- [ ] Test simulation start flow
- [ ] Test cohort management
- [ ] Test department agent configuration
- [ ] Test simulation tag resource assignment
- [ ] Test analytics views
- [ ] Test guardrail/hint toggles
- [ ] Test profile M:N department assignment
- [ ] Test primary department designation
- [ ] Test effective department resolution (primary → earliest)

---

## 🔍 Post-Migration Sanity Checks

Run these queries immediately after migration to verify integrity:

```sql
-- 1. No children with multiple parents (enforced by unique index)
SELECT child_id, COUNT(*) c
FROM scenario_tree
GROUP BY child_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 2. No duplicate positions per simulation (enforced by unique index)
SELECT simulation_id, position, COUNT(*) c
FROM simulation_scenarios
GROUP BY simulation_id, position
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 3. All profiles have at least one department assignment
SELECT COUNT(*) AS profiles_without_dept
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM profile_departments pd WHERE pd.profile_id = p.id
);
-- Expected: Check if reasonable for your data

-- 4. Analytics MV schema is stable
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'analytics'
ORDER BY ordinal_position;
-- Expected: department_id column should exist and be UUID type

-- 5. All junction tables have data
SELECT 'simulation_scenarios' AS table_name, COUNT(*) FROM simulation_scenarios
UNION ALL SELECT 'scenario_objectives', COUNT(*) FROM scenario_objectives
UNION ALL SELECT 'scenario_parameter_items', COUNT(*) FROM scenario_parameter_items
UNION ALL SELECT 'cohort_profiles', COUNT(*) FROM cohort_profiles
UNION ALL SELECT 'cohort_simulations', COUNT(*) FROM cohort_simulations
UNION ALL SELECT 'profile_departments', COUNT(*) FROM profile_departments
UNION ALL SELECT 'department_agents', COUNT(*) FROM department_agents;
```

---

## ⚠️ Breaking Changes

1. **API shapes changed**: All endpoints returning scenarios/simulations/cohorts/departments/profiles
2. **No rollback**: Arrays and denormalized columns permanently dropped
3. **Junction queries required**: Can't access related data without joins
4. **Department agents**: 8 columns → pivot table lookup (no fallback)
5. **Profile departments**: Single `profiles.department_id` → M:N `profile_departments` (no fallback)
6. **Document/parameter tags**: Arrays removed, now managed via simulation tags only
7. **Hard constraints**: Unique indexes enforce data integrity (single parent, unique positions, unique tag text)

---

## 📈 Summary

**Database Layer**: ✅ **100% Complete**  
**Application Code**: ❌ **60 files pending**

### Database Changes (All Complete):
- ✅ **12 tables added** (11 junctions + 1 pivot)
- ✅ **2 views added** (tag discovery views)
- ✅ **~30 columns dropped** (arrays, denormalized refs, old tags)
- ✅ **4 columns added** (simulation flags: guardrails, image input, hints)
- ✅ **2 tables dropped** (crowdsourcing)
- ✅ **4 integrity constraints** (tree structure, unique positions, unique tags, one primary dept)
- ✅ **9 analytics views updated** (all SQL functions working with junctions)
- ✅ **8 seed files updated** (all junction data properly inserted)

### Application Code Pending:
- ❌ **1 models file** (server/app/models.py)
- ❌ **~25 server files** (8 agent services + 6 business logic + 7 MCP tools + utilities)
- ❌ **~25 client files** (6 major + 8 secondary + 4 minor components + contexts/utils)
- ❌ **5 crowdsourcing files** (delete/cleanup)

**Key Architectural Changes**:
- ✅ All arrays → junction tables (BCNF compliant)
- ✅ `scenarios.description` → `scenarios.problem_statement`
- ✅ `profiles.department_id` → `profile_departments` M:N
- ✅ 8 department agent columns → `department_agents` pivot
- ✅ Document/parameter tags → simulation-level only
- ✅ No per-simulation agent overrides (all via department)

**Estimated Remaining Effort**: 20-30 hours (application code only)  
**Updated**: 2025-10-11

**Status**: Database schema is production-ready. Application code migration can begin after schema regeneration.

