---
covers:
  - Bidirectional state synchronization
  - User-driven sync flow
  - Agent-driven sync flow
  - Visual context injection
concepts:
  - Shared Reality
  - Debounced sync
  - context_panel_update events
  - Visual context in prompts
---

# State Synchronization

This document details the bidirectional state synchronization between the frontend and backend, enabling the "Shared Reality" where the agent always knows what the user is viewing.

---

## Overview

State sync solves a fundamental problem: the agent needs to understand **what the user is looking at** to provide contextual assistance.

Without sync:
- User asks "What is **this**?" but agent doesn't know what "this" refers to
- Agent responses don't correlate with visible UI state
- Context is lost on page refresh

With sync:
- Agent receives visual context in every prompt
- User-driven UI changes are persisted to backend
- Agent-driven view changes update frontend immediately

---

## Synchronization Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Bidirectional State Sync                     │
│                                                                 │
│  ┌─────────────────┐                    ┌─────────────────┐     │
│  │    Frontend     │                    │    Backend      │     │
│  │  (Zustand Store)│                    │ (ConversationState)   │
│  └────────┬────────┘                    └────────┬────────┘     │
│           │                                      │              │
│           │  ┌──────────────────────────┐        │              │
│           │  │     Flow A (User)        │        │              │
│           └─►│  Frontend → Backend      │────────►              │
│              │  (debounced PATCH)       │                       │
│              └──────────────────────────┘                       │
│                                                                 │
│              ┌──────────────────────────┐                       │
│           ◄──│     Flow B (Agent)       │◄───────┘              │
│              │  Backend → Frontend      │                       │
│              │  (stream events)         │                       │
│              └──────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Flow A: User-Driven Sync (Frontend → Backend)

When the user interacts with the UI, changes sync to the backend.

### Sequence

```
User clicks tab / selects view
       │
       ▼
┌────────────────────────────────────┐
│ Zustand store updates immediately  │
│ (UI is responsive)                 │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ useBackendStateSync hook detects   │
│ change via store subscription      │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ Debounce ~1000ms                   │
│ (prevents excessive API calls)     │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ PATCH /copilot/conversations/{id}  │
│ /state                             │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ Backend DB updated                 │
│ (ConversationState JSONB column)   │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ Next agent message loads current   │
│ state (visual context available)   │
└────────────────────────────────────┘
```

### Implementation

**Location:** `hooks/useBackendStateSync.ts`

```typescript
export function useBackendStateSync(conversationId: string | null) {
  const updateStateMutation = api.copilot.updateState.useMutation();

  // Subscribe to store changes
  useEffect(() => {
    if (!conversationId) return;

    // Set up debounced sync
    const debouncedSync = debounce((state: SidePanelState) => {
      updateStateMutation.mutate({
        conversation_id: conversationId,
        state: {
          side_panel: state,
        },
      });
    }, 1000);

    // Subscribe to side_panel changes
    const unsubscribe = useAIChatStore.subscribe(
      (state) => state.side_panel,
      (sidePanel) => {
        debouncedSync(sidePanel);
      }
    );

    return () => {
      unsubscribe();
      debouncedSync.cancel();
    };
  }, [conversationId]);
}
```

---

## Flow B: Agent-Driven Sync (Backend → Frontend)

When the agent calls tools that should change the view, updates stream to the frontend immediately.

### Sequence

```
Agent calls tool (e.g., GetHouseholdHoldings)
       │
       ▼
┌────────────────────────────────────┐
│ Tool executes successfully         │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ run_agent_loop maps tool → view    │
│ TOOL_TO_VIEW_MAP[tool_name]        │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ ContextPanelController:            │
│ 1. Emits stream event              │
│ 2. Persists state to DB            │
└────────────────┬───────────────────┘
                 │
          ┌──────┴──────┐
          ▼             ▼
┌─────────────────┐  ┌─────────────────┐
│ Stream Event:   │  │ DB Write:       │
│ 2:[{context_    │  │ UPDATE state    │
│ panel_update:   │  │ SET side_panel  │
│ {...}}]         │  │ = {...}         │
└────────┬────────┘  └─────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│ Frontend stream handler receives   │
│ context_panel_update event         │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ Dispatches to Zustand store        │
│ (openEtf, openHousehold, etc.)     │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ UI updates in real-time            │
│ (right sidebar switches view)      │
└────────────────────────────────────┘
```

### Backend Implementation

**Location:** `advisor_copilot/agent/loop.py`

```python
# Tool-to-View mapping
TOOL_TO_VIEW_MAP = {
    "get_household_holdings": ViewType.HOLDINGS,
    "get_ticker_info": ViewType.ETF,
    "compare_to_ips": ViewType.HOUSEHOLD_BRIEF,
    # ... more mappings
}

# In agent loop, after tool execution:
if is_success and tool_name in TOOL_TO_VIEW_MAP:
    target_view = TOOL_TO_VIEW_MAP[tool_name]

    # Create panel controller
    panel_controller = session.create_panel_controller(
        emit_event=view_events.append,
    )

    # Update state (emits event + persists)
    new_state = panel_controller.set_view(target_view)
    session.update_state(new_state)
    await session.persist_state()  # Write to DB

    # Yield stream events
    for event in view_events:
        yield event
```

