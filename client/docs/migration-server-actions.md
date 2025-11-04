# Migration Guide: React Query → Server Actions Pattern

This guide documents the pattern for migrating components from client-side React Query data fetching to server-side data fetching with typed server actions.

## Overview

**Before**: Components fetch data on the client using `useQuery` and mutate using `useMutation`  
**After**: Server fetches data and passes it as props, mutations use typed server actions

## Benefits

1. **Fully typed end-to-end**: OpenAPI → `InputOf`/`OutputOf` → server page → client component
2. **No `unknown` types**: Single source of truth from OpenAPI schema
3. **Better performance**: Server-side data fetching, no client-side loading states
4. **Simpler code**: No React Query hooks, cache management, or invalidation logic
5. **SEO-friendly**: Data is available during SSR for metadata generation

## Migration Steps

### Step 1: Update Server Page (`page.tsx`)

#### 1.1 Add Type Definitions

Import `InputOf` and `OutputOf` from `@/lib/api/types` and define types for all endpoints:

```typescript
import type { InputOf, OutputOf } from "@/lib/api/types";

// Strong types from OpenAPI
type ModelDetailIn = InputOf<"/api/v3/providers/models/detail", "post">;
type ModelDetailOut = OutputOf<"/api/v3/providers/models/detail", "post">;

type CreateModelIn = InputOf<"/api/v3/providers/models/create", "post">;
type CreateModelOut = OutputOf<"/api/v3/providers/models/create", "post">;

type UpdateModelIn = InputOf<"/api/v3/providers/models/update", "post">;
type UpdateModelOut = OutputOf<"/api/v3/providers/models/update", "post">;
```

#### 1.2 Create Cached Fetch Functions

Use React's `cache()` to prevent duplicate requests between metadata and page:

```typescript
import { cache } from "react";

const getModel = cache(
  async (input: ModelDetailIn): Promise<ModelDetailOut> => {
    return api.post("/providers/models/detail", input);
  }
);
```

#### 1.3 Update Metadata Generation

Use the cached fetch function in `generateMetadata`:

```typescript
export async function generateMetadata({ params }) {
  const { modelId, providerId } = await params;
  const profileId = (await auth())?.effectiveProfileId || "";
  
  try {
    const model = await getModel({ body: { modelId, providerId, profileId } });
    return {
      title: `${model?.name || "Model"}`,
      description: model?.description || "...",
    };
  } catch {
    return { title: "Model", description: "..." };
  }
}
```

#### 1.4 Create Typed Server Actions

Create server actions with `"use server"` and cache invalidation:

```typescript
import { revalidateTag } from "next/cache";

export async function createModel(input: CreateModelIn): Promise<CreateModelOut> {
  "use server";
  const out = await api.post("/providers/models/create", input);
  revalidateTag("providers");
  return out;
}

export async function updateModel(input: UpdateModelIn): Promise<UpdateModelOut> {
  "use server";
  const out = await api.post("/providers/models/update", input);
  revalidateTag("providers");
  return out;
}
```

#### 1.5 Fetch Data and Pass to Component

Remove TanStack Query prefetching and pass data directly:

```typescript
export default async function Page({ params }) {
  const { providerId, modelId } = await params;
  const profileId = (await auth())?.effectiveProfileId || "";

  // Fetch data in parallel (cached, won't duplicate)
  const [model, provider] = await Promise.all([
    getModel({ body: { modelId, providerId, profileId } }),
    getProvider({ body: { providerId, profileId } }),
  ]);

  return (
    <div className="space-y-6">
      <ModelComponent
        modelId={modelId}
        providerId={providerId}
        modelDetail={model}
        providerDetail={provider}
        createModelAction={createModel}
        updateModelAction={updateModel}
      />
    </div>
  );
}
```

#### 1.6 Export Types for Client

Export all types for type-only imports in the client component:

```typescript
export type {
  CreateModelIn,
  CreateModelOut,
  ModelDetailIn,
  ModelDetailOut,
  UpdateModelIn,
  UpdateModelOut,
};
```

### Step 2: Update Client Component

#### 2.1 Import Types Type-Only

