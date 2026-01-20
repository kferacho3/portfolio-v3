---
covers: Frontend AI Chat feature architecture, components, file structure, and data flow.
concepts: [ai-chat, zustand, vercel-ai-sdk, right-sidebar, scope-panel, domain-hooks]
---

# Frontend: AI Chat

The AI Chat is a Next.js feature that provides a conversational interface for financial advisors. It uses Zustand for state management, Vercel AI SDK for streaming chat, and a component architecture with domain hooks.

## Visual Overview

### Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          AI Chat Page                                        │
├─────────────────────────────────────────┬───────────────────────────────────┤
│                                         │                                    │
│   MessageList                           │   RightSideBar                     │
│   ┌─────────────────────────────────┐   │   (Sliding Drawer)                 │
│   │ [User]: What's the...           │   │   ┌──────────────────────────────┐ │
│   │ [AI]: Based on the analysis...  │   │   │ Current View:                │ │
│   │ [AI]: Thinking...               │   │   │ • AgendaView                 │ │
│   └─────────────────────────────────┘   │   │ • HouseholdMemberView        │ │
│                                         │   │ • HouseholdBriefView         │ │
├─────────────────────────────────────────┤   │ • ETFView                    │ │
│   ChatScopePanel (dropdown)             │   └──────────────────────────────┘ │
│   ┌─────────────────────────────────┐   │                                    │
│   │ [Households] [Meetings]         │   │                                    │
│   │ 🔍 Search...                    │   │                                    │
│   │ ○ Smith Family                  │   │                                    │
│   │ ○ Johnson Household             │   │                                    │
│   └─────────────────────────────────┘   │                                    │
├─────────────────────────────────────────┤                                    │
│   ChatInput                             │                                    │
│   [Ask, search, or brief Zom AI...]     │                                    │
└─────────────────────────────────────────┴───────────────────────────────────┘
```

### Component Hierarchy

```
AIChat (Orchestrator)
├── MessageList
│   ├── MessageItem (user message)
│   ├── MessageItem (assistant message)
│   └── ProcessingPill ("Thinking...")
├── ChatScopePanel (dropdown)
│   ├── ScopeTabs ([Households] [Meetings])
│   ├── HouseholdScopeTab (search + select)
│   └── MeetingScopeTab (meeting list)
└── ChatInput (text input + send)

RightSideBar (View Router)
├── AgendaView (meetings & tasks)
├── HouseholdMemberView (member details)
├── HouseholdBriefView (household overview)
└── ETFView (ticker information)
```

## File Structure

```
ai-chat/
├── page.tsx                      # Entry point
├── types.ts                      # Shared TypeScript types
├── constants.ts                  # Shared constants
│
├── store/                        # Zustand State Management
│   ├── index.ts                  # Main store
│   ├── selectors.ts              # Memoized selector hooks
│   └── types/                    # Type definitions
│       ├── index.ts              # Barrel export
│       ├── conversation.ts       # Conversation types
│       ├── store.ts              # Store interfaces
│       └── side-panel/           # Side panel types
│           ├── index.ts          # SidePanelState
│           └── views/            # View-specific state types
│
├── hooks/                        # Domain Hooks
│   ├── useConversation.ts        # Conversation lifecycle
│   ├── useHouseholdManagement.ts # Household list & selection
│   ├── useHouseholdLockWithAPI.ts# Lock to household
│   ├── useBackendStateSync.ts    # Sync state to backend
│   ├── useChatProcessing.ts      # AI "thinking" steps
│   └── useConversationHistory.ts # Load message history
│
├── utils/                        # Utility Functions
│   ├── messages.ts               # Message parsing
│   ├── formatters.ts             # Currency & percent
│   └── tool-descriptions.ts      # Tool name mapping
│
└── _components/                  # UI Components
    ├── chat/                     # Main chat component
    │   ├── index.tsx             # AIChat orchestrator
    │   └── _components/
    │       ├── ChatInput.tsx
    │       ├── chat-scope-panel/
    │       └── message-list/
    │
    └── right-sidebar/            # Right sidebar
        ├── index.tsx             # View router
        ├── hooks/                # Sidebar-specific hooks
        └── _components/
            └── views/            # View components
```

## Section Index

| Document | Description |
|----------|-------------|
| [Components](10-components.md) | AIChat, RightSideBar, ChatScopePanel, MessageList |
| [State Management](20-state-management.md) | Zustand store, selectors, types architecture |
| [Hooks](30-hooks.md) | Domain hooks pattern, hook catalog |

## Key Concepts

### Single Source of Truth

All state lives in **one Zustand store**. Hooks are NOT independent state containers - they are views and operations on the shared store.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     Zustand Store (useAIChatStore)                          │
│                                                                             │
│  conversationId   side_panel   householdId   isScopePanelOpen              │
│  conversationMode   isPanelOpen   activeScopeTab   ...                     │
└─────────────────────────────────────────────────────────────────────────────┘
        ↑                   ↑                   ↑
        │                   │                   │
   Selectors           Domain Hooks         Components
```

### Household Lock Behavior

Once a conversation is locked to a household, it cannot be changed. Start a new conversation to switch households.

```
General Mode (no household)
         │
         │ User selects household
         │ API: selectClient
         ▼
Household Mode (LOCKED)
         │
         ✗ Cannot change household
         ✗ Must start new conversation
```

### View Modes

The right sidebar acts as a **view router** with four modes:

| View | When Active | Data Shown |
|------|-------------|------------|
| `agenda` | Default | Meetings & tasks |
| `householdMember` | Member selected | Member details (tabs: overview/accounts/notes) |
| `householdBrief` | Household selected | Household overview |
| `etf` | ETF tool called | ETF/ticker information |

### Data Flow

```
User types message
        │
        ▼
ensureConversation() ─→ Creates conversation if needed
        │
        ▼
useChat.handleSubmit() ─→ Vercel AI SDK sends to /api/copilot
        │
        ▼
Backend streams response (SSE)
        │
        ▼
MessageList renders streaming content
        │
        ▼
Stream events (side_panel_update) ─→ Zustand store ─→ RightSideBar updates
```

## API Integration

### REST Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/copilot` | POST (SSE) | Send message, receive streaming response |

### tRPC Queries & Mutations

```typescript
// Copilot (conversation management)
api.copilot.createConversation   // Create new conversation
api.copilot.getHistory           // Get message history
api.copilot.selectClient         // Lock to household
api.copilot.getState             // Get conversation state
api.copilot.updateState          // Update conversation state

// Advisory (household data)
api.advisory.getHouseholds       // List households
api.advisory.getHouseholdMember  // Member details
api.advisory.getClientHoldings   // Portfolio holdings

// Other
api.meetings.getMeetings         // Upcoming meetings
api.ticker.getTickerInfo         // ETF/ticker info
```

## Related Documentation

- **Backend**: [Backend Overview](../10-backend/00-overview.md) - API that this frontend consumes
- **Integration**: [Integration Overview](../30-integration/00-overview.md) - How frontend and backend connect