### Frontend Implementation

```typescript
// In AIChat component
const { data: streamData } = useChat({...});

// Watch for context_panel_update events
useEffect(() => {
  if (!streamData) return;

  for (const event of streamData) {
    if (event.context_panel_update) {
      const { view, ticker, householdId, memberId } = event.context_panel_update;

      switch (view) {
        case "etf":
          openEtf(ticker);
          break;
        case "householdBrief":
          openHousehold(householdId);
          break;
        case "householdMember":
          openHouseholdMember(memberId);
          break;
        case "holdings":
          setSidePanelView("holdings");
          break;
      }
    }
  }
}, [streamData]);
```

---

## Visual Context Injection

The agent receives visual context in its system prompt, enabling contextual understanding.

### Format

```text
<visual_context>
User is currently viewing: Holdings Table
Active Household: Smith Family
Panel is: Open
</visual_context>
```

### Implementation

**Location:** `advisor_copilot/agent/user_prompt_builder.py`

```python
def build_visual_context(state: ConversationState) -> str:
    """Build visual context block for system prompt."""
    lines = ["<visual_context>"]

    # Current view
    view_name = VIEW_DISPLAY_NAMES.get(
        state.side_panel.current_view,
        state.side_panel.current_view
    )
    lines.append(f"User is currently viewing: {view_name}")

    # Household context (if in household mode)
    if state.household_id:
        household_name = get_household_name(state.household_id)
        lines.append(f"Active Household: {household_name}")

    # Panel state
    panel_state = "Open" if state.metadata.get("is_panel_open", True) else "Closed"
    lines.append(f"Panel is: {panel_state}")

    lines.append("</visual_context>")
    return "\n".join(lines)
```

### Usage in System Prompt

```python
def build_system_prompt(state: ConversationState) -> str:
    base_prompt = load_template("system_prompt.md")
    visual_context = build_visual_context(state)

    return f"{base_prompt}\n\n{visual_context}"
```

This allows the agent to respond to queries like:
- "What is **this**?" → Agent knows current view
- "Tell me more about this household" → Agent knows selected household
- "What does this chart show?" → Agent knows ETF ticker being displayed

---

## Avoiding Infinite Loops

A critical concern: sync must not create loops where changes ping-pong between frontend and backend.

### Prevention Strategies

1. **User-driven sync is debounced**
   ```typescript
   // Wait 1000ms of inactivity before syncing
   const debouncedSync = debounce(syncToBackend, 1000);
   ```

2. **Agent-driven sync updates store directly (no re-sync)**
   ```typescript
   // When handling context_panel_update from stream
   // Update store but DON'T trigger backend sync
   useAIChatStore.setState({ side_panel: newState }, false);
   // The `false` flag prevents triggering subscriptions
   ```

3. **Source tracking (optional)**
   ```typescript
   // Track who initiated the change
   interface StateUpdate {
     source: "user" | "agent";
     state: SidePanelState;
   }

   // Skip redundant syncs
   if (update.source === "agent") {
     // Don't sync agent changes back to backend
     return;
   }
   ```

### Diagram

```
User clicks tab                Agent calls tool
       │                              │
       ▼                              ▼
┌─────────────────┐          ┌─────────────────┐
│ Update store    │          │ Stream event    │
│ (source: user)  │          │ arrives         │
└────────┬────────┘          └────────┬────────┘
         │                            │
         ▼                            ▼
┌─────────────────┐          ┌─────────────────┐
│ Debounce 1s     │          │ Update store    │
│ ...             │          │ (source: agent) │
└────────┬────────┘          └────────┬────────┘
         │                            │
         ▼                            ▼
┌─────────────────┐          ┌─────────────────┐
│ PATCH to backend│          │ NO backend sync │
│ (user-initiated)│          │ (already done)  │
└─────────────────┘          └─────────────────┘
```

---

## State Recovery (Page Refresh)

On page refresh, state is rehydrated from the backend.

### Flow

```
Page loads
       │
       ▼
┌────────────────────────────────────┐
│ useConversation hook runs          │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ GET /copilot/conversations/{id}    │
│ /state                             │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ hydrateFromBackend(backendState)   │
│ → Updates Zustand store            │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ UI renders with correct state      │
│ (view, household, panel open, etc.)│
└────────────────────────────────────┘
```

### Implementation

```typescript
// In useConversation hook
const { data: backendState } = api.copilot.getState.useQuery(
  { conversation_id: conversationId },
  { enabled: !!conversationId }
);

useEffect(() => {
  if (backendState && !hasHydratedFromBackend) {
    hydrateFromBackend(backendState);
    setHasHydratedFromBackend(true);
  }
}, [backendState, hasHydratedFromBackend]);
```

---

## Summary

| Flow | Direction | Trigger | Mechanism | Latency |
|------|-----------|---------|-----------|---------|
| **User-driven** | Frontend → Backend | UI interaction | Debounced PATCH | ~1s |
| **Agent-driven** | Backend → Frontend | Tool execution | Stream event | Immediate |
| **Recovery** | Backend → Frontend | Page load | GET + hydrate | ~200ms |

The key insight: by separating concerns—
- **Backend** is source of truth for persistence
- **Frontend** is source of truth for real-time display
- **Sync** keeps them aligned without infinite loops
