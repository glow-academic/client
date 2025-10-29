# Multi-Tenancy Refactoring - Batched Implementation Plan

## Status Overview

### ✅ Completed
- **Phase 1.1 - Pydantic Schemas**: All 9 schema files updated
  - Removed all `default_*` boolean fields
  - Changed `department_id: str` → `department_ids: list[str] | None`
  - Files: `personas.py`, `cohorts.py`, `scenarios.py`, `simulations.py`, `rubrics.py`, `parameters.py`, `agents.py`, `documents.py`, `departments.py`

### 🔄 Partially Completed
- **Phase 1.2 - Query Builders**: Started `persona_queries.py` (1 of 12 files)
  - Updated `list_personas` query with junction table pattern
  - 11 query files remaining

### ⏳ Remaining Work
- Complete server query layer (11 files)
- Server service layer (9 files)
- Client TypeScript schemas (11 files)
- Client components (many files)
- Client API routes (many files)
- Testing and validation

---

## Batch A: Server Query Layer (Complete)

**Estimated Time**: 4-6 hours  
**Complexity**: High (SQL refactoring)  
**Dependencies**: None (schemas already updated)  
**Testing**: Can test queries in isolation with psql

### Files to Modify (11 files)

1. `server/app/queries/persona_queries.py` (partially done - needs completion)
2. `server/app/queries/cohort_queries.py`
3. `server/app/queries/scenario_queries.py`
4. `server/app/queries/simulation_queries.py`
5. `server/app/queries/rubric_queries.py`
6. `server/app/queries/parameter_queries.py`
7. `server/app/queries/agent_queries.py`
8. `server/app/queries/document_queries.py`
9. `server/app/queries/department_queries.py`
10. `server/app/queries/dashboard_queries.py`
11. `server/app/queries/base_queries.py` (AnalyticsQueryBuilder only)

### Core Patterns

#### Pattern 1: List Queries - Replace Direct department_id Filter

**BEFORE:**
```sql
FROM personas p
WHERE p.department_id = ANY($1)
```

**AFTER:**
```sql
FROM personas p
LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
GROUP BY p.id, [other non-aggregated columns]
HAVING 
    -- Include if has matching department link OR has no department links at all (cross-dept)
    COUNT(pd.persona_id) FILTER (WHERE pd.department_id = ANY($1)) > 0
    OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)
```

**Alternative simpler pattern (may be less performant):**
```sql
FROM personas p
LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true AND pd.department_id = ANY($1)
WHERE 
    pd.persona_id IS NOT NULL  -- Has matching department link
    OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id AND pd2.active = true)  -- Or no links (cross-dept)
```

#### Pattern 2: Remove default_* from SELECT and ORDER BY

**BEFORE:**
```sql
SELECT 
    p.default_persona,
    ...
FROM personas p
ORDER BY p.default_persona DESC, p.created_at DESC
```

**AFTER:**
```sql
SELECT 
    -- Remove default_persona from SELECT
    ...
FROM personas p
ORDER BY p.created_at DESC  -- Remove default_persona from ORDER BY
```

#### Pattern 3: Update Permission Logic - Replace default_* Checks

**BEFORE:**
```sql
CASE 
    WHEN p.default_persona = true AND up.role != 'superadmin' THEN false
    WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
    ELSE false
END as can_edit
```

**AFTER:**
```sql
CASE 
    WHEN NOT EXISTS (SELECT 1 FROM persona_departments pd WHERE pd.persona_id = p.id AND pd.active = true)
         AND up.role != 'superadmin' THEN false  -- Cross-dept entities require superadmin
    WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
    ELSE false
END as can_edit
```

**Or if you computed a flag in CTE:**
```sql
-- In CTE:
CASE WHEN COUNT(pd.persona_id) > 0 THEN true ELSE false END as has_dept_links

-- In permission logic:
CASE 
    WHEN NOT has_dept_links AND up.role != 'superadmin' THEN false
    WHEN up.role IN ('admin', 'instructional', 'superadmin') THEN true
    ELSE false
END as can_edit
```

#### Pattern 4: Detail Queries - Fetch department_ids Array

**Add to detail query response:**
```sql
WITH entity_departments AS (
    SELECT 
        pd.persona_id,
        ARRAY_AGG(pd.department_id::text ORDER BY pd.created_at) as department_ids
    FROM persona_departments pd
    WHERE pd.persona_id = $1 AND pd.active = true
    GROUP BY pd.persona_id
)
SELECT 
    p.*,
    COALESCE(ed.department_ids, NULL) as department_ids  -- NULL if no links (cross-dept)
FROM personas p
LEFT JOIN entity_departments ed ON ed.persona_id = p.id
WHERE p.id = $1
```

### Implementation Steps for Each File

#### Step 1: Find All department_id Filter Patterns
```bash
# Search for direct department_id usage
grep -n "department_id = ANY" server/app/queries/[filename].py
grep -n "\.department_id" server/app/queries/[filename].py
```

#### Step 2: Find All default_* References
```bash
# Search for default_* fields
grep -n "default_persona\|default_cohort\|default_scenario\|default_simulation\|default_rubric\|default_parameter\|default_agent\|default_department" server/app/queries/[filename].py
```

#### Step 3: Apply Patterns Systematically

For each query method:

1. **List queries**: Apply Pattern 1 + Pattern 2 + Pattern 3
2. **Detail queries**: Apply Pattern 4 + Pattern 2
3. **"Get default" queries**: Remove ORDER BY default_* DESC (Pattern 2)
4. **Mapping queries**: Apply Pattern 1 if filtering by department

