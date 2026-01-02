# Form Section Component Migration Guide

## Overview

This document describes the migration from resource-specific section components (e.g., `PersonaColorSection`, `PersonaIconSection`, `PersonaContentSection`) to generic, reusable components (`StepCard`, `SelectableGrid`, `ReorderableList`). This pattern standardizes form handling across all new/detail pages (Persona, Scenario, Document, Parameter, etc.).

## Key Principles

1. **Search/filter built into card**: StepCard includes search bar and filter - not separate components
2. **No over-abstraction**: No ColorPicker/IconPicker - just SelectableGrid with different `renderItem` functions
3. **Function-based extraction**: Like GenericPicker, use functions for flexibility (`getId`, `renderItem`)
4. **Thin wrapper**: Form components are just configuration, no presentation logic
5. **Reusable**: Components work for Persona, Scenario, Document, Parameter, etc.
6. **Inline extra components**: When migrating components (especially when adding draft support), **move any extra components inline** - the logic will be cleaner and can be handled with generic components. Avoid creating resource-specific section components - instead, use generic components with inline configuration.

## Component Architecture

### Pattern Structure

All form sections follow this pattern:

```
StepCard (with search/filter built in)
  └── SelectableGrid (for selectable items) OR
  └── ReorderableList (for drag-and-drop lists) OR
  └── Custom content (for special cases)
```

**Key insight**: The only difference between cards is the selectable items content. Search bar and filter are built into the card itself.

## Components

### StepCard

**File**: `client/components/common/forms/StepCard.tsx`

Card wrapper with step header, search bar, and filter built in.

**Features**:
- Step badge (number or checkmark) on left
- Title and description
- Optional action buttons in top right (Shuffle, Reset, etc.)
- **Search bar** with Search icon (border-b styling) - built into CardContent
- **Optional filter button** on the right side of search bar (with badge indicator when active)
- Filter popover with checkboxes and Apply button (handles temporary state)
- Status-based styling (ring-2 ring-primary for active, opacity-50 for pending)

**Props**:
```typescript
interface StepCardProps {
  stepStatus: StepStatus;
  stepNumber: number;
  stepTitle: string;
  stepDescription: string;
  isReadonly?: boolean;
  isEditMode?: boolean;
  className?: string;
  // Optional action buttons in top right
  actions?: React.ReactNode;
  // Search bar configuration (built into card)
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  searchPlaceholder?: string;
  // Filter configuration (built into card)
  filters?: Array<{
    key: string;
    label: string;
    value: boolean;
    onChange: (value: boolean) => void;
  }>;
  children: React.ReactNode;
}
```

**Usage Example**:
```typescript
<StepCard
  stepStatus={stepStatus}
  stepNumber={stepNumber}
  stepTitle={stepTitle}
  stepDescription={stepDescription}
  isReadonly={isReadonly}
  isEditMode={isEditMode}
  searchTerm={searchTerm}
  onSearchChange={setSearchTerm}
  searchPlaceholder="Search items..."
  filters={[
    {
      key: "showSelected",
      label: "Show selected",
      value: showSelected,
      onChange: (value) => setShowSelected(value),
    },
  ]}
>
  {/* Content goes here */}
</StepCard>
```

### SelectableGrid

**File**: `client/components/common/forms/SelectableGrid.tsx`

Generic grid of selectable cards with function-based rendering.

