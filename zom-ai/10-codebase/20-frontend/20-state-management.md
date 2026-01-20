---
covers: Zustand store architecture, types system, selectors, and state patterns.
concepts: [zustand, selectors, use-shallow, household-lock, side-panel-state, types-architecture]
---

# State Management

The AI Chat feature uses a **unified Zustand store** as the single source of truth for all state. This document covers the store architecture, types system, and selector patterns.

## Mental Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AIChat Component                                     │
│                    (Orchestrator - composes all hooks)                       │
└───────────────┬─────────────────────────────────────────────────────────────┘
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
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Store Selectors                                        │
│  useHouseholdContextState()  useScopePanelState()  useViewState()  etc.      │
└─────────────────────────────────────────────────────────────────────────────┘
                                │ read from
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Zustand Store (useAIChatStore)                           │
│                                                                              │
│  conversationId   side_panel   householdId   isScopePanelOpen               │
│  conversationMode   isPanelOpen   activeScopeTab   ...                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key insight:** Hooks are NOT independent state containers. They are **views and operations** on ONE shared Zustand store.

## Store Structure

**Location**: `store/index.ts`

The store uses Zustand with two middleware:
- `subscribeWithSelector` - Enables subscribing to specific state slices
- `persist` - Persists contextStateMap to localStorage

### State Categories

| Category | Fields | Purpose |
|----------|--------|---------|
| **Conversation** | `conversationId`, `isNewConversation` | Active conversation tracking |
| **Side Panel** | `side_panel`, `isPanelOpen`, `isHovering` | Right sidebar view state |
| **Household Context** | `householdId`, `conversationMode`, `metadata` | Household lock state |
| **Chat UI** | `isScopePanelOpen`, `activeScopeTab`, `isInputFocused` | Scope panel state |
| **Search** | `householdSearch`, `householdTabSearch` | Search filters |
| **Persistence** | `contextStateMap` | Per-conversation state snapshots |
| **Hydration** | `hasHydratedFromBackend`, `hasHydratedFromLocalStorage` | Hydration flags |

## Types Architecture

Types are organized in a modular folder structure that mirrors state domains:

```
store/types/
├── index.ts              # Barrel export
├── conversation.ts       # Conversation types
├── store.ts              # Store interfaces
│
└── side-panel/           # Side panel types
    ├── index.ts          # SidePanelState, OpenPanelOptions
    │
    └── views/            # View-specific state types
        ├── index.ts          # ViewState union
        ├── agenda.ts         # AgendaViewState
        ├── household-member.ts # HouseholdMemberViewState
        ├── household-brief.ts  # HouseholdBriefViewState
        └── etf.ts            # EtfViewState
```

### View State Types

Each view has its own state interface:

```typescript
// household-member.ts
type HouseholdMemberTab = "overview" | "accounts" | "notes";

interface HouseholdMemberViewState {
  memberId: string;           // UUID of the member
  tab: HouseholdMemberTab;    // Active tab
  showHoldings: boolean;      // Holdings detail expanded
  holdingsSearch: string;     // Search filter
}

// household-brief.ts
interface HouseholdBriefViewState {
  householdId: string;        // UUID of the household
}

// etf.ts
interface EtfViewState {
  ticker: string;             // Ticker symbol
}
```

### Side Panel State

```typescript
interface SidePanelState {
  current_view: SidePanelView;  // "agenda" | "householdMember" | "householdBrief" | "etf"
  view_state: ViewState;        // Typed state for current view
  last_updated: string | null;  // ISO timestamp for sync tracking
}
```

### Conversation Types

```typescript
type ConversationMode = "general" | "household";

interface ConversationState {
  mode: ConversationMode;
  household_id: string | null;
  metadata: Record<string, unknown>;
  side_panel: SidePanelState;
}
```

## Household Lock Behavior

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

## Selectors

**Location**: `store/selectors.ts`

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

### State Selectors (Read-Only)

| Selector | Returns | Used By |
|----------|---------|---------|
| `useViewState()` | `{ currentView, isPanelOpen, isHovering }` | RightSideBar |
| `useSidePanelState()` | `SidePanelState` | Views |
| `useSelectionState()` | `{ selectedMemberId, selectedHouseholdId, etfTicker }` | Various |
| `useHouseholdContextState()` | `{ householdId, conversationMode, metadata, isLocked }` | Chat |
| `useScopePanelState()` | `{ isScopePanelOpen, activeScopeTab, ... }` | AIChat |
| `useConversationState()` | `{ conversationId, isNewConversation, ... }` | Various |
| `useTabState()` | `{ householdMemberTab, showMemberHoldings, ... }` | HouseholdMemberView |

### Action Selectors (Write)

| Selector | Returns | Purpose |
|----------|---------|---------|
| `usePanelActions()` | `{ openPanel, closePanel, setSidePanelView, ... }` | Control sidebar |
| `useNavigationActions()` | `{ openHouseholdMember, openHousehold, openEtf, ... }` | Navigate views |
| `useHouseholdContextActions()` | `{ setHouseholdId, clearHouseholdContext }` | Household context |
| `useScopePanelActions()` | `{ setIsScopePanelOpen, setActiveScopeTab, ... }` | Scope panel |

### Computed Selectors (Derived State)

| Selector | Returns | Logic |
|----------|---------|-------|
| `useIsHouseholdView()` | `boolean` | `current_view === "householdMember" \|\| "householdBrief"` |
| `useIsEtfView()` | `boolean` | `current_view === "etf"` |
| `useIsAgendaView()` | `boolean` | `current_view === "agenda"` |
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

## Backend Sync

The frontend state syncs bidirectionally with the backend:

### Shared Data Contract

| Frontend (Zustand Store) | Backend (`ConversationState` JSONB) |
|--------------------------|-------------------------------------|
| `side_panel.current_view` | `side_panel.current_view` |
| `side_panel.view_state` | `side_panel.view_state` |
| `householdId` | `household_id` |
| `conversationMode` | `mode` |
| `isPanelOpen` | `metadata.is_panel_open` |

### Sync Direction

```
Frontend → Backend (User-Driven)
─────────────────────────────────
User clicks tab
     ↓
useBackendStateSync detects change
     ↓
Debounce ~1000ms
     ↓
PATCH /conversations/{id}/state


Backend → Frontend (Agent-Driven)
─────────────────────────────────
Agent calls tool
     ↓
Backend emits: side_panel_update event
     ↓
Stream handler receives event
     ↓
Zustand store updated
     ↓
UI updates in real-time
```

See [State Sync](../30-integration/30-state-sync.md) for full integration details.

## Store Actions Summary

| Action | Effect |
|--------|--------|
| `setConversationId(id)` | Set active conversation |
| `setSidePanelView(view, state)` | Switch sidebar view |
| `setHouseholdId(id)` | Lock to household (if not already locked) |
| `clearHouseholdContext()` | Clear household (only if not locked) |
| `openHouseholdMember(id, opts)` | Navigate to member view |
| `openHousehold(id)` | Navigate to household view |
| `openEtf(ticker)` | Navigate to ETF view |
| `hydrateFromBackend(state)` | Initialize from backend state |
| `saveContextState()` | Snapshot current state |
| `restoreContextState(id)` | Restore from snapshot |

## Related Documentation

- [Components](10-components.md) - Components that use the store
- [Hooks](30-hooks.md) - Domain hooks that combine store + API
- [State Sync](../30-integration/30-state-sync.md) - Backend synchronization
