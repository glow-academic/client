# Spec: WebSocket + Server Actions Pattern

## Overview

This spec defines the pattern for migrating real-time WebSocket-based components (like simulations/chats) from React Query to **SSR snapshot + WebSocket live patches**. This is the edge case that, once solved, makes all other migrations trivial.

## Problem Statement

Current approach uses React Query for:
- Initial data fetching (`useQuery` for attempt/chats)
- Cache invalidation on WebSocket events
- Optimistic updates and refetching

**Issues:**
- Client-side waterfall (loading states on first paint)
- Complex cache invalidation logic
- Duplicated type definitions
- React Query cache management overhead

## Solution: SSR Snapshot + WebSocket Patches

**Pattern:**
1. **Server (RSC)**: Fetch initial snapshot (typed from OpenAPI), pass to client
2. **Client Store**: Hydrate from snapshot, apply WebSocket deltas
3. **WebSocket Contract**: Single source of truth for WS events (Zod schemas)
4. **Reconcile Action**: Optional server action to refresh snapshot after major transitions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ Server (RSC)                                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ page.tsx                                              │  │
│  │  • getAttemptFull = cache(...)                       │  │
│  │  • reconcile() server action                         │  │
│  │  • Pass initial snapshot + actions to client         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ props: { initial, reconcile }
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Client                                                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ SimulationClient.tsx                                  │  │
│  │  • Initialize store from initial snapshot            │  │
│  │  • Subscribe to WebSocket events                      │  │
│  │  • Patch local store on WS events                     │  │
│  │  • Call reconcile() on terminal events                 │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ contracts/sim-ws.ts                                   │  │
│  │  • Zod schemas for all WS events                      │  │
│  │  • Type exports for emits                              │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
client/
├── app/(main)/
│   └── practice/a/[attemptId]/
│       └── page.tsx                    # RSC page with server actions
│       └── SimulationClient.tsx        # Client store + WS handler
│
├── contracts/
│   └── sim-ws.ts                       # WebSocket event contracts (Zod)
│
└── contexts/
    └── websocket-context.tsx           # Existing WS connection (keep)
```

## Implementation

### 1. WebSocket Contract File (`contracts/sim-ws.ts`)

**Purpose**: Single source of truth for WebSocket events with runtime validation

```typescript
import { z } from "zod";

// ============================================================================
// WebSocket Event Schemas (Incoming)
// ============================================================================

export const SimulationMessageTokenSchema = z.object({
  type: z.literal("simulation_message_token"),
  message_id: z.string(),
  chat_id: z.string(),
  accumulated_content: z.string(),
});

export const SimulationMessageCompleteSchema = z.object({
  type: z.literal("simulation_message_complete"),
  message_id: z.string(),
  chat_id: z.string(),
  final_content: z.string(),
});

export const SimulationChatEndedSchema = z.object({
  type: z.literal("simulation_chat_ended"),
  chat_id: z.string(),
});

export const GradingProgressSchema = z.object({
  type: z.literal("grading_progress"),
  chat_id: z.string().optional(),
  completed_count: z.number().optional(),
  total_count: z.number().optional(),
  phase: z.enum(["tools", "summary"]).optional(),
});

// Union of all incoming events
export const AnySimEventSchema = z.discriminatedUnion("type", [
  SimulationMessageTokenSchema,
  SimulationMessageCompleteSchema,
  SimulationChatEndedSchema,
  GradingProgressSchema,
]);

export type TSimulationMessageToken = z.infer<typeof SimulationMessageTokenSchema>;
export type TSimulationMessageComplete = z.infer<typeof SimulationMessageCompleteSchema>;
export type TSimulationChatEnded = z.infer<typeof SimulationChatEndedSchema>;
export type TGradingProgress = z.infer<typeof GradingProgressSchema>;
export type TAnySimEvent = z.infer<typeof AnySimEventSchema>;

// Export for runtime validation
export const AnySimEvent = AnySimEventSchema;

// ============================================================================
// WebSocket Emit Types (Outgoing)
// ============================================================================

export type SendSimulationMessage = {
  chat_id: string;
  message: string;
  isRetry?: boolean;
};

export type StopSimulation = {
  chat_id: string;
};

