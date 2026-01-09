# SQL Return Structure Guidelines

This document defines the standards and best practices for structuring `RETURNS TABLE` clauses in PostgreSQL functions. These guidelines ensure consistency, maintainability, and predictable data structures across all SQL functions.

## Overview

All SQL functions that return data should follow a consistent structure for their `RETURNS TABLE` clause. This ensures:

- **Consistency**: Frontend code can reliably expect fields in a predictable order
- **Maintainability**: Developers know where to find specific fields
- **Type Safety**: Consistent patterns make type generation and validation easier
- **Clarity**: The structure itself documents the data model

## Required Fields (First 4)

**All functions must start with these four required fields:**

1. **`actor_name`** (text) - The name of the actor/user performing the operation (for audit logging)
2. **`{artifact}_exists`** (boolean) - Whether the artifact exists (e.g., `persona_exists`, `agent_exists`)
3. **`can_edit`** (boolean) - Whether the current user has edit permissions
4. **`disabled_reason`** (text, nullable) - Human-readable explanation of why editing is disabled (NULL if `can_edit = true`)

**Example:**
```sql
RETURNS TABLE (
    actor_name text,
    persona_exists boolean,
    can_edit boolean,
    disabled_reason text,
    -- ... rest of fields
)
```

## Resource Field Patterns

After the required fields, resources follow consistent patterns based on whether they are single-select or multi-select.

### Single-Select Resources

**Pattern:** `{resource}_id`, `{resource}_resource`, `show_{resource}`, `{resource}_suggestions`, `{resource}` (optional array)

**Order:**
1. `{resource}_id` (uuid) - The selected resource ID
2. `{resource}_resource` (composite type) - The selected resource object (includes `generated` boolean field)
3. `show_{resource}` (boolean) - Whether to show this resource picker (based on whether options exist)
4. `{resource}_suggestions` (uuid[]) - Array of suggested resource IDs (always UUIDs, never text)
5. `{resource}` (array, optional) - All available options array (only for resources with options like colors/icons; each option includes `generated` boolean)

**Note:** The `{resource}_resource` composite type includes a `generated` boolean field that indicates if the resource was AI-generated. This enables regeneration workflows where users can regenerate resources with custom instructions.

**Examples:**
- **name**: `name_id`, `name_resource`, `show_name`, `name_suggestions`
- **description**: `description_id`, `description_resource`, `show_description`, `description_suggestions`
- **color**: `color_id`, `color_resource`, `show_color`, `color_suggestions`, `colors` (all available colors)
- **icon**: `icon_id`, `icon_resource`, `show_icon`, `icon_suggestions`, `icons` (all available icons)
- **instructions**: `instructions_id`, `instructions_resource`, `show_instructions`, `instructions_suggestions`
- **flag**: `active_flag_id`, `flag_resource`, `show_flag` (can be false for consistency), (no suggestions)

**Note:** For resources with options arrays (like `colors`, `icons`), the array comes **last** in that resource's group.

### Multi-Select Resources

**Pattern:** `{resource}_ids`, `{resource}_resources`, `show_{resource}`, `{resource}_suggestions`, `{resource}` (array comes last)

**Order:**
1. `{resource}_ids` (uuid[]) - Array of selected resource IDs
2. `{resource}_resources` (composite_type[]) - Array of selected resource objects (each includes `generated` boolean)
3. `show_{resource}` (boolean) - Whether to show this resource picker
4. `{resource}_suggestions` (uuid[]) - Array of suggested resource IDs (always UUIDs)
5. `{resource}` (composite_type[]) - **All available options array (comes last; each includes `generated` boolean)**

**Note:** Each resource object in the arrays includes a `generated` boolean field that indicates if that specific resource was AI-generated. This provides a single standard pattern for both single-select and multi-select resources.

**Examples:**
- **departments**: `department_ids`, `department_resources`, `show_departments`, `department_suggestions`, `departments` (all available)
- **fields**: `field_ids`, `field_resources`, `show_fields`, `field_suggestions`, `fields` (all available)
- **examples**: `example_ids`, `example_resources`, `show_examples`, `example_suggestions`, `examples` (all available)