### Specific File Instructions

#### `persona_queries.py` (Finish what was started)
- ✅ `list_personas` - Already updated
- ⏳ `get_persona_detail_complete` - Lines 435-523
  - Add CTE to fetch department_ids array
  - Remove `default_persona` from SELECT
- ⏳ `get_persona_detail_default_complete` - Lines 525-627
  - Remove `ORDER BY p.default_persona DESC` (line 550)
  - Change to `ORDER BY p.created_at DESC`
- ⏳ `get_valid_personas_for_departments` - If exists
  - Apply Pattern 1

#### `cohort_queries.py`
- `list_cohorts` method
  - Replace `WHERE c.department_id = ANY($1)` with junction table LEFT JOIN
  - Remove `c.default_cohort` from SELECT (appears around line 40-60)
  - Update permission logic to check for cross-dept cohorts
- `get_cohort_detail_complete` method
  - Add CTE to fetch department_ids array
  - Remove `default_cohort` from SELECT and response

#### `scenario_queries.py`
- `list_scenarios` method
  - Replace `WHERE s.department_id = ANY($1)` with `scenario_departments` junction
  - Remove `s.default_scenario` from SELECT
- `get_scenario_detail_complete` method
  - Add department_ids array fetch
  - Remove `default_scenario` field
- `get_valid_personas_for_departments` (line ~1253)
  - Replace `WHERE department_id = ANY($1)` with junction table pattern for personas
- `get_valid_documents_for_departments` (line ~1265)
  - Replace `WHERE department_id = ANY($1)` with junction table pattern for documents

#### `simulation_queries.py`
- `list_simulations` method
  - Replace `WHERE s.department_id = ANY($1)` with `simulation_departments` junction
  - Remove `s.default_simulation` from SELECT
- `get_simulation_detail_complete` method
  - Add department_ids array fetch
  - Remove `default_simulation` field

#### `rubric_queries.py`
- `list_rubrics` method
  - Replace `WHERE r.department_id = ANY($1)` with `rubric_departments` junction
  - Remove `r.default_rubric` from SELECT
- `get_rubric_detail_complete` method
  - Add department_ids array fetch
  - Remove `default_rubric` field

#### `parameter_queries.py`
- `list_parameters` method
  - Replace `WHERE p.department_id = ANY($1)` with `parameter_departments` junction
  - Remove `p.default_parameter` from SELECT
- `get_parameter_detail_complete` method
  - Add department_ids array fetch
  - Remove `default_parameter` field

#### `agent_queries.py`
- `list_agents` method
  - Replace `WHERE a.department_id = ANY($1)` with `agent_departments` junction
  - Remove `a.default_agent` from SELECT