export type ContinueSimulation = {
  chat_id: string;
  attempt_id: string;
  end_all?: boolean;
  previous_chat_id?: string;
  previous_chat_map?: Record<string, string | null>;
  department_id?: string;
};
```

### 2. Server Page (`app/(main)/practice/a/[attemptId]/page.tsx`)

**Purpose**: Fetch initial snapshot, provide reconcile action

```typescript
import { cache } from "react";
import { revalidateTag } from "next/cache";
import { auth } from "@/auth";
import { api } from "@/lib/api/client";
import type { InputOf, OutputOf } from "@/lib/api/types";
import SimulationClient from "./SimulationClient";

/** ---- Strong types from OpenAPI ---- */
type AttemptFullIn = InputOf<"/api/v3/attempts/full", "post">;
type AttemptFullOut = OutputOf<"/api/v3/attempts/full", "post">;

/** ---- Cached fetch (prevents duplicate requests) ---- */
const getAttemptFull = cache(
  async (input: AttemptFullIn): Promise<AttemptFullOut> => {
    return api.post("/attempts/full", input);
  }
);

/** ---- Server action for reconciliation ---- */
export async function reconcileAttempt(
  input: AttemptFullIn
): Promise<AttemptFullOut> {
  "use server";
  // Optionally revalidate cache tag for cross-page effects
  // revalidateTag(`attempts:${input.body.attemptId}`);
  return getAttemptFull(input);
}

/** ---- Page component ---- */
export default async function AttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  const session = await auth();
  const profileId = session?.effectiveProfileId || "";

  // Fetch initial snapshot
  const initial = await getAttemptFull({
    body: { attemptId, profileId },
  });

  return (
    <SimulationClient
      attemptId={attemptId}
      initial={initial}
      reconcile={reconcileAttempt}
    />
  );
}

/** ---- Export types for client (type-only imports) ---- */
export type { AttemptFullOut };
```

### 3. Client Store (`SimulationClient.tsx`)

**Purpose**: Manage local state, apply WebSocket patches, expose actions

```typescript
"use client";

import { useEffect, useMemo, useRef, useState, createContext, useContext } from "react";
import type { AttemptFullOut } from "./page";
import { AnySimEvent, type TAnySimEvent } from "@/contracts/sim-ws";
import { useWebSocket } from "@/contexts/websocket-context";
import { toast } from "sonner";
import type {
  SendSimulationMessage,
  StopSimulation,
  ContinueSimulation,
} from "@/contracts/sim-ws";

// ============================================================================
// Types
// ============================================================================

type Chat = AttemptFullOut["chats"][number];
type Message = Chat["messages"][number];

type SimState = {
  chats: Record<string, Chat>;
  grading: {
    chatId: string;
    completed: number;
    total: number;
    phase: "tools" | "summary" | null;
  } | null;
};

type SimulationContextType = {
  state: SimState;
  send: (params: SendSimulationMessage) => void;
  stop: (params: StopSimulation) => void;
  continue: (params: ContinueSimulation) => void;
  hardRefresh: () => Promise<void>;
};

type Props = {
  attemptId: string;
  initial: AttemptFullOut;
  reconcile: (input: { body: { attemptId: string; profileId: string } }) => Promise<AttemptFullOut>;
};

// ============================================================================
// Context
// ============================================================================

const SimulationContext = createContext<SimulationContextType | null>(null);

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error("useSimulation must be used within SimulationClient");
  }
  return ctx;
}

// ============================================================================
// Component
// ============================================================================

