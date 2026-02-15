# Permission Unification Plan — All Remaining Artifacts

## Agreed Business Logic (Reference)

| Rule | Description |
|------|-------------|
| **Same check for edit AND delete** | No active-vs-total distinction |
| **Immediate parent only** | One level up in the hierarchy |
| **Active link existence** | `active = true` junction rows = currently linked |
| **Default objects** | No departments = superadmin only for edit/delete |
| **Role gate** | admin / instructional / superadmin (varies by artifact) |

### Completed Artifacts (Phases 1-9)

| Entity | Edit blocked if | Delete blocked if | Status |
|--------|----------------|-------------------|--------|
| **Persona** | active scenario links > 0 | active scenario links > 0 | DONE |
| **Scenario** | active simulation links > 0 | active simulation links > 0 | DONE |
| **Simulation** | active cohort links > 0 | active cohort links > 0 | DONE (already unified) |
| **Cohort** | never (role + default guard only) | active profile links > 0 | DONE |

---

## Tier 1: Same Pattern as Persona/Scenario (Need Unification)

These artifacts have the SAME split problem we just fixed: `compute_can_edit` uses `active_*_count` but `compute_can_delete` uses `total_*_links`.

---

### 1. Document

**Current State:**
- `compute_can_edit(user_role, document_department_ids, active_scenario_count)` — blocks if active > 0
- `compute_can_delete(user_role, document_department_ids, total_scenario_links)` — blocks if total > 0
- **Default guard:** NO — `document_department_ids` is accepted but NEVER CHECKED in edit or delete

**Issues:**
1. Edit/delete use DIFFERENT checks (active vs total) — needs unification
2. Missing default object guard in edit/delete (only present in `compute_can_create`)
3. `document_department_ids` param is unused in both functions

**Hierarchy:** Scenario → Document (via `scenario_documents_junction`)

**Fix Plan:**
| File | Change |
|------|--------|
| `server/app/api/v4/artifacts/document/permissions.py` | Rename `total_scenario_links` → `active_scenario_count` in `compute_can_delete`. Add default guard (`if not document_department_ids and user_role != "superadmin": return False`) to both edit and delete |
| `server/app/api/v4/artifacts/document/list.py` | Pass `active_scenario_count` instead of `total_scenario_links` to `compute_can_delete` |
| `server/app/api/v4/artifacts/document/delete.py` | Pass `active_scenario_count` instead of `total_scenario_links` |
| `server/app/sql/v4/queries/documents/get_documents_list_complete.sql` | Remove `total_scenario_links` from composite type and data CTE. Keep only `active_scenario_count` |
| `server/app/sql/v4/queries/documents/check_document_delete_access_complete.sql` | Rename return field to `active_scenario_count`, add `WHERE sd.active = true` filter |
| `server/app/sql/v4/queries/documents/get_document_access_complete.sql` | Remove `total_scenario_links` from return type, keep only `active_scenario_count` |

**Decision needed:** Should documents have the default object guard? Currently they don't check departments in edit/delete at all. The `compute_can_create` does block non-superadmins from creating general documents.

---

### 2. Parameter

**Current State:**
- `compute_can_edit(user_role, parameter_department_ids, active_scenario_count)` — blocks if active > 0
- `compute_can_delete(user_role, parameter_department_ids, total_scenario_links)` — blocks if total > 0
- **Default guard:** YES — both check `if not parameter_department_ids and user_role != "superadmin"`

**Issues:**
1. Edit/delete use DIFFERENT checks (active vs total) — needs unification
2. Delete access SQL uses a DIFFERENT join path than list SQL (field-level junction vs denormalized array)
3. Type hint mismatch: delete uses `list[str] | None`, edit uses `list[str] | list[UUID] | None`

**Hierarchy:** Scenario → Parameter (via `scenarios_resource.parameter_ids` denormalized)

