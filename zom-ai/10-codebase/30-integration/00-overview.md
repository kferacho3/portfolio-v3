---
covers:
  - Frontend-backend integration
  - API contracts
  - Streaming protocol
  - Bidirectional state sync
concepts:
  - Shared Reality
  - Vercel AI SDK protocol
  - context_panel_update events
---

# Integration: How Frontend and Backend Connect

The Zom AI system consists of two separate codebases—a Python backend and a Next.js frontend—that must stay in sync. This section documents how they communicate and maintain a unified view of the conversation state.

---

## Shared Reality

The core integration principle is **Shared Reality**: the agent and user always operate on the same contextual understanding of the UI state.

```
┌─────────────────────────────────────────────────────────────────┐
│                         Shared Reality                          │
│                                                                 │
│    ┌─────────────────┐         ┌─────────────────┐              │
│    │    Frontend     │ ◄─────► │    Backend      │              │
│    │  (Zustand Store)│   sync  │ (ConversationState)            │
│    └─────────────────┘         └─────────────────┘              │
│           │                           │                         │
│           │  Both know:               │                         │
│           │  • Current view mode      │                         │
│           │  • Selected household     │                         │
│           │  • Panel open/closed      │                         │
│           │  • View-specific state    │                         │
└─────────────────────────────────────────────────────────────────┘
```

This enables:
- The agent to know what the user is looking at
- User-driven UI changes to persist to the backend
- Agent-driven view changes to update the frontend in real-time
- Contextual references like "What is **this**?" to work

---

## Shared Data Contract

Both frontend and backend maintain synchronized state with this shared contract:

| Frontend (Zustand Store) | Backend (`ConversationState` JSONB) | Description |
|--------------------------|-------------------------------------|-------------|
| `side_panel.current_view` | `side_panel.current_view` | Active view in sidebar |
| `side_panel.view_state` | `side_panel.view_state` | View-specific state |
| `householdId` | `household_id` | Selected household UUID |
| `conversationMode` | `mode` | `"general"` or `"household"` |
| `isPanelOpen` | `metadata.is_panel_open` | Sidebar visibility |

---

## Communication Channels

The frontend and backend communicate through three main channels:

### 1. REST/tRPC APIs

Standard request-response pattern for:
- Creating conversations
- Locking to a household
- Fetching conversation state
- Updating state (user-driven sync)

### 2. Server-Sent Events (SSE) Streaming

Real-time streaming for:
- Chat responses (text chunks)
- Tool call events
- Context panel updates (agent-driven sync)

### 3. State Sync

Bidirectional synchronization:
- **Frontend → Backend**: User-driven UI changes (debounced ~1s)
- **Backend → Frontend**: Agent-driven view changes (immediate via stream)

---

## Section Index

| Document | Purpose |
|----------|---------|
| [10-api-contracts.md](./10-api-contracts.md) | REST endpoints, tRPC queries/mutations, request/response shapes |
| [20-streaming-protocol.md](./20-streaming-protocol.md) | Vercel AI SDK format, event prefixes, stream handling |
| [30-state-sync.md](./30-state-sync.md) | Bidirectional sync flows, visual context injection |

---

## Key Concepts

### Conversation Modes

| Mode | Description | Context Available |
|------|-------------|-------------------|
| **General** | No household selected | Advisor dashboard, calendar, tasks, market research |
| **Household** | Locked to a household | Full household data: holdings, IPS, documents, tasks |

Once a conversation is locked to a household, it cannot be changed—start a new conversation to switch clients.

### View Types

The context panel (right sidebar) can display these views:

| View | Description | Triggered By |
|------|-------------|--------------|
| `agenda` | Daily meetings & tasks | Default view |
| `householdBrief` | Household overview | Selecting a client |
| `householdMember` | Individual member details | Navigating to member |
| `etf` | ETF/ticker information | Market research tools |

### Tool-to-View Mapping

When the agent calls certain tools, the context panel automatically switches to the relevant view:

```
get_household_holdings  →  holdings view
get_ticker_info         →  etf view
compare_to_ips          →  householdBrief view
```

This ensures the user sees relevant data as the agent discusses it.
