# State Management

> Complete guide to the AI Chat state management architecture, including the Zustand store, types system, selectors, and hooks.

---

## Overview

The AI Chat feature uses a **unified Zustand store** as the single source of truth for all state. This document covers:

1. **Types Architecture** - How types are organized in a modular folder structure
2. **Store Structure** - The Zustand store and its state
3. **Selectors** - Optimized hooks for reading state
4. **Domain Hooks** - Business logic combining store + API calls
5. **Backend Sync** - Bidirectional state synchronization with the backend

---

## Types Architecture

Types are organized in a modular folder structure that mirrors the state domains:

```
store/
├── index.ts              # Main Zustand store
├── selectors.ts          # Memoized selector hooks
│
└── types/                # Type definitions (modular structure)
    ├── index.ts          # Barrel export for all types
    ├── conversation.ts   # Conversation-related types
    ├── store.ts          # Store state & actions interfaces
    │
    └── side-panel/       # Side panel state types
        ├── index.ts      # SidePanelState, OpenPanelOptions
        │
        └── views/        # View-specific state types
            ├── index.ts          # ViewState union + re-exports
            ├── agenda.ts         # AgendaViewState
            ├── household-member.ts # HouseholdMemberViewState, HouseholdMemberTab
            ├── household-brief.ts  # HouseholdBriefViewState
            └── etf.ts            # EtfViewState
```

### Type Categories

#### View State Types (`types/side-panel/views/`)

Each view in the side panel has its own state interface:

```typescript
// agenda.ts
export interface AgendaViewState {
  // Currently empty, can be extended for filters, date ranges, etc.
}

// household-member.ts
export type HouseholdMemberTab = "overview" | "accounts" | "notes";

export interface HouseholdMemberViewState {
  memberId: string;           // UUID of the member
  tab: HouseholdMemberTab;    // Active tab
  showHoldings: boolean;      // Holdings detail expanded
  holdingsSearch: string;     // Search filter
}

// household-brief.ts
export interface HouseholdBriefViewState {
  householdId: string;        // UUID of the household
}

// etf.ts
export interface EtfViewState {
  ticker: string;             // Ticker symbol (uppercase, trimmed)
}
```

These are combined into a union type:

```typescript
// views/index.ts
export type ViewState =
  | AgendaViewState
  | HouseholdMemberViewState
  | HouseholdBriefViewState
  | EtfViewState;
```

#### Side Panel State (`types/side-panel/index.ts`)

```typescript
export interface SidePanelState {
  current_view: SidePanelView;  // "agenda" | "householdMember" | "householdBrief" | "etf"
  view_state: ViewState;        // Typed state for current view
  last_updated: string | null;  // ISO timestamp for sync tracking
}

export interface OpenPanelOptions {
  view?: SidePanelView;
  memberId?: string | null;
  householdId?: string | null;
  etfTicker?: string | null;
  showHoldings?: boolean;
}
```

#### Conversation Types (`types/conversation.ts`)

```typescript
// Conversation mode determines context scope
export type ConversationMode = "general" | "household";

// Full conversation state (syncs with backend)
export interface ConversationState {
  mode: ConversationMode;
  household_id: string | null;
  metadata: Record<string, unknown>;
  side_panel: SidePanelState;
}

// Per-conversation state saved/restored when switching conversations
export interface PersistedContextState {
  side_panel: SidePanelState;
  householdId: string | null;
  conversationMode: ConversationMode;
  metadata: Record<string, unknown>;
}

// Backend API response shape (handles legacy formats)
export interface BackendConversationState {
  mode?: string;
  household_id?: string | null;
  side_panel?: { ... };
  context_panel?: { ... };  // @deprecated - legacy format
  metadata?: Record<string, unknown>;
}
```

#### Store Types (`types/store.ts`)

