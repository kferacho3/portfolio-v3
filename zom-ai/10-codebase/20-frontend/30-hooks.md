---
covers: Domain hooks pattern combining store state, API calls, and business logic.
concepts: [domain-hooks, use-household-lock, use-backend-state-sync, hook-pattern, trpc]
---

# Domain Hooks

Domain hooks are the layer between components and the store/API. They combine **store state + API calls + business logic** into cohesive interfaces.

## Overview

**Location**: `hooks/`

The key insight: hooks are NOT independent state containers. They are **views and operations** on one shared Zustand store, enhanced with API calls and business logic.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Domain Hooks                                         │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │ useConversation │  │ useHousehold-   │  │ useBackend-     │              │
│  │                 │  │ LockWithAPI     │  │ StateSync       │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                    │                        │
│           └────────────────────┼────────────────────┘                        │
│                                │                                             │
│                                ▼                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Zustand Store + tRPC Mutations                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Hook Pattern

All domain hooks follow this structure:

```typescript
function useSomeDomainHook(dependencies) {
  // 1. Read state from store (via selectors)
  const state = useSomeSelector();

  // 2. Get actions from store
  const { someAction } = useSomeActions();

  // 3. Setup tRPC mutations/queries
  const mutation = api.something.useMutation();

  // 4. Business logic wrapped in useCallback
  const doSomething = useCallback(async () => {
    // Guard conditions
    if (state.isLocked) return { success: false };

    // API call FIRST
    await mutation.mutateAsync({ ... });

    // Update store AFTER API succeeds
    someAction();
  }, [state, mutation, someAction]);

  // 5. Return combined interface
  return { doSomething, ...state, isPending: mutation.isPending };
}
```

## Hook Catalog

| Hook | Purpose | Combines |
|------|---------|----------|
| `useConversation` | Conversation lifecycle | URL params, session, tRPC, store hydration |
| `useHouseholdLockWithAPI` | Lock conversation to household | Store selectors, `selectClient` mutation |
| `useBackendStateSync` | Sync state to backend | Store subscriptions, `updateState` mutation |
| `useHouseholdManagement` | Fetch & filter households | tRPC query, local filtering |
| `useChatProcessing` | Track AI thinking steps | Vercel AI SDK stream data |
| `useConversationHistory` | Load previous messages | tRPC query |
| `useAgendaData` | Meeting data for context | tRPC query |

## Key Hook: useConversation

Manages the conversation lifecycle including creation, URL params, and store hydration.

```typescript
const {
  token,              // Auth token for API calls
  conversationId,     // Current conversation UUID
  ensureConversation, // Create if doesn't exist
  isCreating,         // Creation in progress
} = useConversation();
```

### Responsibilities

1. **URL Param Sync**: Read/write `conversationId` to URL
2. **Session Token**: Provide auth token for API calls
3. **Conversation Creation**: Create via `api.copilot.createConversation`
4. **State Hydration**: Load backend state on conversation change

### Flow

```
Component mounts
       │
       ▼
Read conversationId from URL
       │
       ├─── Has ID ─→ Load backend state ─→ Hydrate store
       │
       └─── No ID ─→ Wait for user action
                           │
                           ▼ (user sends message)
                     ensureConversation()
                           │
                           ▼
                     createConversation mutation
                           │
                           ▼
                     Update URL with new ID
```

## Key Hook: useHouseholdLockWithAPI

Handles locking a conversation to a household with API coordination.

```typescript
const {
  setHousehold,      // Lock to a household (calls API first)
  clearContext,      // Clear household context
  householdId,       // Current locked household
  isLocked,          // Is conversation locked
  isPending,         // API call in progress
} = useHouseholdLockWithAPI(conversationId);
```

### Implementation

