# SQL Return Structure Guidelines

This document defines the standards and best practices for structuring `RETURNS TABLE` clauses in PostgreSQL functions. These guidelines ensure consistency, maintainability, and predictable data structures across all SQL functions.

## Overview

All SQL functions that return data should follow a consistent structure for their `RETURNS TABLE` clause. This ensures:

- **Consistency**: Frontend code can reliably expect fields in a predictable order
- **Maintainability**: Developers know where to find specific fields
- **Type Safety**: Consistent patterns make type generation and validation easier
- **Clarity**: The structure itself documents the data model

## Required Fields (First 5)

**All functions must start with these five required fields:**

1. **`actor_name`** (text) - The name of the actor/user performing the operation (for audit logging)
2. **`{artifact}_exists`** (boolean) - Whether the artifact exists (e.g., `persona_exists`, `agent_exists`)
3. **`can_edit`** (boolean) - Whether the current user has edit permissions
4. **`disabled_reason`** (text, nullable) - Human-readable explanation of why editing is disabled (NULL if `can_edit = true`)
5. **`group_id`** (uuid, nullable) - The group ID for linking resources to messages/runs/groups (enables traceability and regeneration workflows)

**Example:**
```sql
RETURNS TABLE (
    actor_name text,
    persona_exists boolean,
    can_edit boolean,
    disabled_reason text,
    group_id uuid,
    -- ... rest of fields
)
```

## Resource Field Patterns

After the required fields, resources follow consistent patterns based on whether they are single-select or multi-select.

### Single-Select Resources

**Pattern:** `{resource}_id`, `{resource}_resource`, `show_{resource}`, `{resource}_agent_id`, `{resource}_required`, `{resource}_suggestions`, `{resource}` (optional array)

**Order:**
1. `{resource}_id` (uuid) - The selected resource ID
2. `{resource}_resource` (composite type) - The selected resource object (includes `generated` boolean field and `group_id` uuid field)
3. `show_{resource}` (boolean) - Whether to show this resource picker (based on whether options exist AND tool availability for required resources)
4. `{resource}_agent_id` (uuid, nullable) - Agent ID for generating this resource (NULL if no tool available)
5. `{resource}_required` (boolean) - Whether this resource is required (affects `can_edit` and `disabled_reason` if no tool available)
6. `{resource}_suggestions` (uuid[]) - Array of suggested resource IDs (always UUIDs, never text)
7. `{resource}` (array, optional) - Options array (see "Option Arrays" section below for details on two types: all available vs. suggested only)

**Note:** The `{resource}_resource` composite type includes:
- `generated` boolean field - Indicates if the resource was AI-generated
- `group_id` uuid field (nullable) - The group ID for regeneration support (obtained via `resource.call_id → calls.run_id → group_runs.group_id`)

This enables regeneration workflows where users can regenerate resources with custom instructions. See the "Regeneration Support" section below for details.

**Examples:**
- **name**: `name_id`, `name_resource`, `show_name`, `name_agent_id`, `name_required`, `name_suggestions`, `names` (suggested options only)
- **description**: `description_id`, `description_resource`, `show_description`, `description_agent_id`, `description_required`, `description_suggestions`, `descriptions` (suggested options only)
- **color**: `color_id`, `color_resource`, `show_color`, `color_agent_id`, `color_required`, `color_suggestions`, `colors` (all available colors)
- **icon**: `icon_id`, `icon_resource`, `show_icon`, `icon_agent_id`, `icon_required`, `icon_suggestions`, `icons` (all available icons)
- **instructions**: `instructions_id`, `instructions_resource`, `show_instructions`, `instructions_agent_id`, `instructions_required`, `instructions_suggestions`, `instructions` (suggested options only)
- **flag**: `active_flag_id`, `flag_resource`, `show_flag`, `flag_agent_id`, `flag_required` (can be false for consistency), (no suggestions or options array)

**Note:** For resources with options arrays, the array comes **last** in that resource's group.

### Multi-Select Resources

**Pattern:** `{resource}_ids`, `{resource}_resources`, `show_{resource}`, `{resource}_agent_id`, `{resource}_required`, `{resource}_suggestions`, `{resource}` (array comes last)