```typescript
// Complete store state
export interface AIChatStoreState {
  // Conversation
  conversationId: string | null;
  isNewConversation: boolean;

  // Side panel
  side_panel: SidePanelState;
  isPanelOpen: boolean;
  isHovering: boolean;

  // Household context (with lock behavior)
  householdId: string | null;
  conversationMode: ConversationMode;
  metadata: Record<string, unknown>;

  // Chat UI
  isScopePanelOpen: boolean;
  activeScopeTab: ScopeTabKey;
  userExplicitlyOpenedScope: boolean;
  isInputFocused: boolean;
  isComposerExpanded: boolean;

  // Search
  householdSearch: string;
  householdTabSearch: string;

  // Persistence
  contextStateMap: Map<string, PersistedContextState>;

  // Hydration flags
  hasHydratedFromBackend: boolean;
  hasHydratedFromLocalStorage: boolean;
}

// All store actions
export interface AIChatStoreActions {
  // Conversation
  setConversationId: (id: string | null) => void;
  markNewConversation: (isNew: boolean) => void;

  // Side panel
  setSidePanelView: (view: SidePanelView, viewState?: ViewState) => void;
  updateViewState: (updates: Partial<ViewState>) => void;
  openPanel: (options?: OpenPanelOptions) => void;
  closePanel: () => void;

  // Navigation
  openHouseholdMember: (memberId: string, options?: { tab?: HouseholdMemberTab }) => void;
  openHousehold: (householdId: string) => void;
  openEtf: (ticker: string) => void;

  // Household context (lock behavior)
  setHouseholdId: (householdId: string) => void;
  clearHouseholdContext: () => void;
  isHouseholdLocked: () => boolean;

  // Chat UI
  setIsScopePanelOpen: (open: boolean) => void;
  setActiveScopeTab: (tab: ScopeTabKey) => void;
  closeScopePanelForStreaming: () => void;
  // ... more actions

  // Persistence
  saveContextState: () => void;
  restoreContextState: (conversationId: string) => boolean;

  // Hydration
  hydrateFromBackend: (state: BackendConversationState) => void;
}

export type AIChatStore = AIChatStoreState & AIChatStoreActions;
```

### Importing Types

```typescript
// Import everything from the barrel export
import type {
  AIChatStore,
  AIChatStoreState,
  SidePanelState,
  ViewState,
  HouseholdMemberViewState,
  ConversationMode,
} from "./store/types";

// Or import from specific files for clarity
import type { HouseholdMemberViewState } from "./store/types/side-panel/views/household-member";
```

---

## Store Architecture

### Mental Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AIChat Component                                │
│                    (Orchestrator - composes all hooks)                  │
└───────────────┬─────────────────────────────────────────────────────────┘
                │ uses
    ┌───────────┴───────────┬───────────────┬─────────────────┐
    ▼                       ▼               ▼                 ▼
┌───────────┐        ┌──────────────┐ ┌─────────────┐  ┌──────────────┐
│useConver- │        │useHousehold- │ │useBackend-  │  │useChat       │
│sation     │        │LockWithAPI   │ │StateSync    │  │(Vercel AI)   │
└─────┬─────┘        └──────┬───────┘ └──────┬──────┘  └──────────────┘
      │                     │                │
      │ hydrates            │ uses           │ subscribes
      ▼                     ▼                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Store Selectors                                   │
│  useHouseholdContextState()  useScopePanelState()  useViewState()  etc. │
└─────────────────────────────────────────────────────────────────────────┘
                                │ read from
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Zustand Store (useAIChatStore)                      │
│                                                                         │
│  conversationId   side_panel   householdId   isScopePanelOpen          │
│  conversationMode   isPanelOpen   activeScopeTab   ...                 │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key insight:** Hooks are NOT independent state containers. They are **views and operations** on ONE shared Zustand store.

### Store Location

**File:** `store/index.ts`

The store uses Zustand with two middleware:
- `subscribeWithSelector` - Enables subscribing to specific state slices
- `persist` - Persists contextStateMap to localStorage

### State Categories

