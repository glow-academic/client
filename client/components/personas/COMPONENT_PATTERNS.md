# Persona Component Patterns

This document describes the patterns and conventions used in the Persona components (`PersonaNew.tsx`, `Persona.tsx`, `Personas.tsx`) and how they integrate with resource components. This serves as a reference for developers working on similar components or extending the persona functionality.

## Overview

The Persona components follow a standardized pattern that:
- Uses server actions for all backend communication
- Integrates with resource components (`Names`, `Colors`, `Icons`, etc.) via standardized props
- Handles form state management with URL-backed search params and local form state
- Manages AI generation workflows via WebSocket connections
- Respects `can_edit` and `disabled_reason` flags from the API

## Component Hierarchy

```
PersonaNew.tsx (or Persona.tsx)
  ├── ReadOnlyBanner (shows disabled_reason when can_edit = false)
  ├── GenericForm (manages form steps and URL state)
  │   └── StepCard (individual form steps)
  │       └── Resource Components (Names, Colors, Icons, etc.)
  └── GenerateRegenerateModal (for multi-resource generation)
```

## Key Patterns

### 1. Disabled State Management

**Pattern:** Check `can_edit` in both new and edit modes, not just edit mode.

```typescript
// ✅ CORRECT: Check can_edit in both modes
const disabled = useMemo(() => {
  if (!personaData) return false;
  return !personaData.can_edit;
}, [personaData]);

// ❌ WRONG: Only checking in edit mode
const disabled = useMemo(() => {
  if (!isEditMode || !personaData) return false;
  return !personaData.can_edit;
}, [isEditMode, personaData]);
```

**Why:** When no agents/tools are configured, `can_edit` becomes `false` even in new mode. The `disabled_reason` explains why (e.g., "No tool configured for name, color, icon, instructions"). The `ReadOnlyBanner` component displays this reason to users.

**Usage:**
```typescript
<ReadOnlyBanner
  disabled={disabled}
  disabledReason={personaData?.disabled_reason ?? null}
  entityType="persona"
/>
```

### 2. Form State Management

**Pattern:** Split state into URL-backed (search params) and local (form state).

**URL-Backed State (via nuqs):**
- Search params: `colorSearch`, `iconSearch`
- Filter params: `colorShowSelected`, `iconShowSelected`
- Draft ID: `draftId`

**Local Form State:**
- Resource IDs: `name_id`, `color_id`, `icon_id`, etc.
- Not stored in URL (too many fields, would clutter URL)

**Implementation:**
```typescript
// URL-backed state parsers (passed to GenericForm)
const personaSearchParamsClient = useMemo(
  () => ({
    draftId: parseAsString,
    colorSearch: parseAsString,
    iconSearch: parseAsString,
    colorShowSelected: parseAsBoolean,
    iconShowSelected: parseAsBoolean,
  }),
  []
);

// Local form state (resource IDs only)
const [formState, setFormState] = useState<PersonaFormState>({
  name_id: null,
  color_id: null,
  icon_id: null,
  // ... other resource IDs
});
```

### 3. Resource Component Props Pattern

**Pattern:** Pass props directly from API response without type casting or transformation.

**Standard Props for Single-Select Resources:**
```typescript
<Names
  name_id={personaData?.name_id ?? null}
  name_resource={personaData?.name_resource ?? null}
  show_name={personaData?.show_name ?? true}
  name_suggestions={personaData?.name_suggestions ?? []}
  names={personaData?.names ?? []}  // Suggested options only
  disabled={disabled}
  onNameIdChange={(id) => setFormState(prev => ({ ...prev, name_id: id }))}
  onGenerate={handleGenerateName}
  isGenerating={isGenerating("names")}
  createNamesAction={createNamesAction}
/>
```

**Standard Props for Multi-Select Resources:**
```typescript
<Departments
  department_ids={personaData?.department_ids ?? []}
  department_resources={personaData?.department_resources ?? []}
  show_departments={personaData?.show_departments ?? false}
  department_suggestions={personaData?.department_suggestions ?? []}
  departments={personaData?.departments ?? []}  // All available options
  disabled={disabled}
  onDepartmentIdsChange={(ids) => setFormState(prev => ({ ...prev, department_ids: ids }))}
/>
```

**Key Points:**
- Use nullish coalescing (`??`) for default values
- Pass props directly from `personaData` - no type casting or mapping
- Resource components handle their own internal state and display logic
- `disabled` prop is computed once at top level and passed to all components

### 4. AI Generation Workflow

**Pattern:** Use WebSocket for generation, manage state with `generatingResources` Set.

**State Management:**
```typescript
const [generatingResources, setGeneratingResources] = useState<Set<ResourceType>>(new Set());

const isGenerating = useCallback(
  (resourceType: ResourceType) => generatingResources.has(resourceType),
  [generatingResources]
);
```

**Generation Handler:**
```typescript
const handleGenerateResources = useCallback(
  async (resourceTypes: ResourceType[]) => {
    // Add to generating set
    setGeneratingResources(prev => {
      const next = new Set(prev);
      resourceTypes.forEach(rt => next.add(rt));
      return next;
    });

    try {
      // Emit WebSocket event
      socket.emit("persona:generate", {
        persona_id: personaId,
        draft_id: draftId,
        resources: resourceTypes,
        // ... other params
      });

      // Wait for completion (handled by WebSocket listener)
      // State updates happen via WebSocket events
    } finally {
      // Remove from generating set
      setGeneratingResources(prev => {
        const next = new Set(prev);
        resourceTypes.forEach(rt => next.delete(rt));
        return next;
      });
    }
  },
  [socket, draftId, personaId, /* ... */]
);
```