**Order:**
1. `{resource}_ids` (uuid[]) - Array of selected resource IDs
2. `{resource}_resources` (composite_type[]) - Array of selected resource objects (each includes `generated` boolean and `group_id` uuid)
3. `show_{resource}` (boolean) - Whether to show this resource picker (based on business logic AND tool availability for required resources)
4. `{resource}_agent_id` (uuid, nullable) - Agent ID for generating this resource (NULL if no tool available)
5. `{resource}_required` (boolean) - Whether this resource is required (affects `can_edit` and `disabled_reason` if no tool available)
6. `{resource}_suggestions` (uuid[]) - Array of suggested resource IDs (always UUIDs)
7. `{resource}` (composite_type[]) - **All available options array (comes last; each includes `generated` boolean and `group_id` uuid)**

**Note:** Each resource object in the arrays includes:
- `generated` boolean field - Indicates if that specific resource was AI-generated
- `group_id` uuid field (nullable) - The group ID for regeneration support (obtained via `resource.call_id → calls.run_id → group_runs.group_id`)

This provides a single standard pattern for both single-select and multi-select resources. See the "Regeneration Support" section below for details.

**Examples:**
- **departments**: `department_ids`, `department_resources`, `show_departments`, `departments_agent_id`, `departments_required`, `department_suggestions`, `departments` (all available)
- **fields**: `field_ids`, `field_resources`, `show_fields`, `fields_agent_id`, `fields_required`, `field_suggestions`, `fields` (all available)
- **examples**: `example_ids`, `example_resources`, `show_examples`, `examples_agent_id`, `examples_required`, `example_suggestions`, `examples` (all available)

**Key Point:** The full array (`{resource}`) always comes **last** in the multi-select resource group, after IDs, resources, show flag, and suggestions.

## Option Arrays

**Single-select resources can have option arrays, but they come in two types:**

### 1. All Available Options (Colors, Icons)

**Resources:** `colors`, `icons`

**Behavior:**
- Contains **every valid option** available in the system
- Used for resources with predefined option sets
- Examples: All color options, all icon options
- These arrays are always populated (unless filtered by search/filter params)

**Use Case:** GenericPicker components that need to show all possible choices

### 2. Suggested Options Only (Names, Descriptions, Instructions)

**Resources:** `names`, `descriptions`, `instructions`

**Behavior:**
- Contains **only** the resources matching IDs in `{resource}_suggestions`
- If there are 5 suggestions, the array contains exactly 5 items
- Maintains the same order as `{resource}_suggestions` (most recent first)
- Empty array `[]` if no suggestions exist

**Use Case:** GenericPicker components that show previously AI-generated resources for quick selection

**Why This Distinction:**
- Colors and icons have finite, predefined sets that users should see all of
- Names, descriptions, and instructions are dynamically generated - showing only suggestions prevents overwhelming the UI with potentially thousands of options
- Suggested-only arrays enable users to quickly access previously generated content

**Example:**
```sql
-- Colors: All available options
colors types.q_get_persona_v4_color_option[]  -- All colors in system

-- Descriptions: Only suggested options
descriptions types.q_get_persona_v4_description_resource[]  -- Only descriptions matching description_suggestions IDs
```

## Suggestions Standardization

**⚠️ CRITICAL: All suggestions must be UUID arrays, never text arrays.**

- **Always return resource IDs**: Suggestions should return `uuid[]` arrays containing the IDs of suggested resources
- **Never return text values**: Do not return text arrays with names, descriptions, or other text values
- **Consistent type**: All `{resource}_suggestions` fields must be `uuid[]` type

**Suggestions Logic:**
- **Based on `generated` flag**: Suggestions are determined by querying junction tables (e.g., `persona_colors`, `persona_descriptions`) for resources where `generated = true`
- **Junction table pattern**: Each junction table (e.g., `persona_colors`, `persona_descriptions`, `persona_instructions`) has a `generated` boolean column
- **Ordering**: Suggestions are ordered by `created_at DESC` to show most recently generated resources first
- **Limits**: Typically limited to 20 suggestions per resource type
- **Purpose**: Enables users to quickly access previously AI-generated resources

**Why:**
- Frontend can look up full resource objects using IDs
- Consistent type makes type generation and validation easier
- IDs are stable identifiers, text values may change
- `generated` flag provides a clear signal for AI-generated content that users may want to reuse