**Features**:
- Grid layout (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
- Scrollable container (max-h-[272px] by default)
- Empty state when no items
- Function-based item rendering (like GenericPicker)
- Single-select or multi-select support

**Props**:
```typescript
interface SelectableGridProps<T> {
  items: T[];
  selectedId: string | null; // For single-select
  selectedIds?: string[]; // For multi-select
  onSelect: (id: string) => void;
  getId: (item: T) => string;
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  emptyMessage?: string;
  maxHeight?: string;
  className?: string;
  disabled?: boolean;
}
```

**Usage Example - Colors**:
```typescript
const [colorSearchTerm, setColorSearchTerm] = useState("");
const filteredColors = useMemo(() => {
  if (!colorSearchTerm.trim()) return presetColors;
  const searchLower = colorSearchTerm.toLowerCase();
  return presetColors.filter((colorValue) => {
    const colorName = getColorName(colorValue).toLowerCase();
    return colorName.includes(searchLower) || colorValue.toLowerCase().includes(searchLower);
  });
}, [presetColors, colorSearchTerm]);

<SelectableGrid
  items={filteredColors}
  selectedId={formData.color || "#000000"}
  onSelect={(color) => setFormData({ color })}
  getId={(color) => color}
  renderItem={(color, isSelected) => (
    <div
      className={cn(
        "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
        "hover:shadow-md hover:bg-accent/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isSelected && "ring-2 ring-primary bg-accent"
      )}
    >
      {isSelected && (
        <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
          <Check className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      )}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg border-2 border-border shrink-0"
          style={{ backgroundColor: color }}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm leading-tight">
            {getColorName(color)}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {color}
          </p>
        </div>
      </div>
    </div>
  )}
  emptyMessage="No colors found. Try adjusting your search."
  disabled={isReadonly}
/>
```

**Usage Example - Icons**:
```typescript
<SelectableGrid
  items={filteredIcons}
  selectedId={formData.icon || "Zap"}
  onSelect={(icon) => setFormData({ icon })}
  getId={(icon) => icon}
  renderItem={(iconName, isSelected) => {
    const IconComponent = PERSONA_ICON_MAP[iconName as keyof typeof PERSONA_ICON_MAP];
    if (!IconComponent) return null;
    const isSuggested = suggestedIcons.includes(iconName);

    return (
      <div
        className={cn(
          "relative flex flex-col gap-3 p-4 rounded-xl border bg-card text-card-foreground shadow-sm transition-all text-left",
          "hover:shadow-md hover:bg-accent/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isSelected && "ring-2 ring-primary bg-accent"
        )}
      >
        {isSelected && (
          <div className="absolute top-2 right-2 z-10 h-6 w-6 bg-primary rounded-full flex items-center justify-center">
            <Check className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
        )}
        {isSuggested && !isSelected && (
          <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded">
            Suggested
          </div>
        )}
        <div className="flex flex-col items-center gap-2">
          <IconComponent className="h-8 w-8 text-foreground" />
          <span className="text-sm font-medium text-center">
            {iconName}
          </span>
        </div>
      </div>
    );
  }}
  emptyMessage="No icons found. Try adjusting your search."
  disabled={isReadonly}
/>
```

### ReorderableList

**File**: `client/components/common/forms/ReorderableList.tsx`

Drag-and-drop list with autocomplete suggestions.

**Features**:
- Drag-and-drop reordering
- Add/remove items
- Autocomplete suggestions
- Function-based item rendering (optional - defaults to string input)

**Props**:
```typescript
interface ReorderableListProps<T extends string = string> {
  items: T[];
  onItemsChange: (items: T[]) => void;
  renderItem?: (item: T, index: number, handlers: {
    onDragStart: (e: React.DragEvent) => void;
    onRemove: () => void;
  }) => React.ReactNode;
  suggestions?: string[];
  maxItems?: number;
  addButtonLabel?: string;
  disabled?: boolean;
}
```

**Usage Example**:
```typescript
<ReorderableList
  items={currentExamples}
  onItemsChange={setCurrentExamples}
  suggestions={examplesHistory}
  maxItems={10}
  addButtonLabel="Add example"
  disabled={isReadonly}
/>
```

## Migration Pattern

### Before (Resource-Specific Components)

```typescript
// Persona.tsx
case "color":
  return (
    <PersonaColorSection
      color={formData.color || "#000000"}
      presetColors={presetColors}
      onColorChange={(color) => setFormData({ color })}
      stepStatus={stepStatus}
      stepNumber={stepNumber}
      stepTitle={stepTitle}
      stepDescription={stepDescription}
      isReadonly={isReadonly}
    />
  );
```

**Problems**:
- Duplicate step header logic across components
- Separate component files for each section type
- Hard to reuse patterns across resources
- Presentation logic mixed with configuration

### After (Generic Components)

```typescript
// Persona.tsx
case "color": {
  const [colorSearchTerm, setColorSearchTerm] = useState("");
  const filteredColors = useMemo(() => {
    if (!colorSearchTerm.trim()) return presetColors;
    const searchLower = colorSearchTerm.toLowerCase();
    return presetColors.filter((colorValue) => {
      const colorName = getColorName(colorValue).toLowerCase();
      return colorName.includes(searchLower) || colorValue.toLowerCase().includes(searchLower);
    });
  }, [presetColors, colorSearchTerm]);

  return (
    <StepCard
      stepStatus={stepStatus}
      stepNumber={stepNumber}
      stepTitle={stepTitle}
      stepDescription={stepDescription}
      isReadonly={isReadonly}
      isEditMode={isEditMode}
      searchTerm={colorSearchTerm}
      onSearchChange={setColorSearchTerm}
      searchPlaceholder="Search colors..."
    >
      <SelectableGrid
        items={filteredColors}
        selectedId={formData.color || "#000000"}
        onSelect={(color) => setFormData({ color })}
        getId={(color) => color}
        renderItem={(color, isSelected) => (
          // Inline renderItem function
          <ColorCard color={color} isSelected={isSelected} />
        )}
        disabled={isReadonly}
      />
      {/* Additional content like hex input */}
    </StepCard>
  );
}
```

**Benefits**:
- Step header logic centralized in StepCard
- Search/filter built into card
- Easy to add new sections (just configure components)
- Consistent patterns across all forms
- Presentation logic in reusable components

## New/Detail Page Structure

### Standard Form Structure

```typescript
export default function ResourceForm({ ... }: ResourceProps) {
  // 1. State management (nuqs-backed)
  const [formData, setFormData] = useQueryStates(resourceSearchParamsClient, {
    history: "replace",
    shallow: false,
  });

  // 2. Search state (local, not in URL)
  const [sectionSearchTerm, setSectionSearchTerm] = useState("");

  // 3. Filtered items (computed from search)
  const filteredItems = useMemo(() => {
    if (!sectionSearchTerm.trim()) return allItems;
    const searchLower = sectionSearchTerm.toLowerCase();
    return allItems.filter((item) => {
      // Filter logic
    });
  }, [allItems, sectionSearchTerm]);

  // 4. Step status calculation
  const getStepStatus = useCallback(
    (stepId: string, formData: Record<string, unknown>): StepStatus => {
      // Status logic
    },
    []
  );

  // 5. Steps configuration
  const steps = useMemo(() => [
    { id: "basic", title: "Basic Information", description: "..." },
    { id: "section1", title: "Section 1", description: "..." },
    // ...
  ], []);

  return (
    <form onSubmit={handleSubmit}>
      <GenericForm
        nuqsParsers={resourceSearchParamsClient}
        steps={steps}
        getStepStatus={getStepStatus}
        formData={formData}
        setFormData={setFormData}
        isReadonly={isReadonly}
        isEditMode={isEditMode}
        renderStep={({ stepId, stepStatus, stepTitle, stepDescription, stepNumber, formData: stepFormData, setFormData: setStepFormData }) => {
          switch (stepId) {
            case "basic":
              // Basic info section (can use StepCard or custom Card)
              return <BasicInfoSection ... />;

            case "section1":
              // Selectable items section
              return (
                <StepCard
                  stepStatus={stepStatus}
                  stepNumber={stepNumber}
                  stepTitle={stepTitle}
                  stepDescription={stepDescription}
                  isReadonly={isReadonly}
                  isEditMode={isEditMode}
                  searchTerm={sectionSearchTerm}
                  onSearchChange={setSectionSearchTerm}
                  searchPlaceholder="Search items..."
                  filters={[
                    {
                      key: "showSelected",
                      label: "Show selected",
                      value: showSelected,
                      onChange: (value) => setShowSelected(value),
                    },
                  ]}
                >
                  <SelectableGrid
                    items={filteredItems}
                    selectedId={stepFormData.itemId}
                    onSelect={(id) => setStepFormData({ itemId: id })}
                    getId={(item) => item.id}
                    renderItem={(item, isSelected) => (
                      // Custom renderItem function
                      <ItemCard item={item} isSelected={isSelected} />
                    )}
                    disabled={isReadonly}
                  />
                </StepCard>
              );

            case "content":
              // Reorderable list section
              return (
                <StepCard
                  stepStatus={stepStatus}
                  stepNumber={stepNumber}
                  stepTitle={stepTitle}
                  stepDescription={stepDescription}
                  isReadonly={isReadonly}
                  isEditMode={isEditMode}
                >
                  <ReorderableList
                    items={currentItems}
                    onItemsChange={setCurrentItems}
                    suggestions={itemsHistory}
                    maxItems={10}
                    addButtonLabel="Add item"
                    disabled={isReadonly}
                  />
                </StepCard>
              );

            default:
              return null;
          }
        }}
      />
    </form>
  );
}
```

## Migration Checklist

When migrating a resource-specific section component:

1. **Identify the pattern**:
   - Does it have a step header? → Use StepCard
   - Does it have selectable items? → Use SelectableGrid
   - Does it have a reorderable list? → Use ReorderableList
   - Does it have search/filter? → Build into StepCard

2. **Extract search state**:
   - Move search state to parent component (local useState, not URL-backed)
   - Create filtered items useMemo in parent

3. **Create renderItem function**:
   - Extract item rendering logic into inline `renderItem` function
   - Pass item-specific data via closure (e.g., `suggestedIcons`, `getColorName`)
   - **Keep renderItem inline** in the switch case - don't extract to separate component

4. **Replace section component**:
   - Replace `<ResourceSection>` with `<StepCard>` + `<SelectableGrid>` or `<ReorderableList>`
   - Move all props to inline configuration
   - **Inline everything** - avoid creating new resource-specific components

5. **Delete old component**:
   - Remove resource-specific section component file
   - Update imports

**⚠️ Important**: When migrating components to use drafts, this is the perfect opportunity to inline any extra components. The logic will be cleaner and can be handled with generic components (`StepCard`, `SelectableGrid`, `ReorderableList`, `GenericPicker`). See the "Draft Autosave Pattern" section for more details on component structure during draft migration.

## Common Patterns

### Pattern 1: Selectable Items with Search

```typescript
// State
const [searchTerm, setSearchTerm] = useState("");
const filteredItems = useMemo(() => {
  if (!searchTerm.trim()) return allItems;
  return allItems.filter(/* filter logic */);
}, [allItems, searchTerm]);

// Render
<StepCard
  searchTerm={searchTerm}
  onSearchChange={setSearchTerm}
  searchPlaceholder="Search items..."
>
  <SelectableGrid
    items={filteredItems}
    selectedId={selectedId}
    onSelect={(id) => setFormData({ itemId: id })}
    getId={(item) => item.id}
    renderItem={(item, isSelected) => <ItemCard item={item} isSelected={isSelected} />}
  />
</StepCard>
```

### Pattern 2: Selectable Items with Filter

```typescript
// State
const [showSelected, setShowSelected] = useState(false);

// Render
<StepCard
  searchTerm={searchTerm}
  onSearchChange={setSearchTerm}
  filters={[
    {
      key: "showSelected",
      label: "Show selected",
      value: showSelected,
      onChange: (value) => setShowSelected(value),
    },
  ]}
>
  <SelectableGrid ... />
</StepCard>
```

### Pattern 3: Reorderable List with Autocomplete

```typescript
// State
const [items, setItems] = useState<string[]>([]);
const suggestions = useMemo(() => {
  // Compute suggestions from history/data
}, [data]);

// Render
<StepCard>
  <ReorderableList
    items={items}
    onItemsChange={setItems}
    suggestions={suggestions}
    maxItems={10}
    addButtonLabel="Add item"
    disabled={isReadonly}
  />
</StepCard>
```

### Pattern 4: Multiple Sections in One Step

```typescript
<StepCard>
  {/* Section 1 */}
  <div className="space-y-2">
    <Label>Field 1</Label>
    <Input ... />
  </div>

  {/* Section 2 */}
  <SelectableGrid ... />

  {/* Section 3 */}
  <ReorderableList ... />
</StepCard>
```

## Examples

### Persona.tsx Migration

**Before**: 3 separate section components (~984 lines total)
- `PersonaColorSection.tsx` (~329 lines)
- `PersonaIconSection.tsx` (~176 lines)
- `PersonaContentSection.tsx` (~335 lines)

**After**: Inline generic components (~1321 lines, but more configuration)
- StepCard for all sections
- SelectableGrid for colors/icons
- ReorderableList for examples
- All search/filter logic in parent

**Key Changes**:
1. Moved `getColorName` utility to Persona.tsx
2. Added `colorSearchTerm` and `iconSearchTerm` state
3. Created `filteredColors` and `filteredIcons` useMemo hooks
4. Replaced section components with StepCard + SelectableGrid/ReorderableList
5. Inline `renderItem` functions for colors and icons

## Best Practices

1. **Keep search state local**: Don't put search terms in URL params (use local useState)
2. **Filter in useMemo**: Always filter items in useMemo for performance
3. **Inline renderItem**: Keep renderItem functions inline in the switch case for clarity
4. **Extract utilities**: Move reusable utilities (like `getColorName`) to the parent component or a utils file
5. **Consistent styling**: Use the same card styling pattern across all SelectableGrid items
6. **Empty states**: Always provide meaningful empty messages
7. **Disabled state**: Pass `disabled={isReadonly}` to all interactive components

## Future Migrations

When migrating other resources (Scenario, Document, Parameter, etc.):

1. **Start with one section**: Migrate the simplest section first (like color/icon)
2. **Test thoroughly**: Ensure search, filter, and selection work correctly
3. **Migrate incrementally**: One section at a time, not all at once
4. **Keep old components**: Don't delete until migration is complete and tested
5. **Document patterns**: Add any new patterns discovered to this doc

## Component Files

- `client/components/common/forms/StepCard.tsx` - Card wrapper with search/filter
- `client/components/common/forms/SelectableGrid.tsx` - Generic selectable grid
- `client/components/common/forms/ReorderableList.tsx` - Drag-and-drop list

## Related Components

- `client/components/common/forms/GenericForm.tsx` - Form wrapper with step management
- `client/components/common/forms/GenericPicker.tsx` - Similar function-based pattern for pickers

## Search Params Pattern

### Overview

URL search params are used for form state persistence and server-side filtering. The pattern uses `nuqs` for type-safe URL search param parsing.

### When to Inline Parsers

**Inline parser definitions directly in components when:**
- Parser definitions are used in only one component
- No server-side parsing needed (client-only for UI state)
- Simple, straightforward parser definitions

**Example - Persona.tsx:**
```typescript
// Inline parsers (client-side only)
const personaSearchParamsClient = {
  name: parseAsString,
  description: parseAsString,
  color: parseAsString,
  icon: parseAsString,
  instructions: parseAsString,
  active: parseAsBoolean,
  departmentIds: parseAsArrayOf(parseAsString),
  parameterIds: parseAsArrayOf(parseAsString),
  parameterFieldIds: parseAsArrayOf(parseAsString),
  // Search params (URL-backed)
  colorSearch: parseAsString,
  iconSearch: parseAsString,
} as const;

// Use in useQueryStates
const [formData, setFormData] = useQueryStates(personaSearchParamsClient, {
  history: "replace",
  shallow: false,
});
```

### When to Keep Separate Files

**Keep parser definitions in separate files when:**
- Parser definitions are shared across multiple components
- Server-side parsing needed (keep `searchParams.ts` for server, inline client-side)
- Complex parser definitions with helper functions

**Example - Scenarios:**
- **Server-side**: `searchParams.ts` - Used in server pages to parse URL params and pass to API calls
- **Client-side**: Inline in `Scenario.tsx` - Used for URL-backed form state

**Pattern**: Inline when possible, separate when shared or server-side needed.

### Benefits of Inlining

- **Co-location**: Parser definitions live with their usage
- **Simpler imports**: No need to import from separate files
- **Clearer intent**: Makes it obvious these parsers are component-specific
- **Reduced file count**: Fewer files to maintain

### Trade-offs

- **Duplication risk**: If parsers are later needed elsewhere, will need to extract
- **File size**: Component files become slightly larger
- **Consistency**: Some resources still have server-side `searchParams.ts` (but that's necessary)

## Complete Migration Guide: List/New Page with GenericForm

This guide covers the end-to-end migration process for converting a resource's list/new page to use `GenericForm` with `nuqs` for URL-backed state management.

### Overview

The migration involves:
1. **Client Component**: Migrate to `GenericForm` with `nuqs` parsers
2. **Server Actions**: Define typed server actions in page files
3. **Server Pages**: Fetch data server-side and pass to client component
4. **Type Safety**: Export types from page files for client components

### Step 1: Define nuqs Parsers (Client Component)

**Location**: `client/components/[resource]/[Resource].tsx`

Define parsers inline for client-side URL-backed state:

```typescript
import {
  parseAsArrayOf,
  parseAsBoolean,
  parseAsString,
  useQueryStates,
  type Parser,
} from "nuqs";

// Inline parsers for URL-backed state (client-side only)
const resourceSearchParamsClient = {
  name: parseAsString,
  description: parseAsString,
  color: parseAsString,
  icon: parseAsString,
  instructions: parseAsString,
  active: parseAsBoolean,
  departmentIds: parseAsArrayOf(parseAsString),
  parameterIds: parseAsArrayOf(parseAsString),
  examples: parseAsArrayOf(parseAsString),
  // Search params (URL-backed, debounced in StepCard)
  colorSearch: parseAsString,
  iconSearch: parseAsString,
  // Filter params (URL-backed)
  colorShowSelected: parseAsBoolean,
  iconShowSelected: parseAsBoolean,
} as const;

// Use in component
const [formData] = useQueryStates(resourceSearchParamsClient, {
  history: "replace",
  shallow: false,
});
```

**Key Points**:
- Use `parseAsString`, `parseAsBoolean`, `parseAsArrayOf(parseAsString)` for different types
- Include search/filter params if needed (they're URL-backed for browser back/forward)
- Use `as const` for type inference
- `history: "replace"` prevents URL spam, `shallow: false` triggers server re-fetch

### Step 2: Configure GenericForm

**Location**: `client/components/[resource]/[Resource].tsx`

```typescript
import { GenericForm, type StepStatus } from "@/components/common/forms/GenericForm";

// Steps configuration
const steps = useMemo(
  () => [
    {
      id: "basic",
      title: "Basic Information",
      description: "Set the resource name, description, and active status.",
      resetFields: ["name", "description", "active"],
    },
    {
      id: "color",
      title: "Color",
      description: "Select a color for the resource.",
      resetFields: ["color", "colorSearch", "colorShowSelected"],
    },
    {
      id: "content",
      title: "Content",
      description: "Define instructions and examples.",
      resetFields: ["instructions", "examples"],
    },
  ],
  []
);

// Step status calculation
const getStepStatus = useCallback(
  (stepId: string, formData: Record<string, unknown>): StepStatus => {
    const hasName = !!(formData["name"] as string | null | undefined)?.trim();
    const hasDescription = !!(
      formData["description"] as string | null | undefined
    )?.trim();
    const hasColor = !!(
      formData["color"] as string | null | undefined
    )?.trim();
    const hasInstructions = !!(
      formData["instructions"] as string | null | undefined
    )?.trim();

    switch (stepId) {
      case "basic":
        return hasName && hasDescription ? "completed" : "active";
      case "color":
        if (!hasName || !hasDescription) return "pending";
        return hasColor ? "completed" : "active";
      case "content":
        if (!hasName || !hasDescription) return "pending";
        return hasInstructions ? "completed" : "active";
      default:
        return "pending";
    }
  },
  []
);

// Form initialization from server data
const initializeForm = useCallback(
  (serverData: ResourceDetailOut | ResourceNewOut, editMode: boolean) => {
    if (!editMode || !("id" in serverData)) {
      return {};
    }

    const resourceDetail = serverData as ResourceDetailOut;
    const updates: Partial<
      Record<keyof typeof resourceSearchParamsClient, unknown>
    > = {};
    
    if (resourceDetail.name) updates["name"] = resourceDetail.name;
    if (resourceDetail.description)
      updates["description"] = resourceDetail.description;
    if (resourceDetail.color) updates["color"] = resourceDetail.color;
    // ... more fields

    return updates;
  },
  []
);

// Submit handler
const handleSubmit = useCallback(
  async (formData: Record<string, unknown>) => {
    if (!formData["name"]) {
      toast.error("Name is required");
      throw new Error("Name is required");
    }

    // Transform and validate data
    const finalData = {
      name: formData["name"] as string,
      description: formData["description"] as string || "",
      // ... more fields
    };

    if (isEditMode) {
      if (!updateResourceAction) {
        throw new Error("updateResourceAction is required");
      }
      try {
        await updateResourceAction({ body: { ...finalData, resource_id: resourceId! } });
        toast.success("Resource updated successfully!");
        router.push("/create/resources");
      } catch (error) {
        toast.error(
          `Failed to update resource: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    } else {
      if (!createResourceAction) {
        throw new Error("createResourceAction is required");
      }
      try {
        await createResourceAction({ body: finalData });
        toast.success("Resource created successfully!");
        router.push("/create/resources");
      } catch (error) {
        toast.error(
          `Failed to create resource: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        throw error;
      }
    }
  },
  [isEditMode, resourceId, updateResourceAction, createResourceAction, router]
);

// Render GenericForm
<GenericForm
  nuqsParsers={
    resourceSearchParamsClient as Record<string, Parser<unknown>>
  }
  steps={steps}
  getStepStatus={getStepStatus}
  serverData={resourceData}
  initializeForm={initializeForm}
  formFieldKeys={["name", "description", "color", "instructions", "examples"]}
  resetSuccessMessage={(stepId) => {
    switch (stepId) {
      case "basic":
        return "Basic information reset";
      case "color":
        return "Color reset";
      case "content":
        return "Content reset";
      default:
        return "Reset";
    }
  }}
  onSubmit={handleSubmit}
  submitButton={{
    backUrl: "/create/resources",
    backLabel: "Back",
    createLabel: "Create Resource",
    updateLabel: "Update Resource",
  }}
  isReadonly={isReadonly}
  isEditMode={isEditMode}
  renderStep={({ stepId, stepStatus, stepTitle, stepDescription, stepNumber, formData: stepFormData, setFormData: setStepFormData, onReset }) => {
    // Render steps using StepCard
    switch (stepId) {
      case "basic":
        return (
          <StepCard
            stepStatus={stepStatus}
            stepNumber={stepNumber}
            stepTitle={stepTitle}
            stepDescription={stepDescription}
            isReadonly={isReadonly}
            isEditMode={isEditMode}
            resetFields={["name", "description", "active"]}
            {...(onReset ? { onReset } : {})}
            resetLabel="Reset"
          >
            {/* Form fields */}
          </StepCard>
        );
      // ... more cases
    }
  }}
/>
```

### Step 3: Define Server Actions (Page File)

**Location**: `client/app/(main)/create/[resource]/new/page.tsx` and `client/app/(main)/create/[resource]/[resourceId]/page.tsx`

```typescript
"use server";

import { api } from "@/lib/request-core";
import type {
  CreateResourceIn,
  CreateResourceOut,
  UpdateResourceIn,
  UpdateResourceOut,
} from "@/app/(main)/create/[resource]/new/page";

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createResource(
  input: CreateResourceIn
): Promise<CreateResourceOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/resources/create", input);
}

async function updateResource(
  input: UpdateResourceIn
): Promise<UpdateResourceOut> {
  "use server";
  // profileId comes from X-Profile-Id header (auto-injected by request-core.ts)
  // No revalidateTag needed - Redis cache handles invalidation
  return api.post("/resources/update", input);
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateResourceIn,
  CreateResourceOut,
  UpdateResourceIn,
  UpdateResourceOut,
  ResourceNewIn,
  ResourceNewOut,
  ResourceDetailOut,
};
```

**Key Points**:
- Server actions use `"use server"` directive
- Types are exported for client component imports
- `profileId` is auto-injected via `X-Profile-Id` header (no need to pass manually)
- Use `api.post()` helper for API calls

### Step 4: Server Page Implementation (New Page)

**Location**: `client/app/(main)/create/[resource]/new/page.tsx`

```typescript
import { Metadata } from "next";
import { api } from "@/lib/request-core";
import Resource from "@/components/resources/Resource";
import type {
  CreateResourceIn,
  CreateResourceOut,
  ResourceNewIn,
  ResourceNewOut,
} from "./page";

// Fetch default data for new resource
const getResourceDefault = async (input: ResourceNewIn) => {
  return api.get<ResourceNewOut>("/resources/new", {
    query: {
      department_id: input.department_id,
    },
    headers: {
      "X-Bypass-Cache": "1",
    },
  });
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function createResource(
  input: CreateResourceIn
): Promise<CreateResourceOut> {
  "use server";
  return api.post("/resources/create", input);
}

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Create Resource",
    description: "Create a new resource",
  };
}

export default async function NewResourcePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const q = await searchParams;
  
  // Build input from URL params (if any)
  const input = {
    department_id: (q.department_id as string) || null,
  } as unknown as ResourceNewIn;
  
  const resourceDetailDefault = await getResourceDefault(input);

  // Override API defaults with URL params if present (URL params take precedence)
  const resourceDetailDefaultWithParams = {
    ...resourceDetailDefault,
    ...(q.color && { color: q.color }),
    ...(q.icon && { icon: q.icon }),
    ...(q.active !== null && q.active !== undefined && { active: q.active === "true" }),
  };

  return (
    <div
      className="space-y-6"
      data-page="resource-new"
      aria-label="Create new resource page"
    >
      <Resource
        mode="create"
        resourceDetailDefault={resourceDetailDefaultWithParams}
        createResourceAction={createResource}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  CreateResourceIn,
  CreateResourceOut,
  ResourceNewIn,
  ResourceNewOut,
};
```

**Key Points**:
- Fetch default data server-side
- Override defaults with URL params if present
- Pass server actions as props to client component
- Export types for client component imports

### Step 5: Server Page Implementation (Edit Page)

**Location**: `client/app/(main)/create/[resource]/[resourceId]/page.tsx`

```typescript
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { api } from "@/lib/request-core";
import Resource from "@/components/resources/Resource";
import type {
  UpdateResourceIn,
  UpdateResourceOut,
  ResourceDetailOut,
} from "./page";

// Fetch resource detail
const getResourceDetail = async (
  resourceId: string
): Promise<ResourceDetailOut | null> => {
  try {
    return await api.get<ResourceDetailOut>(`/resources/${resourceId}/detail`);
  } catch {
    return null;
  }
};

/** ---- Strongly-typed server actions (single source of truth) ---- */
async function updateResource(
  input: UpdateResourceIn
): Promise<UpdateResourceOut> {
  "use server";
  return api.post("/resources/update", input);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ resourceId: string }>;
}): Promise<Metadata> {
  const { resourceId } = await params;
  return {
    title: `Edit Resource ${resourceId}`,
    description: "Edit resource details",
  };
}

export default async function ResourceEditPage({
  params,
}: {
  params: Promise<{ resourceId: string }>;
}) {
  const { resourceId } = await params;
  const resourceDetail = await getResourceDetail(resourceId);

  if (!resourceDetail) {
    notFound();
  }

  return (
    <div
      className="space-y-6"
      data-page="resource-edit"
      aria-label={`Edit resource ${resourceId} page`}
    >
      <Resource
        resourceId={resourceId}
        mode="edit"
        resourceDetail={resourceDetail}
        updateResourceAction={updateResource}
      />
    </div>
  );
}

/** ---- Export types for client component (type-only imports) ---- */
export type {
  UpdateResourceIn,
  UpdateResourceOut,
  ResourceDetailOut,
};
```

**Key Points**:
- Fetch resource detail server-side
- Handle `notFound()` if resource doesn't exist
- Pass server actions as props to client component
- Export types for client component imports

### Step 6: Component Props Interface

**Location**: `client/components/[resource]/[Resource].tsx`

```typescript
import type {
  CreateResourceIn,
  CreateResourceOut,
  ResourceDetailOut,
  ResourceNewOut,
  UpdateResourceIn,
  UpdateResourceOut,
} from "@/app/(main)/create/[resource]/new/page";

export interface ResourceProps {
  resourceId?: string;
  mode?: "create" | "edit";
  // Server-provided data (for server-side rendering)
  resourceDetail?: ResourceDetailOut;
  resourceDetailDefault?: ResourceNewOut;
  // Server actions (replaces useMutation)
  createResourceAction?: (input: CreateResourceIn) => Promise<CreateResourceOut>;
  updateResourceAction?: (input: UpdateResourceIn) => Promise<UpdateResourceOut>;
}

export default function Resource({
  resourceId,
  mode = resourceId ? "edit" : "create",
  resourceDetail: serverResourceDetail,
  resourceDetailDefault: serverResourceDetailDefault,
  createResourceAction,
  updateResourceAction,
}: ResourceProps) {
  // Component implementation
}
```

**Key Points**:
- Import types from page files (type-only imports)
- Props include server data and server actions
- Mode is inferred from `resourceId` if not provided

### Migration Checklist

When migrating a resource to use `GenericForm`:

- [ ] **Client Component**:
  - [ ] Define `nuqs` parsers inline
  - [ ] Configure `steps` array with `resetFields`
  - [ ] Implement `getStepStatus` callback
  - [ ] Implement `initializeForm` callback
  - [ ] Implement `handleSubmit` callback
  - [ ] Use `GenericForm` with all props
  - [ ] Use `StepCard` for each step with proper props
  - [ ] Handle optional props correctly (`{...(onReset ? { onReset } : {})}`)

- [ ] **Server Actions**:
  - [ ] Define `createResource` action in `new/page.tsx`
  - [ ] Define `updateResource` action in `[resourceId]/page.tsx`
  - [ ] Export types from page files
  - [ ] Use `"use server"` directive

- [ ] **Server Pages**:
  - [ ] Fetch default data in `new/page.tsx`
  - [ ] Fetch detail data in `[resourceId]/page.tsx`
  - [ ] Override defaults with URL params if present
  - [ ] Pass server actions as props
  - [ ] Handle `notFound()` for missing resources

- [ ] **Type Safety**:
  - [ ] Import types from page files (type-only)
  - [ ] Use `InputOf` and `OutputOf` helpers if needed
  - [ ] Ensure all types are exported from page files

- [ ] **Testing**:
  - [ ] Test form initialization (edit mode)
  - [ ] Test form submission (create and update)
  - [ ] Test reset handlers
  - [ ] Test step status calculation
  - [ ] Test URL param persistence (browser back/forward)
  - [ ] Test readonly mode

### Common Patterns

#### Pattern 1: Conditional Props

```typescript
// For optional props with exactOptionalPropertyTypes
{...(onReset ? { onReset } : {})}
{...(searchTerm ? { searchTerm, onSearchChange, searchPlaceholder } : {})}
```

#### Pattern 2: Form Data Access

```typescript
// Always use bracket notation for index signatures
const name = formData["name"] as string | null | undefined;
const examples = formData["examples"] as string[] | null | undefined;
```

#### Pattern 3: Type Assertions

```typescript
// For array filtering
example_ids: ((formData["examples"] as string[] | null | undefined) || []).filter((ex: string) => ex.trim())
```

#### Pattern 4: Server Action Error Handling

```typescript
try {
  await createResourceAction({ body: finalData });
  toast.success("Resource created successfully!");
  router.push("/create/resources");
} catch (error) {
  toast.error(
    `Failed to create resource: ${error instanceof Error ? error.message : "Unknown error"}`
  );
  throw error;
}
```

### Example: Persona.tsx Migration

See `client/components/personas/Persona.tsx` for a complete reference implementation.

**Key Features**:
- Inline `nuqs` parsers
- `GenericForm` with initialization, reset, and submit
- `StepCard` with debounced search and reset buttons
- Server actions passed as props
- Type-safe with exported types from page files

### Troubleshooting

**Issue**: Type errors with optional props
- **Solution**: Use conditional spread: `{...(prop ? { prop } : {})}`

**Issue**: Form not initializing from server data
- **Solution**: Check `initializeForm` returns correct shape, ensure `formFieldKeys` includes all fields

**Issue**: Reset not working
- **Solution**: Ensure `resetFields` in step config matches fields in `StepCard` props

**Issue**: Search not debouncing
- **Solution**: Ensure `debounceMs` prop is set on `StepCard` (default is 300ms)

**Issue**: Submit button not showing
- **Solution**: Ensure `onSubmit` and `submitButton` props are provided to `GenericForm`

## Nested Content Sections Pattern

**Purpose**: Handle complex nested data structures that need separate sections but aren't full steps.

### Overview

The `contentSections` prop in `GenericForm` allows you to insert additional sections between steps. This is useful when you need to split complex nested data into separate sections (e.g., Active Simulations and Simulation Positions in Cohort).

### When to Use contentSections

Use `contentSections` when:
- You need to split complex nested data into separate sections
- The sections are related to a parent step but deserve their own UI
- You want to avoid creating multiple steps for related functionality
- The sections should appear conditionally (e.g., only when parent data exists)

**Don't use `contentSections` for:**
- Independent steps (use regular `steps` instead)
- Simple form fields (use `StepCard` content)
- Unrelated functionality (create separate steps)

### Pattern Structure

```typescript
const contentSections = useMemo(() => {
  // Only show sections if parent data exists
  if (!parentDataExists) {
    return [];
  }

  return [
    {
      id: "section-1",
      insertAfter: "parent-step-id", // Insert after this step
      render: ({
        formData,
        setFormData,
      }: {
        formData: Record<string, unknown>;
        setFormData: (updates: Partial<Record<string, unknown>>) => void;
      }) => {
        // Render section content using StepCard or custom Card
        return (
          <StepCard
            stepStatus="completed"
            stepNumber={3}
            stepTitle="Section Title"
            stepDescription="Section description"
            isReadonly={isReadonly}
            isEditMode={isEditMode}
          >
            {/* Section content */}
          </StepCard>
        );
      },
    },
    {
      id: "section-2",
      insertAfter: "parent-step-id", // Can insert multiple sections after same step
      render: ({ formData, setFormData }) => {
        // Another section
      },
    },
  ];
}, [dependencies]);
```

### Example: Cohort Simulations

**Problem**: Cohort has simulations that need:
1. Active state management (switches for all simulations)
2. Position management (reordering simulations)

**Solution**: Split into two `contentSections` after the "simulations" step:

```typescript
const contentSections = useMemo(() => {
  const simIds = (formData["simulationIds"] as string[] | null | undefined) || [];
  
  if (simIds.length === 0) {
    return []; // Don't show sections if no simulations selected
  }

  return [
    {
      id: "active-simulations",
      insertAfter: "simulations",
      render: ({ formData, setFormData }) => {
        const activeStates = (formData["simulationActiveStates"] as Record<string, boolean> | null | undefined) || {};
        
        return (
          <StepCard
            stepStatus="completed"
            stepNumber={3}
            stepTitle="Active Simulations"
            stepDescription="Enable or disable simulations in this cohort."
            isReadonly={isReadonly}
            isEditMode={isEditMode}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {simIds.map((simulationId) => (
                <Card key={simulationId}>
                  {/* Switch for active state */}
                </Card>
              ))}
            </div>
          </StepCard>
        );
      },
    },
    {
      id: "simulation-positions",
      insertAfter: "simulations",
      render: ({ formData, setFormData }) => {
        return (
          <StepCard
            stepStatus="completed"
            stepNumber={4}
            stepTitle="Simulation Positions"
            stepDescription="Reorder simulations to set their display order."
            isReadonly={isReadonly}
            isEditMode={isEditMode}
          >
            {/* Reorderable list with position controls */}
          </StepCard>
        );
      },
    },
  ];
}, [formData, simulationMapping, isReadonly, isEditMode]);
```

### Key Points

1. **Conditional Rendering**: Return empty array if sections shouldn't be shown
2. **insertAfter**: Specify which step to insert sections after
3. **Multiple Sections**: Can insert multiple sections after the same step
4. **StepCard Usage**: Use `StepCard` for consistent styling (or custom `Card` if needed)
5. **formData Access**: Access form data via `formData` parameter
6. **State Updates**: Update form state via `setFormData` callback
7. **Memoization**: Memoize `contentSections` array to prevent unnecessary re-renders

### Benefits

- **Separation of Concerns**: Split complex nested data into focused sections
- **Better UX**: Users can manage related data in separate, clear sections
- **Flexibility**: Sections can be conditional and dynamic
- **Consistency**: Uses same `StepCard` pattern as regular steps
- **No Accordions**: Avoids complex accordion logic by using flat sections

### Reference Implementation

See `client/components/cohorts/Cohort.tsx` for a complete example:
- Active Simulations section (grid of switches)
- Simulation Positions section (reorderable list)

## Draft Autosave Pattern

**⚠️ CRITICAL: Draft autosave enables optimistic concurrency control for form state persistence.**

The draft pattern provides automatic saving of form state with version-based conflict detection. All resources that support drafts follow the same component pattern.

### Pattern Overview

**Purpose**: Automatically save form state as drafts with debouncing and optimistic concurrency control

**Key Principles**:

1. **Generic hook**: Use `useDraftAutosave` hook for all resources
2. **Resource-specific prop names**: Component props use resource-specific names (e.g., `patchPersonaDraftAction`, `patchScenarioDraftAction`)
3. **Type transformation**: Transform hook API to backend API in wrapper function
4. **URL draftId management**: Sync draftId between URL (nuqs) and profile context
5. **Server data initialization**: Initialize draft state from server data (merged with draft payload)
6. **Inline extra components**: When migrating, move any extra components created inline - logic will be cleaner and can be handled with generic components (`StepCard`, `SelectableGrid`, `ReorderableList`, etc.)

### Hook Usage Pattern

**Hook**: `useDraftAutosave<T extends Record<string, unknown>>`

**Location**: `client/hooks/use-draft-autosave.ts`

**Interface**:
```typescript
interface UseDraftAutosaveOptions<T extends Record<string, unknown>> {
  draftId: string | null;
  draftState: T;
  patchDraftAction: (input: {
    body: {
      draft_id?: string | null;
      patch: Partial<T>;
      expected_version: number;
    };
  }) => Promise<{
    draftId: string;
    newVersion: number;
    draftExists: boolean;
  }>;
  debounceMs?: number;
  onDraftCreated?: (draftId: string) => void;
}
```

### Component Integration Pattern

**Component Props**:
```typescript
export interface {Resource}Props {
  {resource}Id?: string;
  mode?: "create" | "edit";
  {resource}Detail?: {Resource}DetailOut;
  {resource}DetailDefault?: {Resource}NewOut;
  create{Resource}Action?: (input: Create{Resource}In) => Promise<Create{Resource}Out>;
  update{Resource}Action?: (input: Update{Resource}In) => Promise<Update{Resource}Out>;
  // Resource-specific draft action prop name
  patch{Resource}DraftAction?: (
    input: Patch{Resource}DraftIn
  ) => Promise<Patch{Resource}DraftOut>;
}
```

**Draft State Type**:
```typescript
type DraftState = {
  // Resource-specific fields (e.g., for personas: name, description, color, icon, etc.)
  field1: string;
  field2: string;
  field3: boolean;
  // ... more fields
};
```

**URL DraftId Management**:
```typescript
// Inline parsers for URL-backed state
const {resource}SearchParamsClient = {
  // Draft ID (URL-backed, updated when draft is created)
  draftId: parseAsString,
  // ... other search params
} as const;

// URL-backed state using nuqs
const [urlParams, setUrlParams] = useQueryStates({resource}SearchParamsClient, {
  history: "replace",
  shallow: true, // Use shallow routing to prevent server component re-renders
});

// Get draftId from URL (managed by nuqs via urlParams)
const urlDraftId = urlParams.draftId || null;

// Sync URL draftId to profile context
const { selectedDraftId, setSelectedDraftId } = useProfile();
useEffect(() => {
  if (urlDraftId !== selectedDraftId) {
    setSelectedDraftId(urlDraftId);
  }
}, [urlDraftId, selectedDraftId, setSelectedDraftId]);

const draftId = urlDraftId;
```

**Draft State Initialization**:
```typescript
// Initialize draft state from server data or draft payload
const initialDraftState = useMemo((): DraftState => {
  const data = isEditMode ? {resource}Detail : {resource}DetailDefault;
  if (!data) {
    return {
      // Default empty state
      field1: "",
      field2: "",
      field3: true,
    };
  }
  
  // If draftId exists, server should have merged draft payload into data
  // Otherwise, use server defaults
  return {
    field1: data.field1 || "",
    field2: data.field2 || "",
    field3: data.field3 ?? true,
  };
}, [
  isEditMode,
  {resource}Detail,
  {resource}DetailDefault,
  draftId,
  // Include actual content fields so it recomputes when server data changes
  {resource}DetailDefault?.field1,
  {resource}Detail?.field1,
  // ... more fields
]);

const [draftState, setDraftState] = useState<DraftState>(initialDraftState);

// Update draft state when server data changes (e.g., draft selected)
useEffect(() => {
  const currentStateStr = JSON.stringify(draftState);
  const newStateStr = JSON.stringify(initialDraftState);
  
  if (currentStateStr !== newStateStr) {
    setDraftState(initialDraftState);
  }
}, [initialDraftState]);
```

**Hook Integration**:
```typescript
const {
  saveStatus: _saveStatus,
  saveNow: _saveNow,
  lastSavedVersion: _lastSavedVersion,
} = useDraftAutosave({
  draftId,
  draftState,
  patchDraftAction: patch{Resource}DraftAction
    ? async (input) => {
        // Transform input to match API structure (API uses input_draft_id, patch, expected_version)
        // Note: profile_id is added server-side from header
        const result = await patch{Resource}DraftAction({
          body: {
            input_draft_id: input.body.draft_id || null,
            patch: input.body.patch as Record<string, unknown>,
            expected_version: input.body.expected_version,
          } as Patch{Resource}DraftIn["body"],
        });
        // Transform response to match hook expectations (API returns draft_id, new_version, draft_exists)
        return {
          draftId: result.draft_id || "",
          newVersion: result.new_version || 0,
          draftExists: result.draft_exists || false,
        };
      }
    : async () => ({ draftId: "", newVersion: 0, draftExists: false }),
  debounceMs: 1000,
  onDraftCreated: useCallback(
    (newDraftId: string) => {
      // Only update URL if draftId actually changed
      const currentUrlDraftId = searchParams.get("draftId");
      if (newDraftId === currentUrlDraftId) {
        return;
      }
      // Update URL with new draftId and trigger server-side refetch
      // This ensures the server component gets fresh data with the new draft
      const params = new URLSearchParams(searchParams.toString());
      params.set("draftId", newDraftId);
      const newUrl = `?${params.toString()}`;
      router.replace(newUrl, { scroll: false });
      // Force server components to re-render with updated search params
      router.refresh();
    },
    [router, searchParams]
  ),
});
```

### Type Transformation Pattern

**Hook API** (what `useDraftAutosave` expects):
```typescript
patchDraftAction: (input: {
  body: {
    draft_id?: string | null;
    patch: Partial<T>;
    expected_version: number;
  };
}) => Promise<{
  draftId: string;
  newVersion: number;
  draftExists: boolean;
}>
```

**Backend API** (what server action provides):
```typescript
patch{Resource}DraftAction: (input: Patch{Resource}DraftIn) => Promise<Patch{Resource}DraftOut>

// Where Patch{Resource}DraftIn is:
{
  body: {
    input_draft_id: UUID | null;
    patch: Record<string, unknown>;
    expected_version: number;
  };
}

// And Patch{Resource}DraftOut is:
{
  draft_id: UUID;
  new_version: number;
  draft_exists: boolean;
}
```

**Transformation Wrapper**:
```typescript
patchDraftAction: patch{Resource}DraftAction
  ? async (input) => {
      // Transform hook API → backend API
      const result = await patch{Resource}DraftAction({
        body: {
          input_draft_id: input.body.draft_id || null,
          patch: input.body.patch as Record<string, unknown>,
          expected_version: input.body.expected_version,
        } as Patch{Resource}DraftIn["body"],
      });
      // Transform backend API → hook API
      return {
        draftId: result.draft_id || "",
        newVersion: result.new_version || 0,
        draftExists: result.draft_exists || false,
      };
    }
  : async () => ({ draftId: "", newVersion: 0, draftExists: false })
```

### Server Page Integration

**New Page** (`client/app/(main)/create/{resource}/new/page.tsx`):
```typescript
// Parse draftId from URL
const personaSearchParams = {
  draftId: parseAsString,
  // ... other params
};
const loadPersonaSearchParams = createLoader(personaSearchParams);
const q = loadPersonaSearchParams(searchParamsObj);

// Fetch default data with draft_id
const input: {Resource}NewIn = {
  body: {
    draft_id: q.draftId ?? null,
    // ... other params
  } as {Resource}NewIn["body"],
};
const {resource}DetailDefault = await get{Resource}Default(input);

// Pass draft action to component
<{Resource}
  mode="create"
  {resource}DetailDefault={resource}DetailDefault}
  create{Resource}Action={create{Resource}}
  patch{Resource}DraftAction={patch{Resource}Draft}
/>
```

**Edit Page** (`client/app/(main)/create/{resource}/[{resource}Id]/page.tsx`):
```typescript
// Parse draftId from URL
const q = loadPersonaSearchParams(searchParamsObj);

// Fetch detail data with draft_id
const input: {Resource}DetailIn = {
  body: {
    {resource}_id: {resource}Id,
    draft_id: q.draftId ?? null,
    // ... other params
  } as {Resource}DetailIn["body"],
};
const {resource}Detail = await get{Resource}(input);

// Pass draft action to component
<{Resource}
  {resource}Id={resource}Id}
  mode="edit"
  {resource}Detail={resource}Detail}
  update{Resource}Action={update{Resource}}
  patch{Resource}DraftAction={patch{Resource}Draft}
/>
```

### Key Points

1. **Resource-specific prop names**: Each resource uses its own prop name (e.g., `patchPersonaDraftAction`) - this is acceptable since types are resource-specific
2. **Type transformation**: Always wrap the backend action in a transformation function to match hook API
3. **URL sync**: DraftId is managed in URL (nuqs) and synced to profile context
4. **Server data merge**: Server merges draft payload into detail/new data automatically
5. **State initialization**: Initialize draft state from server data, which includes merged draft payload if draftId exists
6. **Debouncing**: Hook debounces saves (default 1000ms) to avoid excessive API calls
7. **Optimistic concurrency**: Uses `expected_version` to prevent lost updates
8. **Inline extra components**: When migrating components to use drafts, **move any extra components inline** - the logic will be cleaner and can be handled with generic components (`StepCard`, `SelectableGrid`, `ReorderableList`, `GenericPicker`, etc.). Avoid creating resource-specific section components (e.g., `PersonaColorSection`, `ScenarioBasicSection`) - instead, use generic components with inline configuration in the `renderStep` callback.

### Reference Implementation

See `client/components/personas/Persona.tsx` for a complete reference implementation.

**Key Files**:
- `client/hooks/use-draft-autosave.ts` - Generic draft autosave hook
- `client/components/personas/Persona.tsx` - Component integration example (uses inline generic components, no separate section components)
- `client/app/(main)/create/personas/new/page.tsx` - Server page example
- `client/app/(main)/create/personas/p/[personaId]/page.tsx` - Edit page example

**Component Structure Example**:
The Persona component demonstrates the inline pattern - all step rendering is done inline using `StepCard`, `SelectableGrid`, and `ReorderableList` with inline `renderItem` functions. No separate `PersonaColorSection` or `PersonaIconSection` components exist - everything is handled inline for cleaner logic and better maintainability.

### Migration Checklist

When migrating other resources (scenarios, benchmarks, etc.) to use draft autosave:

- [ ] **Create draft endpoint** (`server/app/api/v4/{resource}/draft.py`)
  - [ ] Follow standard draft endpoint pattern
  - [ ] Use `api_patch_{resource}_draft_v4` function name
  - [ ] Define resource-specific defaults in SQL
  - [ ] Add audit logging (`{resource}.draft.patched`)
  - [ ] Add cache invalidation (`["{resource}", "drafts", "profile"]`)

- [ ] **Create SQL file** (`server/app/sql/v4/{resource}/patch_{resource}_draft_complete.sql`)
  - [ ] Use idempotent drop/recreate pattern
  - [ ] Accept `patch text` parameter (not `jsonb`)
  - [ ] Return `(draft_id uuid, new_version int, draft_exists boolean)`
  - [ ] Define resource-specific defaults in `WITH defaults AS` CTE
  - [ ] Use `'{resource}'::draft_resource_type` for resource_type

- [ ] **Add component props** (`client/components/{resource}/{Resource}.tsx`)
  - [ ] Add `patch{Resource}DraftAction` prop to component interface
  - [ ] Import `Patch{Resource}DraftIn` and `Patch{Resource}DraftOut` types from page file

- [ ] **Refactor component structure** (`client/components/{resource}/{Resource}.tsx`)
  - [ ] **Move extra components inline**: If the component has separate section components (e.g., `{Resource}ColorSection`, `{Resource}BasicSection`), move them inline into the `renderStep` callback
  - [ ] **Use generic components**: Replace resource-specific section components with generic components:
    - Use `StepCard` for step wrappers (includes search/filter built-in)
    - Use `SelectableGrid` for selectable items (colors, icons, etc.)
    - Use `ReorderableList` for drag-and-drop lists (examples, items, etc.)
    - Use `GenericPicker` for multi-select pickers (departments, parameters, etc.)
  - [ ] **Inline renderItem functions**: Keep `renderItem` functions inline in the switch case for clarity
  - [ ] **Delete old components**: Remove resource-specific section component files after migration
  - [ ] **Benefits**: Cleaner logic, better reusability, consistent patterns across all resources

- [ ] **Integrate `useDraftAutosave` hook**
  - [ ] Define `DraftState` type with resource-specific fields
  - [ ] Initialize `draftState` from server data
  - [ ] Add `draftId` to URL parsers (`parseAsString`)
  - [ ] Sync `draftId` between URL and profile context
  - [ ] Wrap `patch{Resource}DraftAction` in transformation function
  - [ ] Add `onDraftCreated` callback to update URL

- [ ] **Update server pages**
  - [ ] Add `draftId` parser to server-side search params
  - [ ] Pass `draft_id` to detail/new API calls
  - [ ] Export `Patch{Resource}DraftIn` and `Patch{Resource}DraftOut` types
  - [ ] Create `patch{Resource}Draft` server action
  - [ ] Pass `patch{Resource}DraftAction` prop to component

- [ ] **Test draft functionality**
  - [ ] Verify draft creates on first change
  - [ ] Verify draft patches on subsequent changes
  - [ ] Verify draftId appears in URL
  - [ ] Verify draftId syncs to profile context
  - [ ] Verify draft state initializes from server data
  - [ ] Verify version conflicts handled correctly
  - [ ] Verify cache invalidation works