| Category | Fields | Purpose |
|----------|--------|---------|
| **Conversation** | `conversationId`, `isNewConversation` | Active conversation tracking |
| **Side Panel** | `side_panel`, `isPanelOpen`, `isHovering` | Right sidebar view state |
| **Household Context** | `householdId`, `conversationMode`, `metadata` | Household lock state |
| **Chat UI** | `isScopePanelOpen`, `activeScopeTab`, `isInputFocused`, `isComposerExpanded` | Scope panel state |
| **Search** | `householdSearch`, `householdTabSearch` | Search filters |
| **Persistence** | `contextStateMap` | Per-conversation state snapshots |
| **Hydration** | `hasHydratedFromBackend`, `hasHydratedFromLocalStorage` | Hydration flags |

### Household Lock Behavior

The store enforces a **lock** behavior for household context:

```typescript
setHouseholdId: (householdId: string) => {
  const state = get();
  // If already locked to a household, reject the change
  if (state.householdId !== null && state.conversationMode === "household") {
    console.warn("[AIChatStore] Cannot change household - conversation is locked");
    return;
  }

  set({
    householdId,
    conversationMode: "household",
    side_panel: {
      current_view: "householdBrief",
      view_state: { householdId },
      last_updated: new Date().toISOString(),
    },
  });
}
```

Once a conversation is locked to a household, it cannot be changed. Start a new conversation to switch households.

---

## Selectors

**File:** `store/selectors.ts`

Selectors provide **optimized subscriptions** to specific store slices using `useShallow`.

### Why Selectors?

Without selectors, every component re-renders on ANY store change:

```typescript
// BAD: Re-renders on every store change
const viewMode = useAIChatStore((state) => state.side_panel.current_view);
const isPanelOpen = useAIChatStore((state) => state.isPanelOpen);
```

With selectors using `useShallow`, components only re-render when THEIR slice changes:

```typescript
// GOOD: Only re-renders when these specific values change
const { currentView, isPanelOpen, isHovering } = useViewState();
```

### Available Selectors

#### State Selectors (Read-Only)

| Selector | Returns | Used By |
|----------|---------|---------|
| `useViewState()` | `{ currentView, isPanelOpen, isHovering }` | RightSideBar |
| `useSidePanelState()` | `SidePanelState` | Views |
| `useSelectionState()` | `{ selectedMemberId, selectedHouseholdId, etfTicker }` | Various |
| `useHouseholdContextState()` | `{ householdId, conversationMode, metadata, isLocked }` | Chat |
| `useScopePanelState()` | `{ isScopePanelOpen, activeScopeTab, ... }` | AIChat |
| `useConversationState()` | `{ conversationId, isNewConversation, ... }` | Various |
| `useTabState()` | `{ householdMemberTab, showMemberHoldings, ... }` | HouseholdMemberView |

#### Action Selectors (Write)

| Selector | Returns | Purpose |
|----------|---------|---------|
| `usePanelActions()` | `{ openPanel, closePanel, setSidePanelView, updateViewState, ... }` | Control sidebar |
| `useNavigationActions()` | `{ openHouseholdMember, openHousehold, openEtf, ... }` | Navigate views |
| `useHouseholdContextActions()` | `{ setHouseholdId, clearHouseholdContext }` | Household context |
| `useScopePanelActions()` | `{ setIsScopePanelOpen, setActiveScopeTab, ... }` | Scope panel |

#### Computed Selectors (Derived State)

| Selector | Returns | Logic |
|----------|---------|-------|
| `useIsHouseholdView()` | `boolean` | `current_view === "householdMember" \|\| "householdBrief"` |
| `useIsEtfView()` | `boolean` | `current_view === "etf"` |
| `useIsAgendaView()` | `boolean` | `current_view === "agenda"` |
| `useHasSelection()` | `boolean` | Any selection is active |
| `useIsHouseholdLocked()` | `boolean` | `householdId !== null && conversationMode === "household"` |

### Usage Pattern