**Example:**
```sql
-- ❌ WRONG: Returns text array
name_suggestions text[]

-- ✅ CORRECT: Returns UUID array based on generated flag
name_suggestions_data AS (
    SELECT 
        COALESCE(
            ARRAY_AGG(pn.name_id ORDER BY pn.created_at DESC),
            ARRAY[]::uuid[]
        ) as name_suggestions
    FROM persona_names pn
    WHERE pn.generated = true
      AND pn.name_id IS NOT NULL
    GROUP BY pn.name_id
    ORDER BY MAX(pn.created_at) DESC
    LIMIT 20
)
```

## Regeneration Support

**Group ID Tracking:**
- **⚠️ IMPORTANT: `group_id` is NOT included in GET endpoint responses**
- `group_id` is fetched separately before generation via websocket handler using `api_get_persona_resource_group_ids_v4` SQL function
- `group_id` is obtained by following the relationship chain:
  - Resource → `call_id` → `calls.id` → `message_calls.call_id` → `message_calls.message_id` → `message_runs.message_id` → `message_runs.run_id` → `group_runs.run_id` → `group_runs.group_id`
- `group_id` is only present when:
  - Resource is generated (`generated = true`)
  - Resource has a `call_id` that links to a call
  - The call is linked to a message via `message_calls`
  - The message is linked to a run via `message_runs`
  - The run is linked to a group via `group_runs` junction table
- If any step in the chain is missing, `group_id` will be `NULL`

**Performance Optimization:**
- GET endpoints no longer perform expensive `group_id` lookups (removed LEFT JOINs to `group_runs`)
- Group IDs are only fetched when needed (before regeneration via websocket)
- This reduces query complexity and improves GET endpoint performance

**Frontend Usage:**
- **Do NOT rely on `group_id` from GET endpoint** - it is not included in responses
- Server automatically fetches `group_id` before generation via websocket handler
- Frontend can send empty `group_ids: {}` - server will fetch from database as source of truth

**SQL Pattern:**
```sql
-- Example: Getting group_id for a resource
LEFT JOIN calls c ON c.id = resource.call_id
LEFT JOIN group_runs gr ON gr.run_id = c.run_id
-- Then include gr.group_id in the composite type ROW()
ROW(resource.id, resource.name, resource.generated, gr.group_id)::types.q_get_persona_v4_name_resource
```

## Show Flags

**All resources must have a `show_{resource}` boolean flag.**