- `get_agent_detail_complete` method
  - Remove `default_agent` field (agents don't have department links now, they link via agent_departments to departments)

#### `document_queries.py`
- `list_documents` method
  - Replace `WHERE d.department_id = ANY($1)` with `document_departments` junction
- `get_document_detail_complete` method
  - Add department_ids array fetch

#### `department_queries.py`
- `get_departments_list` method
  - Remove `d.default_department` from SELECT
- `get_department_detail_complete` method
  - Remove `default_department` from SELECT

#### `dashboard_queries.py` & `base_queries.py`
- Look for analytics mapping methods that filter by department_id
- Apply Pattern 1 where needed
- Most analytics queries should already work via the updated materialized view

### Verification Steps

After completing each file:

1. **Syntax Check**: 
   ```bash
   cd server
   python -c "from app.queries.[module] import *"
   ```

2. **Type Check**:
   ```bash
   cd server
   make typecheck
   ```

3. **Test Query in psql** (example for personas):
   ```sql
   -- Test that cross-dept personas (no junction records) are returned
   SELECT p.id, p.name, 
          (SELECT COUNT(*) FROM persona_departments pd WHERE pd.persona_id = p.id) as dept_link_count
   FROM personas p
   LEFT JOIN persona_departments pd ON pd.persona_id = p.id AND pd.active = true
   WHERE pd.department_id = ANY(ARRAY['dept-uuid-1']::uuid[])
      OR NOT EXISTS (SELECT 1 FROM persona_departments pd2 WHERE pd2.persona_id = p.id);
   ```

4. **Expected Results**:
   - Personas with matching department links should appear
   - Personas with NO department links (cross-dept) should appear
   - Personas with ONLY other department links should NOT appear

### Common Pitfalls

1. **GROUP BY Issues**: When adding LEFT JOIN, ensure all non-aggregated columns are in GROUP BY
2. **NULL vs Empty Array**: `department_ids = NULL` means cross-dept, `[]` should not happen
3. **Junction Table Names**: 
   - `persona_departments`, `cohort_departments`, `scenario_departments`, etc.
   - NOT `personas_departments` (no extra 's')
4. **Active Flag**: Always filter `pd.active = true` in junction table joins

---

## Batch B: Server Service Layer

**Estimated Time**: 6-8 hours  
**Complexity**: High (business logic + database transactions)  
**Dependencies**: Batch A must be complete  
**Testing**: Service layer tests should pass

### Files to Modify (9 files + 1 agent file)

1. `server/app/services/persona_service.py`
2. `server/app/services/cohort_service.py`
3. `server/app/services/scenario_service.py`
4. `server/app/services/simulation_service.py`
5. `server/app/services/rubric_service.py`
6. `server/app/services/parameter_service.py`
7. `server/app/services/agent_service.py`
8. `server/app/services/document_service.py`
9. `server/app/services/department_service.py`
10. `server/app/agents/collection/collection.py` (agent role handling)

### Core Patterns

#### Pattern 1: Create Entity Service Method

**BEFORE:**
```python
async def create_persona(
    self, request: CreatePersonaRequest, profile_id: str
) -> CreatePersonaResponse:
    """Create a new persona."""
    
    # Insert persona
    persona_id = await self.conn.fetchval(
        """
        INSERT INTO personas (
            name, description, department_id, default_persona, 
            color, icon, model_id, reasoning, temperature, system_prompt, active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
        """,
        request.name,
        request.description,
        request.department_id,
        request.default_persona,
        request.color,
        request.icon,
        request.model_id,
        request.reasoning,
        request.temperature,
        request.system_prompt,
        request.active,
    )
    
    # Invalidate cache
    await self.invalidate_cache_pattern("persona:*")
    
    return CreatePersonaResponse(
        success=True,
        personaId=str(persona_id),
        message="Persona created successfully"
    )
```

**AFTER:**
```python
async def create_persona(
    self, request: CreatePersonaRequest, profile_id: str, user_role: str
) -> CreatePersonaResponse:
    """Create a new persona with multi-department support."""
    
    # Validate: Only superadmin can create cross-department entities
    if not request.department_ids or len(request.department_ids) == 0:
        if user_role != 'superadmin':
            raise ValueError("Only superadmin can create cross-department entities")
    
    # Insert persona (no department_id or default_persona columns)
    persona_id = await self.conn.fetchval(
        """
        INSERT INTO personas (
            name, description, color, icon, model_id, 
            reasoning, temperature, system_prompt, active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
        """,
        request.name,
        request.description,
        request.color,
        request.icon,
        request.model_id,
        request.reasoning,
        request.temperature,
        request.system_prompt,
        request.active,
    )
    
    # Insert junction table records ONLY if department_ids provided
    if request.department_ids and len(request.department_ids) > 0:
        await self._insert_persona_departments(persona_id, request.department_ids)
    
    # Invalidate cache
    await self.invalidate_cache_pattern("persona:*")
    
    return CreatePersonaResponse(
        success=True,
        personaId=str(persona_id),
        message="Persona created successfully"
    )

async def _insert_persona_departments(
    self, persona_id: Any, department_ids: list[str]
) -> None:
    """Insert junction table records for persona-department links."""
    # Use executemany for batch insert
    values = [(persona_id, dept_id) for dept_id in department_ids]
    await self.conn.executemany(
        """
        INSERT INTO persona_departments (persona_id, department_id, active)
        VALUES ($1, $2, true)
        """,
        values
    )
```

#### Pattern 2: Update Entity Service Method

**BEFORE:**
```python
async def update_persona(
    self, request: UpdatePersonaRequest
) -> UpdatePersonaResponse:
    """Update a persona."""
    
    # Update persona
    await self.conn.execute(
        """
        UPDATE personas
        SET name = $2, description = $3, department_id = $4, 
            default_persona = $5, color = $6, icon = $7, 
            model_id = $8, reasoning = $9, temperature = $10,
            system_prompt = $11, active = $12, updated_at = NOW()
        WHERE id = $1
        """,
        request.personaId,
        request.name,
        request.description,
        request.department_id,
        request.default_persona,
        request.color,
        request.icon,
        request.model_id,
        request.reasoning,
        request.temperature,
        request.system_prompt,
        request.active,
    )
    
    # Invalidate cache
    await self.invalidate_cache_pattern("persona:*")
    
    return UpdatePersonaResponse(success=True, message="Persona updated")
```

**AFTER:**
```python
async def update_persona(
    self, request: UpdatePersonaRequest, user_role: str
) -> UpdatePersonaResponse:
    """Update a persona with multi-department support."""
    
    # Validate cross-department permission
    if not request.department_ids or len(request.department_ids) == 0:
        if user_role != 'superadmin':
            raise ValueError("Only superadmin can make entities cross-department")
    
    # Update persona (no department_id or default_persona)
    await self.conn.execute(
        """
        UPDATE personas
        SET name = $2, description = $3, color = $4, icon = $5,
            model_id = $6, reasoning = $7, temperature = $8,
            system_prompt = $9, active = $10, updated_at = NOW()
        WHERE id = $1
        """,
        request.personaId,
        request.name,
        request.description,
        request.color,
        request.icon,
        request.model_id,
        request.reasoning,
        request.temperature,
        request.system_prompt,
        request.active,
    )
    
    # Replace junction records atomically
    await self.conn.execute(
        "DELETE FROM persona_departments WHERE persona_id = $1",
        request.personaId
    )
    
    if request.department_ids and len(request.department_ids) > 0:
        await self._insert_persona_departments(request.personaId, request.department_ids)
    
    # Invalidate cache
    await self.invalidate_cache_pattern("persona:*")
    
    return UpdatePersonaResponse(success=True, message="Persona updated")
```

#### Pattern 3: Detail Response - Fetch department_ids

**BEFORE:**
```python
# Detail response building (example from persona_service.py)
response = PersonaDetailResponse(
    name=row["name"],
    description=row["description"],
    department_id=row["department_id"],
    default_persona=row["default_persona"],
    can_edit=can_edit,
    # ... other fields
)
```

**AFTER:**
```python
# Fetch department_ids from junction table
dept_rows = await self.conn.fetch(
    """
    SELECT department_id 
    FROM persona_departments 
    WHERE persona_id = $1 AND active = true
    ORDER BY created_at
    """,
    persona_id
)
department_ids = [str(row['department_id']) for row in dept_rows] if dept_rows else []

# Determine if cross-department (no links = cross-dept)
is_cross_dept = len(department_ids) == 0

# Build response
response = PersonaDetailResponse(
    name=row["name"],
    description=row["description"],
    department_ids=department_ids if department_ids else None,  # None for cross-dept
    can_edit=(usage_count == 0) and (not is_cross_dept or user_role == 'superadmin'),
    # ... other fields
)
```

#### Pattern 4: Duplicate Entity Service Method

**Key Changes:**
1. Don't copy `department_id` (it doesn't exist anymore)
2. Copy junction table records to new entity