export default function SimulationClient({
  attemptId,
  initial,
  reconcile,
}: Props) {
  const { socket, isConnected } = useWebSocket();
  const profileIdRef = useRef<string>(""); // Get from auth context

  // Initialize state from server snapshot
  const [state, setState] = useState<SimState>(() => {
    const chats: SimState["chats"] = {};
    for (const chat of initial.chats) {
      chats[chat.chat.id] = chat;
    }
    return {
      chats,
      grading: null,
    };
  });

  // ============================================================================
  // Reconciliation
  // ============================================================================

  const hardRefresh = async () => {
    try {
      const fresh = await reconcile({
        body: { attemptId, profileId: profileIdRef.current },
      });
      
      setState(() => {
        const chats: SimState["chats"] = {};
        for (const chat of fresh.chats) {
          chats[chat.chat.id] = chat;
        }
        return {
          chats,
          grading: null,
        };
      });
    } catch (error) {
      toast.error("Failed to refresh data");
      console.error("Reconciliation error:", error);
    }
  };

  // ============================================================================
  // WebSocket Emitters
  // ============================================================================

  const send = (params: SendSimulationMessage) => {
    if (!socket || !isConnected) {
      toast.error("WebSocket disconnected");
      return;
    }
    socket.emit("send_simulation_message", params);
  };

  const stop = (params: StopSimulation) => {
    if (!socket || !isConnected) {
      toast.error("WebSocket disconnected");
      return;
    }
    socket.emit("stop_simulation", params);
  };

  const cont = (params: ContinueSimulation) => {
    if (!socket || !isConnected) {
      toast.error("WebSocket disconnected");
      return;
    }
    socket.emit("continue_simulation", params);
  };

  // ============================================================================
  // WebSocket Event Handlers
  // ============================================================================

  useEffect(() => {
    if (!socket) return;

    const handleSimEvent = (raw: unknown) => {
      // Runtime validation with Zod
      const parsed = AnySimEvent.safeParse(raw);
      if (!parsed.success) {
        console.warn("Invalid WebSocket event:", parsed.error);
        return;
      }

      const event: TAnySimEvent = parsed.data;

      // Handle message token updates (streaming)
      if (event.type === "simulation_message_token") {
        setState((s) => {
          const chat = s.chats[event.chat_id];
          if (!chat) return s;

          const messageIndex = chat.messages.findIndex(
            (m) => m.id === event.message_id
          );

          if (messageIndex >= 0) {
            // Update existing message
            const updated = [...chat.messages];
            updated[messageIndex] = {
              ...updated[messageIndex],
              content: event.accumulated_content,
            };
            return {
              ...s,
              chats: {
                ...s.chats,
                [event.chat_id]: {
                  ...chat,
                  messages: updated,
                },
              },
            };
          } else {
            // Create new message
            const newMessage: Message = {
              id: event.message_id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              chatId: event.chat_id,
              content: event.accumulated_content,
              type: "response",
              completed: false,
            };
            return {
              ...s,
              chats: {
                ...s.chats,
                [event.chat_id]: {
                  ...chat,
                  messages: [...chat.messages, newMessage],
                },
              },
            };
          }
        });
      }

      // Handle message completion
      if (event.type === "simulation_message_complete") {
        setState((s) => {
          const chat = s.chats[event.chat_id];
          if (!chat) return s;

          const messageIndex = chat.messages.findIndex(
            (m) => m.id === event.message_id
          );

          if (messageIndex >= 0) {
            const updated = [...chat.messages];
            updated[messageIndex] = {
              ...updated[messageIndex],
              content: event.final_content,
              completed: true,
            };
            return {
              ...s,
              chats: {
                ...s.chats,
                [event.chat_id]: {
                  ...chat,
                  messages: updated,
                },
              },
            };
          }
          return s;
        });
      }

      // Handle chat ended - reconcile with server
      if (event.type === "simulation_chat_ended") {
        toast.success("Chat completed");
        // Reconcile to get fresh state from server
        queueMicrotask(() => hardRefresh());
      }

      // Handle grading progress
      if (event.type === "grading_progress" && event.chat_id) {
        setState((s) => ({
          ...s,
          grading: {
            chatId: event.chat_id!,
            completed: event.completed_count ?? s.grading?.completed ?? 0,
            total: event.total_count ?? s.grading?.total ?? 0,
            phase: (event.phase ?? s.grading?.phase) ?? "tools",
          },
        }));
      }
    };

    // Subscribe to WebSocket events
    socket.on("sim_event", handleSimEvent);

    return () => {
      socket.off("sim_event", handleSimEvent);
    };
  }, [socket, isConnected]);

  // ============================================================================
  // Context Value
  // ============================================================================

  const value = useMemo<SimulationContextType>(
    () => ({
      state,
      send,
      stop,
      continue: cont,
      hardRefresh,
    }),
    [state, socket, isConnected]
  );

  return (
    <SimulationContext.Provider value={value}>
      {/* Render children that consume useSimulation() */}
      {children}
    </SimulationContext.Provider>
  );
}

// ============================================================================
// Export Types
// ============================================================================

