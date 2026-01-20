---
covers: Conversation state management including ConversationState model and SidePanelController.
concepts: [conversation-state, side-panel-controller, conversation-mode, view-switching, state-sync]
---

# State Management

The backend maintains conversation state that persists across requests and syncs with the frontend. This state includes the conversation mode, household context, and side panel view information.

## Overview

State management consists of:

1. **ConversationState**: Pydantic model representing the full state
2. **SidePanelController**: Controller for view switching and event emission
3. **Persistence**: State is stored in the database and loaded per request

**Location**: `advisor_copilot/state/`

## ConversationState Model

The root state model that captures everything about a conversation's current status.

**Location**: `advisor_copilot/state/models.py`

```python
class ConversationState(BaseModel):
    mode: ConversationMode         # general | household
    household_id: str | None       # UUID if in household mode
    side_panel: SidePanelState     # Current view state
    metadata: dict[str, Any]       # Extensible metadata
```

### Conversation Modes

```python
class ConversationMode(str, Enum):
    GENERAL = "general"     # No household selected
    HOUSEHOLD = "household" # Locked to a household
```

| Mode | `household_id` | Available Tools | Context |
|------|----------------|-----------------|---------|
| General | `None` | Market only | Advisor dashboard |
| Household | UUID | Market + Household | Full household data |

### State Transitions

```
┌─────────────────────────────────────────────────────────────────┐
│                         GENERAL MODE                             │
│                     (household_id = None)                        │
│                                                                  │
│  User can:                                                       │
│  • Ask general questions                                         │
│  • Research tickers                                              │
│  • View calendar/tasks                                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ POST /conversations/{id}/select_client
                           │ { household_id: UUID }
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                        HOUSEHOLD MODE                            │
│                   (household_id = UUID)                          │
│                                                                  │
│  User can:                                                       │
│  • Access household-specific data                                │
│  • Use household tools                                           │
│  • See household context in prompts                              │
│                                                                  │
│  ⚠️ LOCKED - Cannot switch to different household               │
│     (must start new conversation)                                │
└─────────────────────────────────────────────────────────────────┘
```

## SidePanelState

Tracks what's currently displayed in the UI side panel.

```python
class SidePanelState(BaseModel):
    current_view: SidePanelView    # Which view is active
    view_state: dict[str, Any]     # View-specific state
    last_updated: datetime | None  # When last changed
```

### Side Panel Views

```python
class SidePanelView(str, Enum):
    AGENDA = "agenda"                      # Meeting agenda
    HOUSEHOLD_MEMBER = "householdMember"   # Member details
    HOUSEHOLD_BRIEF = "householdBrief"     # Household overview
    ETF = "etf"                            # ETF information
```

### View-Specific State Models

Each view type has its own state model:

```python
class HouseholdMemberViewState(BaseModel):
    member_id: str                              # UUID of member
    tab: HouseholdMemberTab = "overview"        # overview|accounts|notes
    show_holdings: bool = False
    holdings_search: str = ""

class HouseholdBriefViewState(BaseModel):
    household_id: str                           # UUID of household

class EtfViewState(BaseModel):
    ticker: str                                 # Ticker symbol
```

## SidePanelController

The controller bridges the agent loop and frontend side panel. It handles view switching and emits stream events.

**Location**: `advisor_copilot/state/controller.py`

### Usage Pattern

```python
def emit_event(event: str):
    # Callback that yields event to stream
    pass

controller = SidePanelController(
    state=session.conversation_state,
    emit_event=emit_event,
)

# When tool triggers view change:
new_state = controller.set_view(
    SidePanelView.HOUSEHOLD_MEMBER,
    view_state={"member_id": "uuid"},
)
session.update_state(new_state)
```

### Controller Methods

| Method | Description |
|--------|-------------|
| `set_view(view, view_state, ...)` | Switch to a new view, emit event |
| `update_view_state(updates)` | Merge updates into current view_state |
| `highlight(item_ids)` | Highlight items without changing view |
| `emit_state_sync()` | Emit full state for initial sync |

### Stream Events

The controller emits custom events via the Vercel AI SDK protocol:

| Event | Purpose | Payload |
|-------|---------|---------|
| `side_panel_update` | View changed | `{view, timestamp, view_state?, scroll_to?, highlight_ids?}` |
| `side_panel_highlight` | Highlight items | `{view, highlight_ids, scroll_to_first}` |

### Event Emission Flow

```
Tool: GetHouseholdHoldings
         │
         ▼
Agent loop checks TOOL_TO_VIEW_MAP
         │
         ▼
"GetHouseholdHoldings" → "householdMember"
         │
         ▼
Create SidePanelController with emit callback
         │
         ▼
controller.set_view("householdMember")
         │
         ▼
Controller updates state AND emits event:
  2:[{"side_panel_update": {"view": "householdMember", ...}}]
         │
         ▼
Yield event to stream
         │
         ▼
Frontend receives event via SSE
         │
         ▼
Frontend updates Zustand store and re-renders
```

## State Persistence

State is persisted to the database and loaded per request.

### Saving State

```python
# In agent loop, after view change:
session.update_state(new_state)
await session.persist_state()  # Save to DB
```

### Loading State

```python
# In API route, when handling request:
conversation = await db.get(Conversation, conversation_id)
state = ConversationState.from_dict(conversation.state)
```

### Backward Compatibility

`from_dict()` handles legacy field names:

```python
@classmethod
def from_dict(cls, data: dict | None) -> "ConversationState":
    # Handle legacy field names
    if "client_id" in data:
        data["household_id"] = data.pop("client_id")
    if "context_panel" in data:
        data["side_panel"] = _migrate_context_panel(data.pop("context_panel"))
    if data.get("mode") == "client":
        data["mode"] = "household"
    return cls.model_validate(data)
```

## Immutable State Pattern

State updates use immutable patterns (return new instances):

```python
# Switch view
new_state = state.with_view(
    SidePanelView.HOUSEHOLD_MEMBER,
    view_state={"member_id": "uuid"},
)

# Set household (also updates mode)
new_state = state.with_household("household-uuid")
# mode automatically set to HOUSEHOLD

# Clear household
new_state = state.with_household(None)
# mode automatically set to GENERAL
```

## State Sync with Frontend

The backend and frontend maintain synchronized state:

### Backend → Frontend (Stream Events)

```
Tool executes
     │
     ▼
View changes
     │
     ▼
Controller emits side_panel_update
     │
     ▼
Frontend receives via SSE
     │
     ▼
Zustand store updated
```

### Frontend → Backend (API Calls)

```
User changes view manually
     │
     ▼
Frontend calls PATCH /conversations/{id}/state
     │
     ▼
Backend updates ConversationState
     │
     ▼
State persisted to DB
```

See [State Sync](../30-integration/30-state-sync.md) for full integration details.

## Directory Structure

```
state/
├── models.py      # ConversationState, SidePanelState, view states
└── controller.py  # SidePanelController
```

## Related Documentation

- [Agent Loop](10-agent-loop.md) - How state is used during execution
- [Tools](30-tools.md) - Tools that trigger state changes
- [State Sync](../30-integration/30-state-sync.md) - Frontend-backend synchronization