**BEFORE:**
```python
async def duplicate_persona(
    self, request: DuplicatePersonaRequest, profile_id: str
) -> DuplicatePersonaResponse:
    # Get original persona
    original = await self.conn.fetchrow(
        "SELECT * FROM personas WHERE id = $1",
        request.personaId
    )
    
    # Create new persona with same data
    new_persona_id = await self.conn.fetchval(
        """
        INSERT INTO personas (
            name, description, department_id, default_persona, ...
        )
        VALUES ($1, $2, $3, $4, ...)
        RETURNING id
        """,
        f"{original['name']} (Copy)",
        original['description'],
        original['department_id'],
        False,  # Never copy as default
        # ... other fields
    )
```

**AFTER:**
```python
async def duplicate_persona(
    self, request: DuplicatePersonaRequest, profile_id: str, user_role: str
) -> DuplicatePersonaResponse:
    # Get original persona
    original = await self.conn.fetchrow(
        "SELECT * FROM personas WHERE id = $1",
        request.personaId
    )
    
    # Get original department links
    dept_links = await self.conn.fetch(
        """
        SELECT department_id 
        FROM persona_departments 
        WHERE persona_id = $1 AND active = true
        """,
        request.personaId
    )
    original_dept_ids = [str(row['department_id']) for row in dept_links]
    
    # Validate if duplicating cross-dept entity
    if not original_dept_ids and user_role != 'superadmin':
        raise ValueError("Only superadmin can duplicate cross-department entities")
    
    # Create new persona (no department_id or default_persona)
    new_persona_id = await self.conn.fetchval(
        """
        INSERT INTO personas (
            name, description, color, icon, model_id, ...
        )
        VALUES ($1, $2, $3, $4, $5, ...)
        RETURNING id
        """,
        f"{original['name']} (Copy)",
        original['description'],
        original['color'],
        # ... other fields
    )
    
    # Copy junction table records
    if original_dept_ids:
        await self._insert_persona_departments(new_persona_id, original_dept_ids)
    
    # Invalidate cache
    await self.invalidate_cache_pattern("persona:*")
    
    return DuplicatePersonaResponse(
        success=True,
        personaId=str(new_persona_id),
        message="Persona duplicated successfully"
    )
```

### Implementation Steps

#### Step 1: Get user_role in Route Handlers

Before calling service methods, you need to get the user's role. This should be done in the API route handlers (`server/app/api/v2/`).

**Pattern:**
```python
# In route handler (e.g., server/app/api/v2/personas.py)
@router.post("/create")
async def create_persona(
    request: CreatePersonaRequest,
    db: asyncpg.Connection = Depends(get_db),
):
    # Get user role from profile_id in request or from auth context
    user_role = await db.fetchval(
        "SELECT role FROM profiles WHERE id = $1",
        request.profileId  # or from auth context
    )
    
    service = PersonaService(db)
    response = await service.create_persona(request, request.profileId, user_role)
    return response
```

#### Step 2: Update Service Method Signatures

Add `user_role: str` parameter to:
- All `create_*` methods
- All `update_*` methods  
- All `duplicate_*` methods
- Any method that checks permissions

#### Step 3: Implement Helper Methods

Each service class needs:
```python
async def _insert_{entity}_departments(
    self, entity_id: Any, department_ids: list[str]
) -> None:
    """Insert junction table records."""
    values = [(entity_id, dept_id) for dept_id in department_ids]
    await self.conn.executemany(
        f"INSERT INTO {entity}_departments (persona_id, department_id, active) VALUES ($1, $2, true)",
        values
    )
```

Replace `{entity}` with: persona, cohort, scenario, simulation, rubric, parameter, document

#### Step 4: Update Each Service File

**For each of the 9 service files, update these methods:**

1. **`create_*` method**:
   - Add `user_role` parameter
   - Add validation for cross-dept entities
   - Remove `department_id` and `default_*` from INSERT
   - Add junction table insert logic
   - Add helper method `_insert_{entity}_departments`

2. **`update_*` method**:
   - Add `user_role` parameter
   - Add validation for cross-dept entities
   - Remove `department_id` and `default_*` from UPDATE
   - Add junction table replacement logic (DELETE + INSERT)

3. **`duplicate_*` method** (if exists):
   - Add `user_role` parameter
   - Fetch original department links
   - Add validation for cross-dept entities
   - Copy junction table records

4. **`get_*_detail` method**:
   - Fetch `department_ids` array from junction table
   - Update permission logic to check `is_cross_dept`
   - Pass `department_ids` (or None) to response

5. **`_build_*_list` method** (if exists):
   - No changes needed (queries handle it)
   - Just ensure you're not referencing `default_*` fields

### Special Cases

#### `agent_service.py`
Agents are special - they don't have their own department links anymore. They link to departments via `agent_departments` junction table WITH a role assignment.