**Key Point:** The full array (`{resource}`) always comes **last** in the multi-select resource group, after IDs, resources, show flag, and suggestions.

## Suggestions Standardization

**⚠️ CRITICAL: All suggestions must be UUID arrays, never text arrays.**

- **Always return resource IDs**: Suggestions should return `uuid[]` arrays containing the IDs of suggested resources
- **Never return text values**: Do not return text arrays with names, descriptions, or other text values
- **Consistent type**: All `{resource}_suggestions` fields must be `uuid[]` type

**Why:**
- Frontend can look up full resource objects using IDs
- Consistent type makes type generation and validation easier
- IDs are stable identifiers, text values may change

**Example:**
```sql
-- ❌ WRONG: Returns text array
name_suggestions text[]

-- ✅ CORRECT: Returns UUID array
name_suggestions uuid[]
```

## Show Flags

**All resources must have a `show_{resource}` boolean flag.**

**Purpose:**
- Indicates whether the UI should display the resource picker/selector
- For single-select resources: Based on whether options exist (e.g., `show_color = colors.length > 0`)
- For multi-select resources: Based on business logic (e.g., `show_departments = user has multiple departments`)
- For flag resource: Can be `false` for consistency (as it's just a boolean toggle)

**Implementation:**
```sql
-- Single-select: Based on options array
show_color boolean,  -- true if colors array has items

-- Multi-select: Based on business logic
show_departments boolean,  -- true if user has multiple departments
show_fields boolean,  -- true if fields exist
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
    name_resource types.q_get_persona_v4_name_resource,  -- Includes: id, name, generated
    show_name boolean,
    name_suggestions uuid[],
    
    -- Single-select resources: description
    description_id uuid,
    description_resource types.q_get_persona_v4_description_resource,  -- Includes: id, description, generated
    show_description boolean,
    description_suggestions uuid[],
    
    -- Single-select resources: color
    color_id uuid,
    color_resource types.q_get_persona_v4_color_resource,  -- Includes: id, name, description, hex_code, generated
    show_color boolean,
    color_suggestions uuid[],
    colors types.q_get_persona_v4_color_option[],  -- Array comes last; each includes generated
    
    -- Single-select resources: icon
    icon_id uuid,
    icon_resource types.q_get_persona_v4_icon_resource,  -- Includes: id, name, description, value, generated
    show_icon boolean,
    icon_suggestions uuid[],
    icons types.q_get_persona_v4_icon_option[],  -- Array comes last; each includes generated
    
    -- Single-select resources: instructions
    instructions_id uuid,
    instructions_resource types.q_get_persona_v4_instructions_resource,  -- Includes: id, template, generated
    show_instructions boolean,
    instructions_suggestions uuid[],
    
    -- Single-select resources: flag
    active_flag_id uuid,
    flag_resource types.q_get_persona_v4_flag_resource,  -- Includes: id, name, description, icon_id, generated
    show_flag boolean,
    
    -- Multi-select resources: departments
    department_ids uuid[],
    department_resources types.q_get_persona_v4_department[],  -- Each includes: department_id, name, description, generated
    show_departments boolean,
    department_suggestions uuid[],
    departments types.q_get_persona_v4_department[],  -- Array comes last; each includes generated
    
    -- Multi-select resources: fields
    field_ids uuid[],
    field_resources types.q_get_persona_v4_field[],  -- Each includes: field_id, name, description, generated
    show_fields boolean,
    field_suggestions uuid[],
    fields types.q_get_persona_v4_field[],  -- Array comes last; each includes generated
    
    -- Multi-select resources: examples
    example_ids uuid[],
    example_resources types.q_get_persona_v4_example[],  -- Each includes: example, idx, generated
    show_examples boolean,
    example_suggestions uuid[],
    examples types.q_get_persona_v4_example[]  -- Array comes last; each includes generated
)
```

## SELECT Clause Ordering

**The SELECT clause must match the RETURN TABLE order exactly.**

- Fields in SELECT must be in the same order as RETURN TABLE
- This ensures consistency and makes debugging easier
- Type generation relies on field order matching

## Key Principles Summary

1. **Required fields first**: `actor_name`, `{artifact}_exists`, `can_edit`, `disabled_reason`
2. **Consistent resource patterns**: Single-select vs multi-select follow their respective patterns
3. **Show flags for all**: Every resource has a `show_{resource}` boolean
4. **Generated field in resources**: All resource composite types include a `generated` boolean field to track AI generation
5. **Suggestions are UUIDs**: All `{resource}_suggestions` fields are `uuid[]`, never `text[]`
6. **Arrays come last**: For resources with option arrays, the array comes last in that resource's group
7. **Multi-select arrays last**: The full `{resource}` array comes last in multi-select resource groups
8. **SELECT matches RETURN**: SELECT clause order must match RETURN TABLE order exactly

## Migration Checklist

When updating an existing SQL function to follow these guidelines:

- [ ] Move required fields (`actor_name`, `{artifact}_exists`, `can_edit`, `disabled_reason`) to the top
- [ ] Add `show_{resource}` flags for all resources
- [ ] Convert text-based suggestions to UUID arrays
- [ ] Reorder fields to follow single-select/multi-select patterns
- [ ] Move option arrays to come last in their resource groups
- [ ] Move multi-select full arrays to come last in their groups
- [ ] Update SELECT clause to match RETURN TABLE order
- [ ] Test SQL compilation with `make sql-compile`
- [ ] Update frontend code if needed for UUID-based suggestions

## Frontend Component Props Standards

**This section documents how the SQL return structure maps to frontend component props, ensuring consistency between server and client.**

### Mapping SQL Return Structure to Component Props

The standardized SQL return structure directly maps to standardized component props. This eliminates the need for type casting, mapping, or transformation at the top level.

### Standardized Component Props

#### Single-Select Resources

**Props Pattern:**
- `{resource}_id`: `string | null` - Current resource ID (from SQL `{resource}_id`)
- `{resource}_resource`: `{ id: string; ...; generated: boolean } | null` - Resource object (from SQL `{resource}_resource`; includes `generated` field)
- `show_{resource}`: `boolean` - Whether to show picker (from SQL `show_{resource}`)
- `{resource}_suggestions`: `string[]` - Suggested resource IDs (from SQL `{resource}_suggestions`)
- `{resource}`?: `Array<{ ...; generated: boolean }>` - All available options (from SQL `{resource}` array, for color/icon; each includes `generated`)
- `disabled`: `boolean` - Based on `can_edit` flag (inverted: `disabled = !can_edit`)
- `onChange`: `(id: string | null) => void` - Callback to update resource ID
- `onGenerate?`: `() => Promise<void>` - Optional AI generation handler
- `isGenerating?`: `boolean` - Optional generation state
- `create{Resource}Action?`: Action for creating new resources

**Accessing Generated Status:**
- Single-select: `name_resource?.generated ?? false` - Check if the selected resource was AI-generated
- Options arrays: `colors.find(c => c.id === color_id)?.generated ?? false` - Check if a specific option was generated

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
- `{resource}_resources`: `Array<{ id: string; ...; generated: boolean }>` - Selected resources (from SQL `{resource}_resources`; each includes `generated`)
- `show_{resource}`: `boolean` - Whether to show picker (from SQL `show_{resource}`)
- `{resource}_suggestions`: `string[]` - Suggested resource IDs (from SQL `{resource}_suggestions`)
- `{resource}`: `Array<{ id: string; ...; generated: boolean }>` - All available options (from SQL `{resource}` array; each includes `generated`)
- `disabled`: `boolean` - Based on `can_edit` flag (inverted: `disabled = !can_edit`)
- `onChange`: `(ids: string[]) => void` - Callback to update resource IDs array

**Accessing Generated Status:**
- Multi-select: `department_resources.some(d => d.generated)` - Check if any selected resource was generated
- Individual check: `department_resources.find(d => d.department_id === id)?.generated ?? false` - Check if a specific resource was generated

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