```typescript
function useHouseholdLockWithAPI(conversationId: string | null) {
  // 1. Store state
  const { householdId, conversationMode } = useHouseholdContextState();
  const { setHouseholdId, clearHouseholdContext } = useHouseholdContextActions();

  // 2. tRPC mutation
  const selectClient = api.copilot.selectClient.useMutation();

  // 3. Business logic
  const setHousehold = useCallback(async (id: string) => {
    // Guard: already locked
    if (conversationMode === "household") {
      return { success: false, reason: "already_locked" };
    }

    // API call FIRST
    await selectClient.mutateAsync({
      conversationId,
      householdId: id,
    });

    // Update store AFTER API succeeds
    setHouseholdId(id);

    return { success: true };
  }, [conversationId, conversationMode, selectClient, setHouseholdId]);

  // 4. Return combined interface
  return {
    setHousehold,
    clearContext: clearHouseholdContext,
    householdId,
    isLocked: conversationMode === "household",
    isPending: selectClient.isPending,
  };
}
```

### Why API First?

The API must be called **before** updating the store because:
1. The backend validates the household exists
2. The backend records the lock in the database
3. If API fails, we don't want inconsistent state

## Key Hook: useBackendStateSync

Subscribes to store changes and syncs to backend with debouncing.

```typescript
useBackendStateSync(conversationId);
```

### Implementation

```typescript
function useBackendStateSync(conversationId: string | null) {
  const updateState = api.copilot.updateState.useMutation();

  useEffect(() => {
    if (!conversationId) return;

    // Subscribe to side_panel changes in store
    const unsubscribe = useAIChatStore.subscribe(
      (state) => state.side_panel,
      debounce((sidePanel) => {
        updateState.mutate({
          conversationId,
          state: { side_panel: sidePanel },
        });
      }, 1000),
    );

    return unsubscribe;
  }, [conversationId, updateState]);
}
```

### Sync Flow

```
User clicks tab in sidebar
         │
         ▼
Store updates: side_panel.current_view
         │
         ▼
useBackendStateSync subscription fires
         │
         ▼
Debounce 1000ms (prevents rapid updates)
         │
         ▼
PATCH /copilot/conversations/{id}/state
         │
         ▼
Backend database updated
         │
         ▼
Agent loads current state on next message
```

## Hook: useHouseholdManagement

Fetches and filters the household list.

```typescript
const {
  households,           // Filtered household list
  selectedHouseholdId,  // Currently selected
  isLoading,            // Query in progress
  search,               // Current search string
  setSearch,            // Update search filter
} = useHouseholdManagement();
```

### Features

- Fetches households via tRPC
- Local search filtering
- Integrates with store for selected state

## Hook: useChatProcessing

Tracks AI "thinking" steps from stream events.

```typescript
const {
  processingSteps,  // Array of step descriptions
  isProcessing,     // AI is thinking
  currentStep,      // Latest step
} = useChatProcessing(streamData);
```

### Stream Events Tracked

| Event | Step Description |
|-------|------------------|
| `thinking` | "Analyzing your question..." |
| `tool_call_start` | "Fetching [tool name]..." |
| `tool_call_result` | "[tool name] complete" |

## Hook: useConversationHistory

Loads previous messages for a conversation.

```typescript
const {
  messages,    // Message history
  isLoading,   // Query in progress
  error,       // Query error
} = useConversationHistory(conversationId);
```

## Usage in Components

The `AIChat` component composes all hooks:

```typescript
function AIChat() {
  // Conversation lifecycle
  const { conversationId, ensureConversation } = useConversation();

  // Backend sync (runs automatically)
  useBackendStateSync(conversationId);

  // Household lock
  const { setHousehold, isLocked } = useHouseholdLockWithAPI(conversationId);

  // Household list
  const { households, search, setSearch } = useHouseholdManagement();

  // Chat processing
  const { processingSteps } = useChatProcessing(streamData);

  // ... render UI
}
```

## Creating New Hooks

When adding new domain functionality:

1. **Create hook file** in `hooks/` directory
2. **Follow the pattern**: store selectors → actions → tRPC → business logic
3. **API first**: Call API before updating store
4. **Return combined interface**: State + actions + pending flags
5. **Export from barrel**: Add to `hooks/index.ts`

## Related Documentation

- [State Management](20-state-management.md) - Zustand store and selectors
- [Components](10-components.md) - Components that use hooks
- [State Sync](../30-integration/30-state-sync.md) - Backend synchronization details
