# Plan: Standardize List Filters to 3 `ListFilterSection` per Endpoint

## Goal
Convert documents, profiles/staff, parameters, and fields to use the clean `ListFilterSection.from_sql_options()` pattern (matching scenarios/cohorts/simulations), with 3 filter sections each.

## Target Filters

| Endpoint | Filter 1 | Filter 2 | Filter 3 |
|----------|----------|----------|----------|
| Documents | scenario_filter | field_filter | department_filter |
| Profiles/Staff | cohort_filter | department_filter | role_filter |
| Parameters | scenario_filter | **field_filter** (NEW) | department_filter |
| Fields | parameter_filter | persona_filter | department_filter |

## Per-Endpoint Changes (4 layers each: SQL -> types -> list.py -> client)

---

### 1. Documents (scenario, field, department) — simplest, already has all params

**SQL** (`get_documents_list_complete.sql`):
- Replace `q_list_documents_v4_option_id (id, count)` with `q_list_documents_v4_option (value text, label text, count bigint)`
- Join to name tables in SQL: scenario -> `scenario_scenarios_junction` + `names_resource`, field -> `field_fields_junction` + `names_resource`, department -> `department_departments_junction` + `names_resource`
- Return `scenario_options`, `field_options`, `department_options` instead of `*_option_ids`

**Types** (`document/types.py`):
- SQL row: `scenario_option_ids` -> `scenario_options: list[dict] | None` (same for field/department)
- Response: Replace `scenarios: list[ListDocumentApiScenario]`, `fields: list[ListDocumentApiField]`, `departments: list[ListDocumentApiDepartment]` with `scenario_filter: ListFilterSection | None`, `field_filter: ListFilterSection | None`, `department_filter: ListFilterSection | None`
- Remove `ListDocumentApiScenario`, `ListDocumentApiField`, `ListDocumentApiDepartment` types

**list.py** (`document/list.py`):
- Remove scenario/field/department Python-side name hydration (`fetch_scenarios()`, `fetch_fields()`, `fetch_departments()` and the manual list comprehensions)
- Replace with `ListFilterSection.from_sql_options(result.scenario_options, request.scenario_ids, request.scenario_search)` (x3)

**Client**: Update to use `documentsData?.scenario_filter?.options` pattern

---

### 2. Profiles/Staff (cohort, department, role)

**SQL** (`get_staff_list_complete.sql`):
- Replace `q_list_staff_v4_option_id` with `q_list_staff_v4_option (value text, label text, count bigint)`
- Join cohort -> `cohort_cohorts_junction` + `names_resource`, department -> `department_departments_junction` + `names_resource`
- Convert `role_options text[]` to `role_options q_list_staff_v4_option[]` with role counts from filtered staff
- Add `role_search text` parameter

**Types** (`profile/types.py`):
- SQL params: Add `role_search: str | None = None`
- SQL row: `cohort_option_ids` -> `cohort_options: list[dict]`, `department_option_ids` -> `department_options: list[dict]`, `role_options: list[str]` -> `role_options: list[dict]`
- Request: Add `role_search: str | None = None`
- Response: Replace `cohorts`, `departments`, `role_options` with `cohort_filter`, `department_filter`, `role_filter` (all `ListFilterSection | None`)
- Remove `ListStaffApiCohort`, `ListStaffApiDepartment` types

**list.py** (`profile/list.py`):
- Remove Python-side hydration for cohorts/departments
- Use `ListFilterSection.from_sql_options()` for all 3

**Client**: Update to use filter sections

---

### 3. Parameters (scenario, field <- NEW, department)

**SQL** (`get_parameters_list_complete.sql`):
- Replace `q_list_parameters_v4_option_id` with `q_list_parameters_v4_option (value, label, count)`
- Join names in SQL for scenario + department options
- **Add field_options**: Parameters link to fields via `parameter_parameter_fields_junction` -> `parameter_fields_resource` -> `fields_resource`. Build field options with counts.
- Add `field_ids uuid[]` and `field_search text` parameters
- Add field-based filtering to the WHERE clause

**Types** (`parameter/types.py`):
- SQL params: Add `field_ids: list[UUID] | None`, `field_search: str | None`
- SQL row: Add `field_options: list[dict] | None`, rename existing to `scenario_options`, `department_options`
- Request: Add `field_ids`, `field_search`
- Response: Replace `scenarios`, `departments` with `scenario_filter`, `field_filter`, `department_filter`
- Remove `ListParameterApiScenario`, `ListParameterApiDepartment` types

**list.py** (`parameter/list.py`):
- Remove Python-side hydration
- Use `ListFilterSection.from_sql_options()` for all 3

**Client**: Update to use filter sections, add field filter UI

---

### 4. Fields (parameter, persona, department) — most work, adding params from scratch

**SQL** (`get_fields_list_complete.sql`):
- Replace `q_list_fields_v4_option_id` with `q_list_fields_v4_option (value, label, count)`
- Join names in SQL for parameter/persona/department options
- Add params: `search text`, `parameter_ids uuid[]`, `persona_ids uuid[]`, `filter_department_ids uuid[]`, `parameter_search text`, `persona_search text`, `department_search text`, `page_size int`, `page_offset int`
- Add WHERE clauses for all filters + pagination

**Types** (`field/types.py`):
- SQL params: Add all new params with `to_tuple()`
- Request: Add all filter/search/pagination params (currently empty `pass`)
- SQL row: Rename `*_option_ids` to `*_options: list[dict]`
- Response: Replace `conditional_parameters`, `personas`, `departments` with `parameter_filter`, `persona_filter`, `department_filter`
- Remove `ListFieldApiConditionalParameter`, `ListFieldApiPersona`, `ListFieldApiDepartment` types

**list.py** (`field/list.py`):
- Forward request params to SQL
- Remove Python-side hydration
- Use `ListFilterSection.from_sql_options()` for all 3

**Client**: Update to use filter sections, add search/filter UI

---

## Execution Order

1. **Documents** (simplest — already has all params, just restructure)
2. **Profiles/Staff** (role conversion is unique but contained)
3. **Parameters** (need to add field filter — moderate SQL work)
4. **Fields** (most work — adding all params + pagination from scratch)

## After Each Endpoint

```bash
make sql-compile     # Regenerate types.py from SQL
make openapi-gen     # Regenerate OpenAPI spec
make gen-client-types # Regenerate TypeScript types
# Update client component
make format && make lint
```