Changes needed:
- Remove `default_agent` from create/update
- Agent queries should use `agent_departments` for department filtering
- When creating/updating agents via department management, handle `agent_departments` separately

#### `department_service.py`
Departments themselves don't have `department_id` (they ARE departments).

Changes needed:
- Remove `default_department` from list and detail responses
- Update permission logic

#### `document_service.py`
Documents may have special handling for file uploads.

Changes needed:
- Update `finalize_upload` method to accept `department_ids` instead of `department_id`
- Update junction table handling

### Verification Steps

After completing each service file:

1. **Import Check**:
   ```bash
   cd server
   python -c "from app.services.[module] import *"
   ```

2. **Type Check**:
   ```bash
   cd server
   make typecheck
   ```

3. **Run Service Tests**:
   ```bash
   cd server
   pytest tests/test_services/test_[entity]_service.py -v
   ```
   
   Note: Tests may fail until routes are updated. This is expected.

4. **Manual API Test** (once routes updated):
   ```bash
   # Test creating cross-dept entity as superadmin
   curl -X POST http://localhost:8000/api/v2/personas/create \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","department_ids":null,...}'
   
   # Should succeed if user is superadmin
   # Should fail with 400/403 if user is not superadmin
   ```

---

## Batch C: Client TypeScript Schemas + API Routes

**Estimated Time**: 4-6 hours  
**Complexity**: Medium (type system changes)  
**Dependencies**: Batch B must be complete (or at least API routes need service layer)  
**Testing**: Type checking with `npx tsc --noEmit`

### Files to Modify

**Part 1: TypeScript Schemas (11 files)**
1. `client/lib/api/v2/schemas/personas.ts`
2. `client/lib/api/v2/schemas/cohorts.ts`
3. `client/lib/api/v2/schemas/scenarios.ts`
4. `client/lib/api/v2/schemas/simulations.ts`
5. `client/lib/api/v2/schemas/rubrics.ts`
6. `client/lib/api/v2/schemas/parameters.ts`
7. `client/lib/api/v2/schemas/agents.ts`
8. `client/lib/api/v2/schemas/departments.ts`
9. `client/lib/api/v2/schemas/documents.ts`
10. `client/lib/api/v2/schemas/base.ts` (if needed)
11. `client/lib/api/v2/schemas/home.ts` (if needed)

**Part 2: API Route Handlers (~20-30 files)**
- All files in `client/app/api/v2/personas/`, `/cohorts/`, `/scenarios/`, etc.

### Core Patterns

#### Pattern 1: Update Zod Schemas - List Items

**BEFORE:**
```typescript
export const PersonaItemSchema = z.object({
  persona_id: z.string(),
  name: z.string(),
  // ... other fields
  default_persona: z.boolean(),  // REMOVE THIS
  can_edit: z.boolean(),
  // ... other fields
});
```

**AFTER:**
```typescript
export const PersonaItemSchema = z.object({
  persona_id: z.string(),
  name: z.string(),
  // ... other fields
  // default_persona removed entirely
  can_edit: z.boolean(),
  // ... other fields
});
```

#### Pattern 2: Update Zod Schemas - Detail Responses

**BEFORE:**
```typescript
export const PersonaDetailResponseSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  department_id: z.string(),  // CHANGE THIS
  default_persona: z.boolean(),  // REMOVE THIS
  active: z.boolean(),
  // ... other fields
});
```

**AFTER:**
```typescript
export const PersonaDetailResponseSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  department_ids: z.array(z.string()).nullable(),  // null = cross-department
  active: z.boolean(),
  // ... other fields
});
```

#### Pattern 3: Update Zod Schemas - Create/Update Requests

**BEFORE:**
```typescript
export const CreatePersonaRequestSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  department_id: z.string(),  // CHANGE THIS
  default_persona: z.boolean(),  // REMOVE THIS
  active: z.boolean(),
  // ... other fields
});

export const UpdatePersonaRequestSchema = z.object({
  personaId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  department_id: z.string(),  // CHANGE THIS
  default_persona: z.boolean(),  // REMOVE THIS
  active: z.boolean(),
  // ... other fields
});
```

**AFTER:**
```typescript
export const CreatePersonaRequestSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  department_ids: z.array(z.string()).nullable(),  // null = all departments (superadmin only)
  active: z.boolean(),
  // ... other fields
});

export const UpdatePersonaRequestSchema = z.object({
  personaId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  department_ids: z.array(z.string()).nullable(),  // null = all departments (superadmin only)
  active: z.boolean(),
  // ... other fields
});
```

### Implementation Steps

#### Step 1: Update All Schema Files

For each schema file (`personas.ts`, `cohorts.ts`, etc.):

1. **Find and remove `default_*` fields**:
   ```bash
   # Search for default_* in schema file
   grep -n "default_persona\|default_cohort\|default_scenario\|default_simulation\|default_rubric\|default_parameter\|default_agent\|default_department" client/lib/api/v2/schemas/[file].ts
   ```

2. **Find and replace `department_id`**:
   ```bash
   # Search for department_id
   grep -n "department_id:" client/lib/api/v2/schemas/[file].ts
   ```

3. **Apply changes**:
   - In `*ItemSchema`: Remove `default_*` field entirely
   - In `*DetailResponseSchema`: 
     - Change `department_id: z.string()` → `department_ids: z.array(z.string()).nullable()`
     - Remove `default_*` field
   - In `Create*RequestSchema`:
     - Change `department_id: z.string()` → `department_ids: z.array(z.string()).nullable()`
     - Remove `default_*` field
   - In `Update*RequestSchema`:
     - Change `department_id: z.string()` → `department_ids: z.array(z.string()).nullable()`
     - Remove `default_*` field