**Fix Plan:**
| File | Change |
|------|--------|
| `server/app/api/v4/artifacts/parameter/permissions.py` | Rename `total_scenario_links` → `active_scenario_count` in `compute_can_delete`. Fix type hint to `list[str] \| list[UUID] \| None` |
| `server/app/api/v4/artifacts/parameter/list.py` | Pass `active_scenario_count` instead of `total_scenario_links` |
| `server/app/api/v4/artifacts/parameter/delete.py` | Pass `active_scenario_count` instead of `total_scenario_links` |
| `server/app/sql/v4/queries/parameters/get_parameters_list_complete.sql` | Remove `total_scenario_links` / `parameter_all_scenario_links` CTE. Keep only `active_scenario_count` |
| `server/app/sql/v4/queries/parameters/check_parameter_delete_access_complete.sql` | Rename to `active_scenario_count`, add active filter |

---

### 3. Rubric

**Current State:**
- `compute_can_edit(user_role, rubric_department_ids, active_simulation_count)` — blocks if active > 0
- `compute_can_delete(user_role, rubric_department_ids, total_simulation_links)` — blocks if total > 0
- **Default guard:** YES — both check `if not rubric_department_ids and user_role != "superadmin"`

**Issues:**
1. Edit/delete use DIFFERENT checks (active vs total) — needs unification
2. Type hint mismatch in delete: `list[str] | None` vs `list[str] | list[UUID] | None`

**Hierarchy:** Simulation → Rubric (via `scenario_rubrics_resource` → `simulation_scenarios_junction`)

**Fix Plan:**
| File | Change |
|------|--------|
| `server/app/api/v4/artifacts/rubric/permissions.py` | Rename `total_simulation_links` → `active_simulation_count` in `compute_can_delete`. Fix type hint |
| `server/app/api/v4/artifacts/rubric/list.py` | Pass `active_simulation_count` instead of `total_simulation_links` |
| `server/app/api/v4/artifacts/rubric/delete.py` | Pass `active_simulation_count` instead of `total_simulation_links` |
| `server/app/sql/v4/queries/rubric/get_rubrics_list_complete.sql` | Remove `total_simulation_links` / `rubric_all_simulation_links` CTE. Keep only `active_simulation_count` |
| `server/app/sql/v4/queries/rubrics/check_rubric_delete_access_complete.sql` | Rename to `active_simulation_count`, add active filter |

---

## Tier 2: Different Pattern (Usage-Based, Not Parent-Link-Based)

These artifacts use a different permission model. Their "blocked by" is not parent-entity links but rather direct usage counts. The question is: should they also filter by `active = true`?

---

### 4. Profile

**Current State:**
- `compute_can_edit(user_role, target_is_self)` — role check + self-edit allowed
- `compute_can_delete(user_role, total_cohort_links)` — blocks if linked to cohorts
- **Default guard:** NO — profiles don't have departments in the same way
- Delete SQL: `delete_profile_complete.sql` does unconditional delete (no usage check in SQL)

**Issues:**
1. `total_cohort_links` should probably be `active_cohort_links` (count only `active = true` in `profile_cohorts_junction`)
2. Profile is fundamentally different — it's a user entity, not a content entity
3. No `compute_can_edit` usage guard (edit is always allowed for right role)

**Hierarchy:** Cohort → Profile (via `profile_cohorts_junction`)

**Fix Plan:**
| File | Change |
|------|--------|
| `server/app/api/v4/artifacts/profile/permissions.py` | Rename `total_cohort_links` → `active_cohort_count`. Update docstring |
| `server/app/api/v4/artifacts/profile/list.py` | Pass `active_cohort_count` instead of `total_cohort_links` |
| SQL (list) | Verify the cohort count filters by `active = true` |

**Decision needed:** Does profile need the default object guard? Profiles are user accounts, not content objects. The concept of "default profile with no departments" doesn't map cleanly.

---

### 5. Model

**Current State:**
- `compute_can_edit(user_role, model_department_ids, active_persona_count)` — blocks if active personas > 0
- `compute_can_delete(user_role, model_department_ids, total_persona_links, agents_usage_count)` — blocks if ANY persona links > 0 OR agent usage > 0
- **Default guard:** YES — both check departments