Import types from the server page file (type-only, won't bundle server code):

```typescript
import type {
  CreateModelIn,
  CreateModelOut,
  ModelDetailOut,
  UpdateModelIn,
  UpdateModelOut,
} from "@/app/(main)/system/providers/p/[providerId]/m/[modelId]/page";
```

#### 2.2 Update Props Interface

Add optional props for server-provided data and actions:

```typescript
export interface ModelProps {
  modelId?: string;
  providerId: string;
  // Server-provided data (for server-side rendering)
  modelDetail?: ModelDetailOut;
  providerDetail?: ProviderDetailOut;
  // Server actions (replaces useMutation)
  createModelAction?: (input: CreateModelIn) => Promise<CreateModelOut>;
  updateModelAction?: (input: UpdateModelIn) => Promise<UpdateModelOut>;
}
```

#### 2.3 Remove React Query Imports

Remove all React Query dependencies:

```typescript
// ❌ Remove these
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { keys } from "@/lib/query/keys";
import { api } from "@/lib/api/client"; // Only if not used elsewhere

// ✅ Keep only what you need
import { useRouter } from "next/navigation";
```

#### 2.4 Use Server Data Directly

Replace `useQuery` hooks with direct prop usage:

```typescript
// ❌ Before
const { data: modelDetail, isLoading } = useQuery({
  queryKey: keys.providers.with({ modelId, providerId, profileId }),
  queryFn: () => api.post("/providers/models/detail", { body: {...} }),
  enabled: !!modelId,
});

// ✅ After
const modelDetail = serverModelDetail;
const isLoading = false; // No loading when using server data
```

#### 2.5 Replace Mutations with Server Actions

Create handlers that use server actions directly:

```typescript
// Extract body types for type safety
type CreateModelBody = CreateModelIn extends { body: infer B } ? B : never;
type UpdateModelBody = UpdateModelIn extends { body: infer B } ? B : never;

// ❌ Before
const updateMutation = useMutation({
  mutationFn: (body) => api.post("/providers/models/update", { body }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: keys.providers.all });
  },
});

// ✅ After
const handleUpdateModel = async (body: UpdateModelBody) => {
  if (!updateModelAction) {
    throw new Error("updateModelAction is required");
  }
  await updateModelAction({ body });
};
```

#### 2.6 Update Submit Handlers

Replace mutation calls with server action calls:

```typescript
// ❌ Before
await updateMutation.mutateAsync({ modelId, name, ... });

// ✅ After
await handleUpdateModel({ modelId, name, ... });
```

#### 2.7 Simplify Loading States

Remove mutation pending states from UI:

```typescript
// ❌ Before
<Button
  disabled={
    isSubmitting ||
    updateMutation.isPending ||
    createMutation.isPending
  }
>
  {updateMutation.isPending ? "Updating..." : "Update"}
</Button>

// ✅ After
<Button disabled={isSubmitting || isLoading}>
  {isSubmitting ? "Updating..." : "Update"}
</Button>
```

## Complete Example

### Server Page (`page.tsx`)

```typescript
import { cache } from "react";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import ModelComponent from "@/components/providers/Model";

// Types
type ModelDetailIn = InputOf<"/api/v3/providers/models/detail", "post">;
type ModelDetailOut = OutputOf<"/api/v3/providers/models/detail", "post">;
type UpdateModelIn = InputOf<"/api/v3/providers/models/update", "post">;
type UpdateModelOut = OutputOf<"/api/v3/providers/models/update", "post">;

// Cached fetch
const getModel = cache(
  async (input: ModelDetailIn): Promise<ModelDetailOut> => {
    return api.post("/providers/models/detail", input);
  }
);

// Metadata
export async function generateMetadata({ params }) {
  const { modelId, providerId } = await params;
  const profileId = (await auth())?.effectiveProfileId || "";
  
  try {
    const model = await getModel({ body: { modelId, providerId, profileId } });
    return { title: model?.name || "Model" };
  } catch {
    return { title: "Model" };
  }
}

// Server actions
export async function updateModel(input: UpdateModelIn): Promise<UpdateModelOut> {
  "use server";
  const out = await api.post("/providers/models/update", input);
  revalidateTag("providers");
  return out;
}

// Page component
export default async function Page({ params }) {
  const { providerId, modelId } = await params;
  const profileId = (await auth())?.effectiveProfileId || "";

  const model = await getModel({ body: { modelId, providerId, profileId } });

  return (
    <ModelComponent
      modelId={modelId}
      providerId={providerId}
      modelDetail={model}
      updateModelAction={updateModel}
    />
  );
}

// Export types
export type { ModelDetailOut, UpdateModelIn, UpdateModelOut };
```

### Client Component (`Model.tsx`)

```typescript
"use client";

import type {
  ModelDetailOut,
  UpdateModelIn,
  UpdateModelOut,
} from "@/app/(main)/system/providers/p/[providerId]/m/[modelId]/page";

export interface ModelProps {
  modelId: string;
  providerId: string;
  modelDetail?: ModelDetailOut;
  updateModelAction?: (input: UpdateModelIn) => Promise<UpdateModelOut>;
}

export default function Model({
  modelId,
  providerId,
  modelDetail: serverModelDetail,
  updateModelAction,
}: ModelProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modelDetail = serverModelDetail;

  // Extract body type
  type UpdateModelBody = UpdateModelIn extends { body: infer B } ? B : never;

  // Server action handler
  const handleUpdate = async (body: UpdateModelBody) => {
    if (!updateModelAction) throw new Error("updateModelAction required");
    await updateModelAction({ body });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      await handleUpdate({
        modelId,
        name: formData.name!,
        // ... other fields
      });
      toast.success("Updated!");
      router.push("/system/providers");
    } catch (error) {
      toast.error("Update failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <Button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Updating..." : "Update"}
      </Button>
    </form>
  );
}
```

## Key Patterns

### 1. Type Extraction Pattern

Extract body types from input types for type-safe handlers:

```typescript
type UpdateModelBody = UpdateModelIn extends { body: infer B } ? B : never;
```

### 2. Cached Fetch Pattern

Use `cache()` to deduplicate requests between metadata and page:

```typescript
const getData = cache(async (input: InputType): Promise<OutputType> => {
  return api.post("/endpoint", input);
});
```

### 3. Server Action Pattern

All mutations become server actions with cache invalidation:

```typescript
export async function actionName(input: InputType): Promise<OutputType> {
  "use server";
  const out = await api.post("/endpoint", input);
  revalidateTag("tag-name");
  return out;
}
```

### 4. Type-Only Import Pattern

Client imports types from server file (erased at build time):

```typescript
import type { ModelDetailOut } from "./page";
```

## Common Pitfalls

### ❌ Don't: Keep Fallback Logic

If server data is always provided, remove fallback React Query hooks:

```typescript
// ❌ Don't keep both
const modelDetail = serverModelDetail ?? clientModelDetail;
```

### ❌ Don't: Use `unknown` Types

Always use typed server actions, never `unknown`:

```typescript
// ❌ Don't
const action = (input: unknown) => Promise<unknown>;

// ✅ Do
const action = (input: CreateModelIn) => Promise<CreateModelOut>;
```

### ❌ Don't: Forget Cache Invalidation

Always call `revalidateTag()` in server actions:

```typescript
// ✅ Always invalidate
revalidateTag("providers");
```

### ❌ Don't: Skip Type Exports

Export all types from server page for client imports:

```typescript
export type { CreateModelIn, CreateModelOut, ... };
```

## Migration Checklist

- [ ] Remove `useQuery` hooks
- [ ] Remove `useMutation` hooks
- [ ] Remove `useQueryClient` usage
- [ ] Remove `keys` imports (if unused)
- [ ] Add typed server actions to page
- [ ] Add cached fetch functions
- [ ] Update metadata to use cached fetches
- [ ] Export types from server page
- [ ] Import types type-only in client
- [ ] Update props interface
- [ ] Replace mutation calls with server actions
- [ ] Simplify loading states
- [ ] Remove mutation pending checks
- [ ] Test create and update flows

## Benefits Summary

✅ **Type Safety**: Full end-to-end typing from OpenAPI  
✅ **Performance**: Server-side data fetching, no client loading  
✅ **Simplicity**: No React Query boilerplate  
✅ **SEO**: Data available for metadata generation  
✅ **Maintainability**: Single source of truth for types