#### Step 2: Handle Nested Schemas

Some schemas have nested items (e.g., `ScenarioInSimulation`, `DocumentDetailItem`):

```typescript
// BEFORE
export const ScenarioInSimulationSchema = z.object({
  scenario_id: z.string(),
  title: z.string(),
  default_scenario: z.boolean(),  // REMOVE
  // ...
});

// AFTER
export const ScenarioInSimulationSchema = z.object({
  scenario_id: z.string(),
  title: z.string(),
  // default_scenario removed
  // ...
});
```

#### Step 3: Update API Route Handlers

API routes in `client/app/api/v2/*/` typically just proxy to the server. Changes needed:

**BEFORE:**
```typescript
// client/app/api/v2/personas/create/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();
  const validatedData = CreatePersonaRequestSchema.parse(body);
  
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v2/personas/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...validatedData,
      department_id: validatedData.department_id,  // Just passes through
      default_persona: validatedData.default_persona,
    }),
  });
  
  return NextResponse.json(await response.json());
}
```

**AFTER:**
```typescript
// client/app/api/v2/personas/create/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();
  const validatedData = CreatePersonaRequestSchema.parse(body);
  
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v2/personas/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...validatedData,
      department_ids: validatedData.department_ids,  // Now array or null
      // default_persona removed
    }),
  });
  
  return NextResponse.json(await response.json());
}
```

**Note**: Most API routes just pass through data, so the main change is ensuring field names match (department_id → department_ids).

### Verification Steps

After updating schemas:

1. **Type Check**:
   ```bash
   cd client
   npx tsc --noEmit
   ```
   
   This will show all places where the old types are used. Fix each error.

2. **Build Check**:
   ```bash
   cd client
   yarn build
   ```
   
   Should complete without type errors.

3. **Common Type Errors**:
   - ` Property 'default_persona' does not exist` → Remove usage
   - `Type 'string' is not assignable to type 'string[] | null'` → Update to array
   - `Property 'department_id' does not exist` → Change to `department_ids`

---

## Batch D: Client Components + Testing

**Estimated Time**: 8-12 hours  
**Complexity**: High (UI changes + testing)  
**Dependencies**: Batch C must be complete  
**Testing**: Manual + automated tests

### Components to Update (Estimated 30-50 files)

**Categories:**
1. **Create Forms** - Add multi-select for departments
2. **Edit Forms** - Convert single select to multi-select
3. **Detail Views** - Show cross-department badge
4. **List Views** - Remove "default" badges
5. **Permission Checks** - Update logic

**Key directories:**
- `client/components/create/*` - Entity creation dialogs/forms
- `client/components/management/*` - Entity management pages
- `client/components/common/*` - Shared entity display components
- `client/app/(main)/*` - Page components

### Core Patterns

#### Pattern 1: Form State - Single Select → Multi-Select

**BEFORE:**
```typescript
// In create/edit form component
const [departmentId, setDepartmentId] = useState<string>('');
const [isDefault, setIsDefault] = useState<boolean>(false);

// Render
<Select value={departmentId} onValueChange={setDepartmentId}>
  <SelectTrigger>
    <SelectValue placeholder="Select department" />
  </SelectTrigger>
  <SelectContent>
    {departments.map(dept => (
      <SelectItem key={dept.id} value={dept.id}>
        {dept.title}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

<div className="flex items-center space-x-2">
  <Checkbox 
    id="default" 
    checked={isDefault}
    onCheckedChange={setIsDefault}
  />
  <label htmlFor="default">Make this the default</label>
</div>
```

**AFTER:**
```typescript
// In create/edit form component
const [departmentIds, setDepartmentIds] = useState<string[] | null>(null);
const { profile } = useProfileContext();  // Get user role
const isSuperAdmin = profile?.role === 'superadmin';

// Helper to toggle "all departments"
const toggleAllDepartments = (checked: boolean) => {
  setDepartmentIds(checked ? null : []);
};

// Render
<div className="space-y-4">
  {/* Superadmin-only: "All Departments" option */}
  {isSuperAdmin && (
    <div className="flex items-center space-x-2">
      <Checkbox 
        id="all-depts" 
        checked={departmentIds === null}
        onCheckedChange={toggleAllDepartments}
      />
      <label htmlFor="all-depts" className="text-sm">
        Available to all departments
        <Badge variant="outline" className="ml-2">Cross-Department</Badge>
      </label>
    </div>
  )}
  
  {/* Multi-select for specific departments */}
  {departmentIds !== null && (
    <div>
      <Label>Departments</Label>
      <MultiSelect
        value={departmentIds}
        onChange={setDepartmentIds}
        options={departments.map(d => ({ value: d.id, label: d.title }))}
        placeholder="Select departments..."
      />
    </div>
  )}
</div>
```

**Note**: You may need to create a `<MultiSelect>` component if one doesn't exist. Use shadcn/ui patterns.

#### Pattern 2: Detail View - Show Cross-Department Badge

**BEFORE:**
```typescript
// In detail/list component
{persona.default_persona && (
  <Badge variant="default">Default</Badge>
)}
```

