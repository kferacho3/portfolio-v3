---
covers:
  - REST API endpoints
  - tRPC queries and mutations
  - Request/response shapes
concepts:
  - Conversation lifecycle API
  - Streaming chat endpoint
  - State persistence endpoints
---

# API Contracts

This document details the API contracts between the Zom AI frontend and backend, including REST endpoints and tRPC queries/mutations.

---

## Overview

The integration uses two API patterns:

| Pattern | Use Case | Example |
|---------|----------|---------|
| **REST (SSE)** | Streaming chat responses | `POST /api/copilot` |
| **tRPC** | All other operations | `api.copilot.createConversation` |

---

## REST Endpoints

### Chat Stream

**Endpoint:** `POST /api/copilot`

The main chat endpoint that streams responses using Server-Sent Events (SSE).

**Request:**
```json
{
  "conversation_id": "uuid",
  "message": "string"
}
```

**Response:** SSE stream with Vercel AI SDK format (see [20-streaming-protocol.md](./20-streaming-protocol.md))

**Notes:**
- Server loads conversation history from database
- Only the new user message is sent (not full history)
- Response is streamed in real-time

---

## Backend API Routes

**Location:** `api/v1/routes/copilot/routes/`

| Route | Method | Endpoint | Description |
|-------|--------|----------|-------------|
| `create_conversation.py` | POST | `/copilot/conversations` | Create a new conversation |
| `stream_chat.py` | POST | `/copilot/chat/stream` | Stream a chat response |
| `select_client.py` | POST | `/copilot/conversations/{id}/select_client` | Lock conversation to household |
| `get_state.py` | GET | `/copilot/conversations/{id}/state` | Get conversation state |

### Create Conversation

**Endpoint:** `POST /copilot/conversations`

**Request:**
```json
{
  "household_id": "uuid | null"  // Optional - determines initial mode
}
```

**Response:**
```json
{
  "conversation_id": "uuid",
  "mode": "general | household",
  "state": {
    "mode": "general",
    "household_id": null,
    "side_panel": {
      "current_view": "agenda",
      "view_state": {},
      "last_updated": null
    },
    "metadata": {}
  }
}
```

### Select Client

**Endpoint:** `POST /copilot/conversations/{id}/select_client`

Locks a conversation to a specific household. This action is permanent for the conversation.

**Request:**
```json
{
  "household_id": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "state": {
    "mode": "household",
    "household_id": "uuid",
    "side_panel": {
      "current_view": "householdBrief",
      "view_state": { "householdId": "uuid" },
      "last_updated": "iso-timestamp"
    }
  }
}
```

**Notes:**
- Once locked, cannot be undone
- Emits `context_panel_update` event
- Switches side panel to household brief view

### Get State

**Endpoint:** `GET /copilot/conversations/{id}/state`

Retrieves current conversation state (used for page refresh recovery).

**Response:**
```json
{
  "mode": "general | household",
  "household_id": "uuid | null",
  "side_panel": {
    "current_view": "agenda | householdBrief | householdMember | etf",
    "view_state": { ... },
    "last_updated": "iso-timestamp | null"
  },
  "metadata": {
    "is_panel_open": true
  }
}
```

---

## tRPC Queries & Mutations

### Copilot (Conversation Management)

| Operation | Type | Purpose |
|-----------|------|---------|
| `api.copilot.createConversation` | Mutation | Create a new conversation |
| `api.copilot.getHistory` | Query | Get conversation message history |
| `api.copilot.selectClient` | Mutation | Lock conversation to a household |
| `api.copilot.getState` | Query | Get conversation state |
| `api.copilot.updateState` | Mutation | Update conversation state (user-driven sync) |

### Advisory (Household Data)

| Operation | Type | Purpose |
|-----------|------|---------|
| `api.advisory.getHouseholds` | Query | Get list of households |
| `api.advisory.getHouseholdMember` | Query | Get household member details |
| `api.advisory.getClientHoldings` | Query | Get client portfolio holdings |

### Other

| Operation | Type | Purpose |
|-----------|------|---------|
| `api.meetings.getMeetings` | Query | Get upcoming meetings |
| `api.ticker.getTickerInfo` | Query | Get ETF/ticker information |

---

## State Update API

**Operation:** `api.copilot.updateState` (or `PATCH /copilot/conversations/{id}/state`)

Used for user-driven state synchronization.

**Request Shape:**
```json
{
  "conversation_id": "uuid",
  "state": {
    "side_panel": {
      "current_view": "householdMember",
      "view_state": {
        "memberId": "uuid",
        "tab": "accounts"
      },
      "last_updated": "iso-timestamp"
    },
    "metadata": {
      "is_panel_open": true
    }
  }
}
```

**Notes:**
- Called by `useBackendStateSync` hook
- Debounced ~1000ms to prevent excessive requests
- Only sends changed state, not full conversation state

---

## Request/Response Type Shapes

### ConversationState (Backend)

```python
@dataclass
class ConversationState:
    mode: Literal["general", "household"]
    household_id: Optional[UUID]
    side_panel: SidePanelState
    metadata: Dict[str, Any]
```

### SidePanelState (Backend)

```python
@dataclass
class SidePanelState:
    current_view: ViewType  # Enum: agenda, householdBrief, householdMember, etf
    view_state: Dict[str, Any]  # View-specific state
    last_updated: Optional[datetime]
```

### ViewType (Backend)

```python
class ViewType(str, Enum):
    AGENDA = "agenda"
    HOUSEHOLD_BRIEF = "householdBrief"
    HOUSEHOLD_MEMBER = "householdMember"
    ETF = "etf"
    HOLDINGS = "holdings"
```

### ConversationState (Frontend)

```typescript
interface ConversationState {
  mode: "general" | "household";
  household_id: string | null;
  metadata: Record<string, unknown>;
  side_panel: SidePanelState;
}

interface SidePanelState {
  current_view: "agenda" | "householdMember" | "householdBrief" | "etf";
  view_state: ViewState;
  last_updated: string | null;
}
```

---

## Error Handling

### Common Error Responses

| Status | Meaning | Example |
|--------|---------|---------|
| 400 | Bad Request | Invalid conversation ID format |
| 404 | Not Found | Conversation doesn't exist |
| 409 | Conflict | Attempting to change locked household |
| 500 | Server Error | Internal processing error |

### Conflict on Household Lock

```json
{
  "error": "conversation_locked",
  "message": "Cannot change household - conversation is locked",
  "current_household_id": "uuid"
}
```