**Individual Handlers:**
```typescript
const handleGenerateName = useCallback(
  async () => handleGenerateResources(["names"]),
  [handleGenerateResources]
);
```

### 5. Component Memoization

**Pattern:** Memoize top-level component to prevent re-renders when only prop references change.

```typescript
export default React.memo(PersonaNewComponent, (prevProps, nextProps) => {
  // Compare personaData by resource IDs, not object reference
  const prevIds = {
    name_id: prevProps.personaData?.name_id,
    color_id: prevProps.personaData?.color_id,
    // ... other IDs
  };
  const nextIds = {
    name_id: nextProps.personaData?.name_id,
    color_id: nextProps.personaData?.color_id,
    // ... other IDs
  };

  // Compare primitive props
  if (
    prevProps.personaId !== nextProps.personaId ||
    JSON.stringify(prevIds) !== JSON.stringify(nextIds)
  ) {
    return false; // Props changed, re-render
  }

  return true; // Props unchanged, skip re-render
});
```

**Why:** Server-side data objects may have new references on each render even if content is identical. Comparing by resource IDs prevents unnecessary re-renders.

### 6. Resource Component Integration

**Pattern:** Resource components handle their own display logic, including `show_{resource}` checks.

**Top-Level Component:**
```typescript
// ✅ CORRECT: Don't conditionally render based on show_{resource}
// Let the component handle it internally
<Names
  show_name={personaData?.show_name ?? true}
  // ... other props
/>

// ❌ WRONG: Conditional rendering at top level
{personaData?.show_name && (
  <Names ... />
)}
```

**Resource Component:**
```typescript
export function Names({ show_name = true, /* ... */ }: NamesProps) {
  // Component handles its own show logic
  if (!show_name) {
    return null;
  }

  // ... render component
}
```

### 7. Suggested vs All Options Arrays

**Pattern:** Two types of option arrays - suggested only vs all available.

**Suggested Only (Names, Descriptions, Instructions):**
- Array contains only resources matching `{resource}_suggestions` IDs
- Used for previously AI-generated resources
- Example: `names` array contains only names with IDs in `name_suggestions`

**All Available (Colors, Icons):**
- Array contains all valid options in the system
- Used for predefined option sets
- Example: `colors` array contains all color options

**Usage:**
```typescript
// Suggested only - use GenericPicker with suggestions
<Names
  name_suggestions={personaData?.name_suggestions ?? []}
  names={personaData?.names ?? []}  // Only suggested options
  // ...
/>

// All available - use GenericPicker with all options
<Colors
  color_suggestions={personaData?.color_suggestions ?? []}
  colors={personaData?.colors ?? []}  // All available options
  // ...
/>
```

### 8. Server Actions Pattern

**Pattern:** Use server actions for all backend communication, not direct API calls.

**Server Actions:**
```typescript
// Defined in page.tsx (server component)
const savePersona = async (input: SavePersonaIn) => {
  "use server";
  return await savePersonaAction(input);
};

// Passed as props to client component
<PersonaNew
  savePersonaAction={savePersona}
  createNamesAction={createDraftNames}
  // ... other actions
/>
```

**Client Component Usage:**
```typescript
const handleSubmit = async (formData: PersonaFormState) => {
  await savePersonaAction({
    persona_id: personaId,
    // ... form data
  });
};
```

### 9. Breadcrumb Context

**Pattern:** Set breadcrumb context when persona data loads in edit mode.

```typescript
useEffect(() => {
  const personaName = personaData?.name_resource?.name;
  if (personaName && personaId && isEditMode) {
    setEntityMetadata({
      entityId: personaId,
      entityName: personaName,
      entityType: "persona",
    });
  }
  return () => clearEntityMetadata();
}, [personaData, personaId, isEditMode, setEntityMetadata, clearEntityMetadata]);
```

## Common Pitfalls

### 1. Only Checking `can_edit` in Edit Mode

**Problem:** When no agents/tools are configured, `can_edit` is `false` even in new mode. Users won't see the `disabled_reason` explaining why.

**Solution:** Check `can_edit` in both modes:
```typescript
const disabled = useMemo(() => {
  if (!personaData) return false;
  return !personaData.can_edit;
}, [personaData]);
```

### 2. Type Casting API Response

**Problem:** Type casting adds complexity and can hide type mismatches.

**Solution:** Use props directly from API response:
```typescript
// ✅ CORRECT
name_resource={personaData?.name_resource ?? null}

// ❌ WRONG
name_resource={(personaData as PersonaDetailOut & { name_resource?: ... })?.name_resource || null}
```

### 3. Conditional Rendering Based on `show_{resource}`

**Problem:** Duplicates logic that resource components already handle.

**Solution:** Always render components, let them handle `show_{resource}` internally.

### 4. Not Memoizing Callbacks

**Problem:** Callbacks recreated on every render cause unnecessary re-renders of child components.

**Solution:** Use `useCallback` for handlers:
```typescript
const handleGenerateName = useCallback(
  async () => handleGenerateResources(["names"]),
  [handleGenerateResources]
);
```

## Related Documentation

- [SQL Return Structure Guidelines](../../../server/app/sql/v4/RETURN_STRUCTURE_GUIDELINES.md) - Server-side structure standards
- [API v4 Standards](../../../server/app/api/v4/STANDARDS.md) - API endpoint standards
- [WebSocket v4 Standards](../../../server/app/socket/v4/STANDARDS.md) - WebSocket event standards