**AFTER:**
```typescript
// In detail/list component
{(!persona.department_ids || persona.department_ids.length === 0) && (
  <Badge variant="outline" className="border-purple-500 text-purple-700">
    All Departments
  </Badge>
)}

{/* Optionally show which departments if specific ones */}
{persona.department_ids && persona.department_ids.length > 0 && (
  <div className="flex gap-2">
    {persona.department_ids.map(deptId => {
      const dept = departmentMapping[deptId];
      return dept ? (
        <Badge key={deptId} variant="secondary">
          {dept.name}
        </Badge>
      ) : null;
    })}
  </div>
)}
```

#### Pattern 3: Permission Checks

**BEFORE:**
```typescript
// Permission logic in component
const canEdit = persona.can_edit; // Server already computed this
const canDelete = persona.can_delete;

// Or if computing client-side:
const canEdit = usageCount === 0 || (persona.default_persona && isSuperAdmin);
```

**AFTER:**
```typescript
// Permission logic (prefer server-side computation)
const canEdit = persona.can_edit; // Server handles cross-dept logic
const canDelete = persona.can_delete;

// If computing client-side:
const isCrossDept = !persona.department_ids || persona.department_ids.length === 0;
const canEdit = usageCount === 0 && (!isCrossDept || isSuperAdmin);
```

**Best Practice**: Let the server handle permission logic. Client should just use `can_edit`, `can_delete` flags from API.

#### Pattern 4: Form Submission

**BEFORE:**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  const response = await fetch('/api/v2/personas/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      description,
      department_id: departmentId,
      default_persona: isDefault,
      // ... other fields
    }),
  });
  
  // Handle response
};
```

**AFTER:**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Validate: if departmentIds is empty array, that's an error
  if (departmentIds !== null && departmentIds.length === 0) {
    toast.error('Please select at least one department or choose "All Departments"');
    return;
  }
  
  const response = await fetch('/api/v2/personas/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      description,
      department_ids: departmentIds,  // array or null
      // default_persona removed
      // ... other fields
    }),
  });
  
  // Handle response
};
```

### Implementation Steps

#### Step 1: Find All Component Files

```bash
# Find components that reference old schema fields
cd client

# Search for default_persona, default_cohort, etc.
grep -r "default_persona\|default_cohort\|default_scenario\|default_simulation\|default_rubric\|default_parameter\|default_agent\|default_department" components/ app/

# Search for department_id (single)
grep -r "\.department_id\b" components/ app/
```

#### Step 2: Create MultiSelect Component (if needed)

If a `<MultiSelect>` component doesn't exist:

```typescript
// client/components/ui/multi-select.tsx
import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface MultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  value,
  onChange,
  options,
  placeholder = "Select items...",
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  const handleRemove = (optionValue: string) => {
    onChange(value.filter((v) => v !== optionValue));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          {value.length > 0 ? (
            <div className="flex gap-1 flex-wrap">
              {value.map((val) => {
                const option = options.find((o) => o.value === val);
                return option ? (
                  <Badge key={val} variant="secondary" className="mr-1">
                    {option.label}
                    <button
                      className="ml-1 hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(val);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ) : null;
              })}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandEmpty>No items found.</CommandEmpty>
          <CommandGroup>
            {options.map((option) => (
              <CommandItem
                key={option.value}
                onSelect={() => handleSelect(option.value)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value.includes(option.value) ? "opacity-100" : "opacity-0"
                  )}
                />
                {option.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

#### Step 3: Update Create Forms

For each create form (e.g., `CreatePersonaDialog.tsx`):

1. Replace single department select with multi-select
2. Add "All Departments" checkbox for superadmin
3. Remove "default" checkbox
4. Update form submission to use `department_ids`

#### Step 4: Update Edit Forms

Similar to create forms:

1. Initialize state with existing `department_ids`
2. Replace single select with multi-select
3. Remove "default" checkbox
4. Update form submission

**Important**: Handle the case where `department_ids === null` (cross-dept):
```typescript
// When loading existing entity
const [departmentIds, setDepartmentIds] = useState<string[] | null>(
  persona.department_ids ?? null  // null means cross-dept
);
```

#### Step 5: Update List/Detail Views

1. Remove "Default" badges
2. Add "All Departments" badge for cross-dept entities
3. Optionally show specific department badges

#### Step 6: Update Context/State Management

If using contexts (e.g., `ProfileContext`):
- Ensure profile role is available for permission checks
- Update any cached data to use new schema

### Testing

#### Manual Testing Checklist

Create a test plan spreadsheet or document with these scenarios:

**As Superadmin:**
- [ ] Create entity with `department_ids: null` (cross-dept) ✓ Should succeed
- [ ] Create entity with specific departments ✓ Should succeed
- [ ] Edit entity to make it cross-dept ✓ Should succeed
- [ ] Edit entity to assign specific departments ✓ Should succeed
- [ ] Delete cross-dept entity ✓ Should succeed
- [ ] Duplicate cross-dept entity ✓ Should succeed

**As Non-Superadmin (admin/instructional):**
- [ ] Create entity with `department_ids: null` ✗ Should fail with error
- [ ] Create entity with specific departments ✓ Should succeed
- [ ] Edit cross-dept entity ✗ Should be disabled (can_edit = false)
- [ ] Edit dept-specific entity ✓ Should succeed if unused
- [ ] Delete cross-dept entity ✗ Should be disabled (can_delete = false)
- [ ] Duplicate cross-dept entity ✗ Should fail with error

**Data Visibility:**
- [ ] Cross-dept entities visible to ALL departments ✓
- [ ] Dept-specific entities visible ONLY to assigned departments ✓
- [ ] Switching departments shows correct entities ✓

#### Automated Testing

Update unit tests for components:

```typescript
// Example: client/__tests__/components/create/CreatePersonaDialog.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreatePersonaDialog } from '@/components/create/CreatePersonaDialog';