```typescript
import { useViewState, usePanelActions } from "../../store/selectors";

function RightSideBar() {
  // Read state (only re-renders when these specific values change)
  const { currentView, isPanelOpen, isHovering } = useViewState();

  // Get actions (stable references, never cause re-renders)
  const { closePanel, setSidePanelView } = usePanelActions();

  return (
    <button onClick={() => closePanel()}>Close</button>
  );
}
```

---

## Domain Hooks

**Location:** `hooks/`

Domain hooks combine **store state + API calls + business logic**.

### Hook Pattern

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

### Hook Catalog

| Hook | Purpose | Combines |
|------|---------|----------|
| `useConversation` | Conversation lifecycle | URL params, session, tRPC, store hydration |
| `useHouseholdLockWithAPI` | Lock conversation to household | Store selectors, `selectClient` mutation |
| `useBackendStateSync` | Sync state to backend | Store subscriptions, `updateState` mutation |
| `useHouseholdManagement` | Fetch & filter households | tRPC query, local filtering |
| `useChatProcessing` | Track AI thinking steps | Vercel AI SDK stream data |
| `useConversationHistory` | Load previous messages | tRPC query |
| `useAgendaData` | Meeting data for context | tRPC query |

### Key Hook: `useHouseholdLockWithAPI`

```typescript
const {
  setHousehold,      // Lock to a household (calls API first)
  clearContext,      // Clear household context
  householdId,       // Current locked household
  isLocked,          // Is conversation locked
  isPending,         // API call in progress
} = useHouseholdLockWithAPI(conversationId);
```

### Key Hook: `useBackendStateSync`

Subscribes to store changes and syncs to backend with debouncing:

```typescript
useBackendStateSync(conversationId);
// Internally:
// - Subscribes to side_panel changes
// - Debounces 1000ms
// - PATCH /copilot/conversations/{id}/state
```

---

## Backend Sync

A bidirectional state synchronization system creates a "Shared Reality" where:
- The agent always knows what the user is looking at
- User-driven UI changes are persisted to the backend
- Agent-driven view changes update the frontend in real-time

### Shared Data Contract

| Frontend (Zustand Store) | Backend (`ConversationState` JSONB) |
|--------------------------|-------------------------------------|
| `side_panel.current_view` | `side_panel.current_view` |
| `side_panel.view_state` | `side_panel.view_state` |
| `householdId` | `household_id` |
| `conversationMode` | `mode` |
| `isPanelOpen` | `metadata.is_panel_open` |

### Sync Flows

#### User-Driven (Frontend → Backend)

```
User clicks tab / selects client
       ↓
useBackendStateSync hook detects change
       ↓
Debounce ~1000ms
       ↓
PATCH /copilot/conversations/{id}/state
       ↓
Backend DB updated
       ↓
Agent loads current state on next message
```

#### Agent-Driven (Backend → Frontend)

```
Agent calls tool (e.g., GetHouseholdHoldings)
       ↓
Backend emits stream event: context_panel_update
       ↓
Frontend stream handler receives event
       ↓
Dispatches to Zustand store
       ↓
UI updates in real-time
```

### Visual Context Injection

The agent receives visual context in its system prompt:

```text
<visual_context>
User is currently viewing: Holdings Table
Active Household: Smith Family
Panel is: Open
</visual_context>
```

This allows contextual references like "What is the performance of **this**?"

---

## Summary

| Layer | Location | Purpose | Example |
|-------|----------|---------|---------|
| **Types** | `store/types/` | Type definitions (modular structure) | `HouseholdMemberViewState` |
| **Store** | `store/index.ts` | Single source of truth | `useAIChatStore` |
| **Selectors** | `store/selectors.ts` | Optimized subscriptions | `useViewState()` |
| **Domain Hooks** | `hooks/*.ts` | Business logic + API | `useHouseholdLockWithAPI` |
| **Orchestrator** | `_components/chat/index.tsx` | Compose everything | `AIChat` |

**The hooks are not independent state containers.** They are **views and operations** on one shared Zustand store, enhanced with API calls and business logic.