**Issues:**
1. Edit checks `active_persona_count` but delete checks `total_persona_links` — needs unification
2. Delete has an EXTRA check (`agents_usage_count`) not present in edit
3. In `list.py`, `active_persona_count=0` is hardcoded (not from SQL!) — the edit check is effectively bypassed

**Hierarchy:** Provider → Model; Persona → Model (usage)

**Fix Plan:**
| File | Change |
|------|--------|
| `server/app/api/v4/artifacts/model/permissions.py` | Rename `total_persona_links` → `active_persona_count` in `compute_can_delete`. Consider: should `agents_usage_count` also filter active-only? |
| `server/app/api/v4/artifacts/model/list.py` | Wire up `active_persona_count` from SQL (currently hardcoded to 0!) |
| `server/app/api/v4/artifacts/model/delete.py` | Pass `active_persona_count` instead of `total_persona_links` |
| SQL files | Add active filter to persona link count, possibly add persona count to list query |

**Decision needed:** Should the agent usage check also be unified (active agents only)? Should edit also block on agent usage?

---

### 6. Provider

**Current State:**
- `compute_can_edit(user_role, provider_department_ids, model_usage_count)` — `model_usage_count` is accepted but NOT USED
- `compute_can_delete(user_role, provider_department_ids, model_usage_count)` — blocks if model_usage > 0
- **Default guard:** YES — both check departments
- Role gate: admin, superadmin only (NOT instructional)