describe('CreatePersonaDialog', () => {
  it('shows all departments checkbox for superadmin', () => {
    const mockProfile = { role: 'superadmin', id: '123' };
    
    render(<CreatePersonaDialog profile={mockProfile} />);
    
    expect(screen.getByLabelText(/available to all departments/i)).toBeInTheDocument();
  });
  
  it('hides all departments checkbox for non-superadmin', () => {
    const mockProfile = { role: 'admin', id: '123' };
    
    render(<CreatePersonaDialog profile={mockProfile} />);
    
    expect(screen.queryByLabelText(/available to all departments/i)).not.toBeInTheDocument();
  });
  
  it('submits with department_ids: null when all departments checked', async () => {
    const mockProfile = { role: 'superadmin', id: '123' };
    const mockOnSubmit = jest.fn();
    
    render(<CreatePersonaDialog profile={mockProfile} onSubmit={mockOnSubmit} />);
    
    // Check "All Departments"
    fireEvent.click(screen.getByLabelText(/available to all departments/i));
    
    // Fill in other fields...
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Test' } });
    
    // Submit
    fireEvent.click(screen.getByText(/create/i));
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ department_ids: null })
      );
    });
  });
});
```

#### Run Tests

```bash
# Server tests
cd server
make test

# Client tests
cd client
yarn test

# Type check
cd client
npx tsc --noEmit

# Build check
cd client
yarn build
```

### Common Issues & Solutions

**Issue 1**: Empty array `[]` vs `null`
- **Problem**: `department_ids: []` should not be allowed
- **Solution**: Validate on submit - must be `null` or non-empty array

**Issue 2**: MultiSelect doesn't clear when "All Departments" checked
- **Problem**: Selected departments remain visible
- **Solution**: Reset to empty array when toggling to "all": `setDepartmentIds(checked ? null : [])`

**Issue 3**: Permission checks fail
- **Problem**: Client computes permissions differently than server
- **Solution**: Always trust server's `can_edit`, `can_delete` flags

**Issue 4**: Type errors with nullable arrays
- **Problem**: TypeScript complains about `department_ids?.length`
- **Solution**: Use explicit null check: `!department_ids || department_ids.length === 0`

---

## Final Verification & Deployment

### Pre-Deployment Checklist

- [ ] All server query files updated (12 files)
- [ ] All server service files updated (9 files)
- [ ] All client schema files updated (11 files)
- [ ] All client components updated (estimated 30-50 files)
- [ ] Server tests passing: `cd server && make test`
- [ ] Client tests passing: `cd client && yarn test`
- [ ] Type checking clean: `cd client && npx tsc --noEmit`
- [ ] Build succeeds: `cd client && yarn build`
- [ ] Manual testing completed (see checklist above)

### Database Verification

```sql
-- Verify junction tables have data
SELECT 'cohort_departments' as table_name, COUNT(*) FROM cohort_departments
UNION ALL
SELECT 'document_departments', COUNT(*) FROM document_departments
UNION ALL
SELECT 'parameter_departments', COUNT(*) FROM parameter_departments
UNION ALL
SELECT 'persona_departments', COUNT(*) FROM persona_departments
UNION ALL
SELECT 'rubric_departments', COUNT(*) FROM rubric_departments
UNION ALL
SELECT 'scenario_departments', COUNT(*) FROM scenario_departments
UNION ALL
SELECT 'simulation_departments', COUNT(*) FROM simulation_departments;

-- Verify cross-dept entities exist
SELECT 'personas' as entity_type, COUNT(*) 
FROM personas p 
WHERE NOT EXISTS (SELECT 1 FROM persona_departments pd WHERE pd.persona_id = p.id)
UNION ALL
SELECT 'cohorts', COUNT(*) 
FROM cohorts c 
WHERE NOT EXISTS (SELECT 1 FROM cohort_departments cd WHERE cd.cohort_id = c.id);
```

### Deployment Steps

1. **Backup Database** (already done, but verify):
   ```bash
   make backup-db
   ```

2. **Deploy Server**:
   ```bash
   cd server
   # Run any pending migrations
   # Deploy server code
   ```

3. **Deploy Client**:
   ```bash
   cd client
   yarn build
   # Deploy build
   ```

4. **Smoke Test**:
   - Login as superadmin
   - Create a cross-dept entity
   - Login as non-superadmin
   - Verify can't edit cross-dept entity
   - Verify can create dept-specific entity

### Rollback Plan

If issues arise:

1. **Restore Database**:
   ```bash
   # Use latest backup before migration
   psql -d mydb < history/restore_20251029_095219.sql.gz
   ```

2. **Revert Code**:
   ```bash
   git revert <commit-hash>
   # Or checkout previous version
   ```

3. **Redeploy**

---

## Summary

This refactoring is broken into 4 batches:

- **Batch A** (4-6 hrs): Complete server query layer - SQL pattern changes
- **Batch B** (6-8 hrs): Server service layer - Business logic + DB transactions
- **Batch C** (4-6 hrs): Client TypeScript schemas + API routes - Type system
- **Batch D** (8-12 hrs): Client components + Testing - UI changes

**Total Estimated Time**: 22-32 hours

Each batch can be worked on independently once dependencies are met, and includes detailed patterns, examples, verification steps, and common pitfalls to avoid.