export type { SimState, SimulationContextType };
```

## Migration Checklist

### Phase 1: Setup

- [ ] Create `contracts/sim-ws.ts` with Zod schemas for all WebSocket events
- [ ] Define emit types for outgoing events
- [ ] Export types for server and client use

### Phase 2: Server Page

- [ ] Add `AttemptFullIn` and `AttemptFullOut` types from OpenAPI
- [ ] Create `getAttemptFull` cached fetch function
- [ ] Create `reconcileAttempt` server action
- [ ] Update `generateMetadata` to use cached fetch
- [ ] Export types for client import

### Phase 3: Client Store

- [ ] Create `SimulationClient.tsx` component
- [ ] Initialize state from server snapshot
- [ ] Implement WebSocket event handlers with Zod validation
- [ ] Implement patch logic for each event type
- [ ] Add reconcile call on terminal events
- [ ] Expose `useSimulation()` hook

### Phase 4: Migration

- [ ] Replace React Query `useQuery` with server snapshot
- [ ] Remove `useMutation` calls, use WebSocket emitters
- [ ] Remove `queryClient.invalidateQueries` calls
- [ ] Update components to use `useSimulation()` hook
- [ ] Remove React Query imports

### Phase 5: Testing

- [ ] Test initial load (SSR snapshot)
- [ ] Test WebSocket streaming (token events)
- [ ] Test message completion
- [ ] Test chat ended reconciliation
- [ ] Test grading progress updates
- [ ] Test reconnect scenarios

## Key Patterns

### 1. Runtime Validation

Always validate WebSocket events with Zod:

```typescript
const parsed = AnySimEvent.safeParse(raw);
if (!parsed.success) {
  console.warn("Invalid event:", parsed.error);
  return;
}
```

### 2. Patch Strategy

Update state immutably with patches:

```typescript
setState((s) => {
  const chat = s.chats[event.chat_id];
  if (!chat) return s;
  
  // Create updated copy
  const updated = { ...chat, messages: [...chat.messages] };
  // Apply patch
  updated.messages[index] = { ...updated.messages[index], ...patch };
  
  return { ...s, chats: { ...s.chats, [event.chat_id]: updated } };
});
```

### 3. Reconciliation Timing

Call reconcile on terminal events, not on every update:

```typescript
// ✅ Good: Reconcile on chat ended
if (event.type === "simulation_chat_ended") {
  queueMicrotask(() => hardRefresh());
}

// ❌ Bad: Reconcile on every token
if (event.type === "simulation_message_token") {
  hardRefresh(); // Too expensive!
}
```

### 4. Cache Tagging

Tag server fetches for cross-page invalidation:

```typescript
// Server action
revalidateTag(`attempts:${attemptId}`);
```

## Benefits

✅ **No Client Waterfall**: SSR snapshot provides instant first paint  
✅ **Live Updates**: WebSocket patches provide real-time updates  
✅ **Type Safety**: Full typing from OpenAPI + Zod runtime validation  
✅ **Simpler Code**: No React Query cache management  
✅ **Single Source of Truth**: One contract file for all WS events  
✅ **DHH-Aligned**: Cache on server, not client

## Common Pitfalls

### ❌ Don't: Reconcile on Every Update

Only reconcile on terminal events (chat ended, simulation complete):

```typescript
// ❌ Bad
if (event.type === "simulation_message_token") {
  hardRefresh(); // Too expensive!
}

// ✅ Good
if (event.type === "simulation_chat_ended") {
  queueMicrotask(() => hardRefresh());
}
```

### ❌ Don't: Skip Runtime Validation

Always validate WebSocket events:

```typescript
// ❌ Bad
socket.on("sim_event", (event: TAnySimEvent) => {
  // No validation!
});

// ✅ Good
socket.on("sim_event", (raw: unknown) => {
  const parsed = AnySimEvent.safeParse(raw);
  if (!parsed.success) return;
  const event: TAnySimEvent = parsed.data;
});
```

### ❌ Don't: Mutate State Directly

Always update state immutably:

```typescript
// ❌ Bad
const chat = state.chats[chatId];
chat.messages.push(newMessage); // Mutation!

// ✅ Good
setState((s) => ({
  ...s,
  chats: {
    ...s.chats,
    [chatId]: {
      ...s.chats[chatId],
      messages: [...s.chats[chatId].messages, newMessage],
    },
  },
}));
```

## Future Enhancements

1. **Idempotency Keys**: Add idempotency keys to send/continue to avoid duplicates after reconnect
2. **Zustand Store**: Migrate from Context to Zustand if store grows complex
3. **Message Pagination**: Add `loadOlder()` function for paginated message loading
4. **Optimistic Updates**: Add optimistic updates for send actions (show message immediately)
5. **Reconnect Handling**: Automatic reconciliation on WebSocket reconnect

## Related Patterns

- See `migration-server-actions.md` for non-WebSocket migrations
- See `websocket-context.tsx` for WebSocket connection management
- See OpenAPI spec for endpoint type definitions