**Issues:**
1. `model_usage_count` is accepted in edit but completely ignored — misleading API
2. Edit and delete are already effectively "unified" (edit doesn't check usage, delete does)
3. This matches the Cohort pattern (edit = role only, delete = usage guard)

**Fix Plan:**
| File | Change |
|------|--------|
| `server/app/api/v4/artifacts/provider/permissions.py` | Remove unused `model_usage_count` param from `compute_can_edit` to avoid confusion. Verify `model_usage_count` counts active-only |
| `server/app/api/v4/artifacts/provider/list.py` | Remove `model_usage_count` from edit call if param is removed |
| SQL files | Verify model count filters by `active = true` |

**Decision needed:** Should edit also block on model usage? Or is the Cohort-like pattern (edit=role, delete=usage) intentional for providers?

---

## Tier 3: No Parent-Link Permission Pattern

These artifacts either don't have parent-link-based permissions or use fundamentally different patterns.

---

### 7. Department

**Current State:**
- `compute_can_edit(user_role, usage_count)` — blocks if usage > 0 (unless superadmin)
- `compute_can_delete(user_role, total_usage)` — blocks if total_usage > 0
- **Default guard:** N/A — departments ARE the scoping mechanism

**Issues:**
1. Different param names (`usage_count` vs `total_usage`) but likely same semantics
2. Department is a ROOT entity — no parent to check against
3. Should verify both count active usage only

**Fix Plan:**
| File | Change |
|------|--------|
| `server/app/api/v4/artifacts/department/permissions.py` | Unify param names. Verify active-only counting |
| SQL files | Verify usage counts filter by `active = true` |

---

### 8. Field

**Current State:**
- `compute_can_edit(user_role, field_department_ids)` — role + default guard only (no usage check)
- `compute_can_delete(user_role, field_department_ids, total_parameter_links)` — blocks if parameter links > 0
- **Default guard:** YES
- Role gate: admin, superadmin only (NOT instructional)

**Issues:**
1. Edit has NO usage guard but delete does — this matches the Cohort/Provider pattern
2. Should verify `total_parameter_links` counts active-only

**Fix Plan:**
| File | Change |
|------|--------|
| `server/app/api/v4/artifacts/field/permissions.py` | Rename `total_parameter_links` → `active_parameter_count`. Verify active-only |
| SQL files | Add `WHERE active = true` to parameter link count if missing |

---

### 9. Tool

**Current State:**
- `compute_can_edit(user_role, active_usage_count)` — blocks if active usage > 0
- `compute_can_delete(user_role, usage_count)` — blocks if ANY usage > 0
- **Default guard:** NO (tools are global, no departments)

**Issues:**
1. Edit uses `active_usage_count` but delete uses `usage_count` (all) — needs unification
2. Tools have no departments — default guard doesn't apply

**Fix Plan:**
| File | Change |
|------|--------|
| `server/app/api/v4/artifacts/tool/permissions.py` | Rename `usage_count` → `active_usage_count` in `compute_can_delete` |
| SQL files | Verify/add active filter in delete usage count |

---

### 10. Agent

**Current State:**
- `compute_can_edit(user_role, has_agent_access, missing_tools, agent_id)` — complex multi-factor check
- `compute_list_can_edit(user_role, agent_department_ids)` — role + dept check only (list view)
- `compute_can_delete(user_role, usage_count)` — blocks if usage > 0
- **Default guard:** Implicit via department check
- Role gate: admin, superadmin (NOT instructional)

**Issues:**
1. Agent has TWO different edit functions (get vs list)
2. Delete uses `usage_count` — should be `active_usage_count`
3. Agent is fundamentally more complex due to missing_tools validation

**Fix Plan:**
| File | Change |
|------|--------|
| `server/app/api/v4/artifacts/agent/permissions.py` | Rename `usage_count` → `active_usage_count` in `compute_can_delete`. Add explicit default guard |
| SQL files | Verify/add active filter in delete usage count |

---

## Tier 4: No Edit/Delete Permissions Needed

These artifacts don't follow the standard edit/delete permission pattern.

---

### 11. Eval

**Current State:** Has permissions.py with `compute_can_edit`, `compute_can_delete`, default guard, department check. Uses `active_eval_count` for edit. Delete blocks on usage.

**Assessment:** Eval is relatively new and may already follow the correct pattern. Needs verification of active-only counting.

### 12. Auth

**Current State:** Auth is a read-only configuration entity. The `get_auth_list` endpoint doesn't compute edit/delete permissions — it just returns auth provider data.

**Assessment:** NO CHANGES NEEDED — auth is not a CRUD artifact.

### 13. Setting

**Current State:** Settings has permissions.py but settings are singleton config objects — they're always editable by the right role and never deleted.

**Assessment:** NO CHANGES NEEDED — settings don't have parent-link blocking.

### 14. Simulation

**Assessment:** ALREADY DONE — both `compute_can_edit` and `compute_can_delete` use `cohort_usage_count`. Verified unified.

---

## Execution Order (Recommended)

### Phase A: Direct Copies of Persona/Scenario Fix (Tier 1)
These are the easiest — exact same pattern as what we just did.

1. **Document** — rename `total_scenario_links` → `active_scenario_count`, add default guard
2. **Parameter** — rename `total_scenario_links` → `active_scenario_count`
3. **Rubric** — rename `total_simulation_links` → `active_simulation_count`

### Phase B: Usage-Count Unification (Tier 2)
4. **Profile** — rename `total_cohort_links` → `active_cohort_count`
5. **Model** — rename `total_persona_links` → `active_persona_count`, fix hardcoded 0
6. **Provider** — clean up unused param, verify active counting

### Phase C: Global/Root Entities (Tier 3)
7. **Tool** — rename `usage_count` → `active_usage_count` in delete
8. **Agent** — rename `usage_count` → `active_usage_count` in delete
9. **Field** — rename `total_parameter_links` → `active_parameter_count`
10. **Department** — unify param names, verify active counting

### Phase D: Verify Only
11. **Eval** — verify active-only counting
12. **Auth** — no changes
13. **Setting** — no changes

---

## Decisions Needed From You

1. **Document default guard:** Should documents block edit/delete for non-superadmins when they have no departments? (Currently they don't check this)

2. **Model agent usage in edit:** Should `compute_can_edit` for models also block when agents reference the model? (Currently only delete checks this)

3. **Provider edit usage:** Should provider edit block on model usage? Or keep the Cohort-like pattern (edit=role only)?

4. **Role consistency:** Some artifacts allow `instructional` role (persona, scenario, simulation, cohort, document, parameter, tool) while others don't (field, agent, model, provider, rubric). Should this be unified?

5. **Subagents for implementation:** Yes, subagents would work well for Phase A (Document, Parameter, Rubric) since they follow the exact same mechanical pattern. Each can be a parallel subagent. Phases B-C need more judgment calls.