**Purpose:**
- Indicates whether the UI should display the resource picker/selector
- For single-select resources: Based on whether options exist AND tool availability (e.g., `show_color = colors.length > 0 AND color_agent_id IS NOT NULL` for required resources)
- For multi-select resources: Based on business logic AND tool availability (e.g., `show_departments = user has multiple departments AND departments_agent_id IS NOT NULL` for required resources)
- For flag resource: Can be `false` for consistency (as it's just a boolean toggle)
- **For required resources**: If `{resource}_required = true` AND `{resource}_agent_id IS NULL`, then `show_{resource} = false`
- **For optional resources**: `show_{resource}` is not affected by tool availability

**Implementation:**
```sql
-- Single-select: Based on options array and tool availability
show_color boolean,  -- true if colors array has items AND (color_agent_id IS NOT NULL OR color_required = false)

-- Multi-select: Based on business logic and tool availability
show_departments boolean,  -- true if user has multiple departments AND (departments_agent_id IS NOT NULL OR departments_required = false)
show_fields boolean,  -- true if fields exist AND (fields_agent_id IS NOT NULL OR fields_required = false)
```

## Complete Example Structure

```sql
RETURNS TABLE (
    -- Required fields (first 4)
    actor_name text,
    persona_exists boolean,
    can_edit boolean,
    disabled_reason text,
    
    -- Single-select resources: name
    name_id uuid,
    name_resource types.q_get_persona_v4_name_resource,  -- Includes: id, name, generated, group_id
    show_name boolean,
    name_agent_id uuid,  -- Agent ID for generating names (NULL if no tool available)
    name_required boolean,  -- true (required resource)
    name_suggestions uuid[],
    
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_persona_v4_description_resource,  -- Includes: id, description, generated, group_id
    show_description boolean,
    description_agent_id uuid,  -- Agent ID for generating descriptions (NULL if no tool available)
    description_required boolean,  -- false (optional resource)
    description_suggestions uuid[],
    
    -- Single-select resources: color
    color_id uuid,
    color_resource types.q_get_persona_v4_color_resource,  -- Includes: id, name, description, hex_code, generated, group_id
    show_color boolean,
    color_agent_id uuid,  -- Agent ID for generating colors (NULL if no tool available)
    color_required boolean,  -- true (required resource)
    color_suggestions uuid[],
    colors types.q_get_persona_v4_color_option[],  -- Array comes last; each includes generated, group_id
    
    -- Single-select resources: icon
    icon_id uuid,
    icon_resource types.q_get_persona_v4_icon_resource,  -- Includes: id, name, description, value, generated, group_id
    show_icon boolean,
    icon_agent_id uuid,  -- Agent ID for generating icons (NULL if no tool available)
    icon_required boolean,  -- true (required resource)
    icon_suggestions uuid[],
    icons types.q_get_persona_v4_icon_option[],  -- Array comes last; each includes generated, group_id
    
    -- Single-select resources: instructions
    instructions_id uuid,
    instructions_resource types.q_get_persona_v4_instructions_resource,  -- Includes: id, template, generated, group_id
    show_instructions boolean,
    instructions_agent_id uuid,  -- Agent ID for generating instructions (NULL if no tool available)
    instructions_required boolean,  -- true (required resource)
    instructions_suggestions uuid[],
    
    -- Single-select resources: flag
    active_flag_id uuid,
    flag_resource types.q_get_persona_v4_flag_resource,  -- Includes: id, name, description, icon_id, generated, group_id
    show_flag boolean,
    flag_agent_id uuid,  -- Agent ID for generating flags (NULL if no tool available)
    flag_required boolean,  -- false (optional resource)
    
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_persona_v4_department[],  -- Each includes: department_id, name, description, generated, group_id
    show_departments boolean,
    departments_agent_id uuid,  -- Agent ID for generating departments (NULL if no tool available)
    departments_required boolean,  -- true if show_departments is true
    department_suggestions uuid[],
    departments types.q_get_persona_v4_department[],  -- Array comes last; each includes generated, group_id
    
    -- Multi-select resources: fields
    field_ids uuid[],
    field_resources types.q_get_persona_v4_field[],  -- Each includes: field_id, name, description, generated, group_id
    show_fields boolean,
    fields_agent_id uuid,  -- Agent ID for generating fields (NULL if no tool available)
    fields_required boolean,  -- true if show_fields is true
    field_suggestions uuid[],
    fields types.q_get_persona_v4_field[],  -- Array comes last; each includes generated, group_id
    
    -- Multi-select resources: examples
    example_ids uuid[],
    example_resources types.q_get_persona_v4_example[],  -- Each includes: example, idx, generated, group_id
    show_examples boolean,
    examples_agent_id uuid,  -- Agent ID for generating examples (NULL if no tool available)
    examples_required boolean,  -- true if show_examples is true
    example_suggestions uuid[],
    examples types.q_get_persona_v4_example[],  -- Array comes last; each includes generated, group_id
    
    -- Multi-resource combination agent IDs (after all individual resources)
    basic_agent_id uuid,  -- Agent ID for generating names + descriptions + flags + departments together
    content_agent_id uuid  -- Agent ID for generating instructions + examples together
)
```

## SELECT Clause Ordering

**The SELECT clause must match the RETURN TABLE order exactly.**

- Fields in SELECT must be in the same order as RETURN TABLE
- This ensures consistency and makes debugging easier
- Type generation relies on field order matching

## Agent IDs and Required Flags

**Agent IDs:**
- Each resource has a `{resource}_agent_id` (uuid, nullable) field placed after `show_{resource}`
- Agent IDs are determined at GET time using inline agent selection logic
- Agent selection finds the best agent with tools for the resource, preferring:
  1. Most specific/narrow agent (smallest set difference)
  2. Department-specific over cross-department
  3. Most recently updated (`updated_at DESC`)
  4. Deterministic tie-breaker (`agent_id ASC`)
- Multi-resource combinations have dedicated agent IDs:
  - `basic_agent_id`: For names + descriptions + flags + departments
  - `content_agent_id`: For instructions + examples

**Required Flags:**
- Each resource has a `{resource}_required` (boolean) field placed after `{resource}_agent_id`
- Required resources: name, color, icon, instructions (always true)
- Optional resources: description, active_flag (always false)
- Conditional required: departments, fields, examples (true if `show_{resource}` is true)

**Tool Availability Impact:**
- If `{resource}_required = true` AND `{resource}_agent_id IS NULL`:
  - `show_{resource} = false`
  - Contributes to `can_edit = false`
  - Adds to `disabled_reason`: "No tool configured for {resource1}, {resource2}, and {resource3}. Therefore we cannot proceed ahead."
- If `{resource}_required = false`, missing tools do not affect `can_edit` or `disabled_reason`

## MCP (Model Context Protocol) Support

**MCP Support:**
- Artifact endpoints (e.g., `get_persona`) accept an `mcp boolean` parameter (defaults to `false`)
- When `mcp = true`, agent selection filters to only include agents with the `mcp` flag enabled
- Agent filtering happens in SQL (embedded in agent selection CTEs), not in Python endpoints
- Resource creation endpoints validate that the provided `agent_id` has the `mcp` flag when `mcp = true` (validation in SQL)
- Resources have an `mcp boolean` column (defaults to `false`) to track if they were created via MCP
- The `mcp` field is stored on resources but **not included in composite types** returned by artifact endpoints
- MCP header (`X-MCP`) is parsed at the router level and stored in `request.state.mcp`

**Agent Filtering Pattern:**
```sql
-- In agent selection CTEs (e.g., name_agent_data, color_agent_data, etc.)
WHERE ...
  -- Filter by MCP flag when mcp=true
  AND (
      (SELECT mcp FROM params) = false
      OR EXISTS (
          SELECT 1 FROM agent_flags af_mcp
          WHERE af_mcp.agent_id = a.id
            AND af_mcp.type = 'mcp'::type_agent_flags
            AND af_mcp.value = true
      )
  )
```

**Resource Creation Validation:**
```sql
-- In resource creation functions (e.g., api_create_names_v4)
-- Validate agent has mcp flag when mcp=true
IF mcp = true AND agent_id IS NOT NULL THEN
    IF NOT EXISTS (
        SELECT 1 FROM agent_flags 
        WHERE agent_id = api_create_names_v4.agent_id 
          AND type = 'mcp'::type_agent_flags 
          AND value = true
    ) THEN
        RAISE EXCEPTION 'Agent % does not have MCP flag enabled', agent_id;
    END IF;
END IF;
```

**Key Points:**
- MCP validation happens in SQL functions, not Python endpoints (consistent with profile_id pattern)
- Agent filtering only applies when `mcp=true` (backward compatible)
- Resource `mcp` field defaults to `false` (backward compatible)
- All existing resources will have `mcp=false` after migration

## Key Principles Summary

1. **Required fields first**: `actor_name`, `{artifact}_exists`, `can_edit`, `disabled_reason`
2. **Consistent resource patterns**: Single-select vs multi-select follow their respective patterns
3. **Show flags for all**: Every resource has a `show_{resource}` boolean (affected by tool availability for required resources)
4. **Agent IDs after show flags**: Each resource has `{resource}_agent_id` and `{resource}_required` after `show_{resource}`
5. **Multi-resource agent IDs**: `basic_agent_id` and `content_agent_id` come after all individual resources
6. **Generated field in resources**: All resource composite types include a `generated` boolean field to track AI generation
7. **Group ID for regeneration**: All resource composite types include a `group_id uuid` field (nullable) for regeneration support
8. **Suggestions are UUIDs**: All `{resource}_suggestions` fields are `uuid[]`, never `text[]`
9. **Arrays come last**: For resources with option arrays, the array comes last in that resource's group
10. **Multi-select arrays last**: The full `{resource}` array comes last in multi-select resource groups
11. **SELECT matches RETURN**: SELECT clause order must match RETURN TABLE order exactly
12. **Tool availability checks**: Required resources without tools disable editing with appropriate error messages

## Migration Checklist

When updating an existing SQL function to follow these guidelines:

- [ ] Move required fields (`actor_name`, `{artifact}_exists`, `can_edit`, `disabled_reason`) to the top
- [ ] Add `show_{resource}` flags for all resources
- [ ] Add `{resource}_agent_id` fields after each `show_{resource}` flag
- [ ] Add `{resource}_required` fields after each `{resource}_agent_id` field
- [ ] Add multi-resource agent IDs (`basic_agent_id`, `content_agent_id`) after all individual resources
- [ ] Add inline agent selection CTEs for each resource type and multi-resource combinations
- [ ] Update `show_{resource}` logic to check tool availability for required resources
- [ ] Update `can_edit` and `disabled_reason` logic to check required resources for missing tools
- [ ] Convert text-based suggestions to UUID arrays
- [ ] Reorder fields to follow single-select/multi-select patterns
- [ ] Move option arrays to come last in their resource groups
- [ ] Move multi-select full arrays to come last in their groups
- [ ] Update SELECT clause to match RETURN TABLE order
- [ ] Test SQL compilation with `make sql-compile`
- [ ] Update frontend code if needed for UUID-based suggestions and agent IDs

## Frontend Component Props Standards

**This section documents how the SQL return structure maps to frontend component props, ensuring consistency between server and client.**

### Mapping SQL Return Structure to Component Props

The standardized SQL return structure directly maps to standardized component props. This eliminates the need for type casting, mapping, or transformation at the top level.

### Standardized Component Props

#### Single-Select Resources

**Props Pattern:**
- `{resource}_id`: `string | null` - Current resource ID (from SQL `{resource}_id`)
- `{resource}_resource`: `{ id: string; ...; generated: boolean } | null` - Resource object (from SQL `{resource}_resource`; includes `generated` field, but NOT `group_id`)
- `show_{resource}`: `boolean` - Whether to show picker (from SQL `show_{resource}`)
- `{resource}_suggestions`: `string[]` - Suggested resource IDs (from SQL `{resource}_suggestions`)
- `{resource}`?: `Array<{ ...; generated: boolean }>` - All available options (from SQL `{resource}` array, for color/icon; each includes `generated` but NOT `group_id`)
- `disabled`: `boolean` - Based on `can_edit` flag (inverted: `disabled = !can_edit`)
- `onChange`: `(id: string | null) => void` - Callback to update resource ID
- `onGenerate?`: `() => Promise<void>` - Optional AI generation handler
- `isGenerating?`: `boolean` - Optional generation state
- `create{Resource}Action?`: Action for creating new resources

**Accessing Generated Status:**
- Single-select: `name_resource?.generated ?? false` - Check if the selected resource was AI-generated
- Options arrays: `colors.find(c => c.id === color_id)?.generated ?? false` - Check if a specific option was generated

**Accessing Group ID for Regeneration:**
- **⚠️ IMPORTANT: `group_id` is NOT available in GET endpoint responses**
- Server automatically fetches `group_id` before generation via websocket handler
- Frontend should not attempt to access `group_id` from GET endpoint responses
- Regeneration is handled entirely server-side - frontend sends empty `group_ids: {}` and server fetches from database

**Example - Names Component:**
```typescript
<Names
  name_id={personaData?.name_id ?? null}
  name_resource={personaData?.name_resource ?? null}
  show_name={personaData?.show_name ?? true}
  name_suggestions={personaData?.name_suggestions ?? []}
  disabled={disabled}
  onNameIdChange={(id) => setFormState(prev => ({ ...prev, name_id: id }))}
  onGenerate={handleGenerateName}
  isGenerating={isGeneratingName}
  createNamesAction={createNamesAction}
/>
```

**Example - Colors Component:**
```typescript
<Colors
  color_id={personaData?.color_id ?? null}
  color_resource={personaData?.color_resource ?? null}
  show_color={personaData?.show_color ?? false}
  color_suggestions={personaData?.color_suggestions ?? []}
  colors={personaData?.colors ?? []}
  disabled={disabled}
  onColorIdChange={(id) => setFormState(prev => ({ ...prev, color_id: id }))}
  createColorsAction={createColorsAction}
/>
```

#### Multi-Select Resources

**Props Pattern:**
- `{resource}_ids`: `string[]` - Current resource IDs (from SQL `{resource}_ids`)
- `{resource}_resources`: `Array<{ id: string; ...; generated: boolean }>` - Selected resources (from SQL `{resource}_resources`; each includes `generated` but NOT `group_id`)
- `show_{resource}`: `boolean` - Whether to show picker (from SQL `show_{resource}`)
- `{resource}_suggestions`: `string[]` - Suggested resource IDs (from SQL `{resource}_suggestions`)
- `{resource}`: `Array<{ id: string; ...; generated: boolean }>` - All available options (from SQL `{resource}` array; each includes `generated` but NOT `group_id`)
- `disabled`: `boolean` - Based on `can_edit` flag (inverted: `disabled = !can_edit`)
- `onChange`: `(ids: string[]) => void` - Callback to update resource IDs array

**Accessing Generated Status:**
- Multi-select: `department_resources.some(d => d.generated)` - Check if any selected resource was generated
- Individual check: `department_resources.find(d => d.department_id === id)?.generated ?? false` - Check if a specific resource was generated

**Accessing Group ID for Regeneration:**
- **⚠️ IMPORTANT: `group_id` is NOT available in GET endpoint responses**
- Server automatically fetches `group_id` before generation via websocket handler
- Frontend should not attempt to access `group_id` from GET endpoint responses
- Regeneration is handled entirely server-side - frontend sends empty `group_ids: {}` and server fetches from database

**Example - Departments Component:**
```typescript
<Departments
  department_ids={personaData?.department_ids ?? []}
  department_resources={personaData?.department_resources ?? []}
  show_departments={personaData?.show_departments ?? false}
  department_suggestions={personaData?.department_suggestions ?? []}
  departments={personaData?.departments ?? []}
  disabled={disabled}
  onDepartmentIdsChange={(ids) => setFormState(prev => ({ ...prev, department_ids: ids }))}
/>
```

### Component Responsibilities

**Each resource component should:**

1. **Handle `show_{resource}` flag internally**: Don't render if `show_{resource}` is `false`
2. **Handle its own mapping/transformation**: If internal format differs from API format, transform within component
3. **Use `disabled` prop consistently**: Apply to all interactive elements (inputs, buttons, pickers)
4. **Handle suggestions lookup**: If suggestions are UUIDs, component may need to look up full resource objects
5. **Accept props directly from API**: No type casting or mapping at top level

### Disabled Prop Pattern

**All components must respect the `can_edit` flag:**

```typescript
// In top-level component (e.g., PersonaNew.tsx)
const disabled = useMemo(() => {
  if (!isEditMode || !personaData) return false;
  return !personaData.can_edit;
}, [isEditMode, personaData]);

// Pass to all resource components
<Names disabled={disabled} ... />
<Colors disabled={disabled} ... />
<Departments disabled={disabled} ... />
```

**Key Points:**
- `disabled` is computed once at the top level from `can_edit`
- All resource components receive the same `disabled` value
- Components apply `disabled` to all interactive elements
- In create mode (`!isEditMode`), `disabled` is always `false`

### Top-Level Component Pattern

**The top-level component (e.g., PersonaNew.tsx) should:**

1. **Extract `disabled` once** from `can_edit` flag
2. **Pass props directly** from API response without type casting:
   ```typescript
   // ❌ WRONG: Type casting and mapping
   (personaData as PersonaDetailOut & { name_resource?: ... })?.name_resource || null
   
   // ✅ CORRECT: Direct prop access
   personaData?.name_resource ?? null
   ```
3. **Remove conditional rendering** based on `show_{resource}` - let components handle it
4. **Use consistent onChange naming**: `onNameIdChange`, `onDepartmentIdsChange`, etc.

### Benefits

1. **Type Safety**: Direct use of API response types eliminates type casting
2. **Consistency**: All components follow the same prop pattern
3. **Reduced Complexity**: Top-level component does minimal mapping
4. **Better Encapsulation**: Each component handles its own logic
5. **Maintainability**: Easier to add new resources or modify existing ones
6. **Standardized Disabled State**: All components respect `can_edit` flag uniformly

## Related Documentation

- [API v4 Standards](../api/v4/STANDARDS.md) - API endpoint standards
- [WebSocket v4 Standards](../socket/v4/STANDARDS.md) - WebSocket event standards
