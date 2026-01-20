---
covers: Main UI components including AIChat, RightSideBar, ChatScopePanel, and MessageList.
concepts: [ai-chat, right-sidebar, chat-scope-panel, message-list, view-router, orchestrator]
---

# Components

The AI Chat feature is built from composable React components organized into two main areas: the **Chat** (left side) and the **RightSideBar** (right side). This document covers the key components and their responsibilities.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               page.tsx                                       │
│                         (Entry point + Suspense)                             │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              ▼                                         ▼
┌──────────────────────────────────┐     ┌──────────────────────────────────┐
│           AIChat                 │     │        RightSideBar              │
│       (Orchestrator)             │     │       (View Router)              │
├──────────────────────────────────┤     ├──────────────────────────────────┤
│ • MessageList                    │     │ • AgendaView                     │
│ • ChatScopePanel                 │     │ • HouseholdMemberView            │
│ • ChatInput                      │     │ • HouseholdBriefView             │
└──────────────────────────────────┘     │ • ETFView                        │
                                         └──────────────────────────────────┘
```

## AIChat (The Orchestrator)

**Location**: `_components/chat/index.tsx`

The main component that composes all domain hooks and renders the chat interface. It's responsible for:

- Composing all domain hooks
- Managing chat UI state
- Coordinating between components

### Hook Composition

```typescript
export function AIChat() {
  // 1. Conversation management
  const { token, conversationId, ensureConversation } = useConversation();

  // 2. Backend sync (runs in background)
  useBackendStateSync(conversationId);

  // 3. Scope panel state (from store selectors)
  const { isScopePanelOpen, activeScopeTab } = useScopePanelState();
  const { setIsScopePanelOpen, setActiveScopeTab } = useScopePanelActions();

  // 4. Household management
  const { households, selectedHouseholdId } = useHouseholdManagement(...);

  // 5. Household lock (store + API)
  const { setHousehold, isLocked } = useHouseholdLockWithAPI(conversationId);

  // 6. Chat streaming (Vercel AI SDK)
  const { messages, input, handleSubmit, isLoading } = useChat({ ... });

  // Render UI components
  return (
    <>
      <MessageList messages={messages} />
      <ChatScopePanel ... />
      <ChatInput onSubmit={handleSubmit} ... />
    </>
  );
}
```

### Responsibilities

| Responsibility | How |
|----------------|-----|
| Conversation lifecycle | `useConversation()` creates/manages conversations |
| State synchronization | `useBackendStateSync()` syncs to backend |
| Household context | `useHouseholdLockWithAPI()` handles lock behavior |
| Chat streaming | `useChat()` from Vercel AI SDK |
| UI state | Store selectors for scope panel |

## RightSideBar (View Router)

**Location**: `_components/right-sidebar/index.tsx`

A sliding drawer that acts as a **view router**, rendering the appropriate view based on `side_panel.current_view` from the store.

### View Modes

| View | Component | When Shown |
|------|-----------|------------|
| `agenda` | `AgendaView` | Default view - meetings & tasks |
| `householdMember` | `HouseholdMemberView` | When viewing a household member |
| `householdBrief` | `HouseholdBriefView` | When viewing household overview |
| `etf` | `ETFView` | When AI calls ETF-related tools |

### Routing Logic

```typescript
function RightSideBar() {
  const { currentView, isPanelOpen } = useViewState();

  const renderContent = () => {
    switch (currentView) {
      case "etf":
        return <ETFView />;
      case "householdMember":
        return <HouseholdMemberView />;
      case "householdBrief":
        return <HouseholdBriefView />;
      case "agenda":
      default:
        return <AgendaView />;
    }
  };

  return (
    <AnimatedDrawer isOpen={isPanelOpen}>
      {renderContent()}
    </AnimatedDrawer>
  );
}
```

### View Components

Each view has its own subdirectory with focused components:

```
views/
├── agenda-view/              # Meetings & tasks
│   ├── index.tsx
│   └── _components/
│       ├── MeetingCard.tsx
│       └── TaskList.tsx
│
├── household-member-view/    # Member details
│   ├── index.tsx
│   └── _components/
│       ├── MemberHeader.tsx
│       ├── TabBar.tsx        # overview | accounts | notes
│       ├── OverviewTab.tsx
│       ├── AccountsTab.tsx
│       └── NotesTab.tsx
│
├── household-brief-view/     # Household overview
│   ├── index.tsx
│   └── _components/
│       ├── HouseholdSummary.tsx
│       └── MemberList.tsx
│
└── etf-view/                 # ETF/ticker info
    ├── index.tsx
    └── _components/
        ├── TickerHeader.tsx
        └── HoldingsTable.tsx
```

## ChatScopePanel

**Location**: `_components/chat/_components/chat-scope-panel/index.tsx`

A dropdown panel that appears when the input is focused, allowing users to select a household or meeting for context.

### Visual Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  [Households] [Meetings]              ← ScopeTabs               │
├─────────────────────────────────────────────────────────────────┤
│  Current Selection (if any):                                    │
│  "Smith Family"                       [Household]               │
├─────────────────────────────────────────────────────────────────┤
│  🔍 Search households...              ← Search input            │
│                                                                 │
│  ○ Smith Family                       ← HouseholdScopeTab      │
│  ○ Johnson Household                                            │
│  ○ Williams Trust                                               │
│                                                                 │
│  - or -                                                         │
│                                                                 │
│  📅 Today's Meetings                   ← MeetingScopeTab        │
│  • 10:00 AM - Portfolio Review                                  │
│  • 2:30 PM - Annual Review                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Subcomponents

| Component | Purpose |
|-----------|---------|
| `ScopeTabs` | Tab bar to switch between Households and Meetings |
| `HouseholdScopeTab` | Search and select households |
| `LockedHouseholdView` | Shows locked household (no selection) |
| `MeetingScopeTab` | List and select meetings |

### Lock Behavior

When a household is locked, the panel shows `LockedHouseholdView`:

```typescript
if (isLocked) {
  return <LockedHouseholdView householdName={lockedHousehold.name} />;
}
```

## MessageList

**Location**: `_components/chat/_components/message-list/index.tsx`

Container for displaying chat messages with streaming support.

### Visual Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  MessageList                                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [User]: What's the current allocation for the Smith...    │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [AI]: Based on the holdings data, the Smith family has... │  │
│  │       [Markdown content with tables, code, etc.]          │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ [ProcessingPill]: Analyzing portfolio data...             │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Subcomponents

| Component | Purpose |
|-----------|---------|
| `MessageItem` | Single message bubble (user or assistant) |
| `ProcessingPill` | "Thinking..." indicator with step details |
| `Markdown` | Main markdown renderer |
| `CodeBlock` | Syntax-highlighted code blocks |
| `LiveMarkdown` | Streaming markdown for in-progress responses |
| `TableFormatter` | Table rendering |

### Streaming Support

Messages are rendered differently based on whether they're complete or streaming:

```typescript
{messages.map((message) => (
  <MessageItem
    key={message.id}
    message={message}
    isStreaming={isLoading && isLastMessage}
  />
))}
```

## ChatInput

**Location**: `_components/chat/_components/ChatInput.tsx`

The text input component for sending messages.

### Features

- Auto-expanding textarea
- Submit on Enter (Shift+Enter for newlines)
- Focus triggers scope panel
- Disabled during streaming

### Props

```typescript
interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onFocus: () => void;
  disabled: boolean;
  placeholder?: string;
}
```

## Navigation Actions

Components can trigger view changes using navigation actions from the store:

```typescript
import { useNavigationActions } from "../../store/selectors";

function SomeComponent() {
  const { openHouseholdMember, openHousehold, openEtf } = useNavigationActions();

  // Open household member view
  const handleMemberClick = (memberId: string) => {
    openHouseholdMember(memberId, { tab: "accounts" });
  };

  // Open ETF view
  const handleTickerClick = (ticker: string) => {
    openEtf(ticker);
  };
}
```

## Component Communication

Components communicate through the Zustand store, not prop drilling:

```
User clicks member in HouseholdBriefView
              │
              ▼
openHouseholdMember(memberId) ─→ Store action
              │
              ▼
Store updates: side_panel.current_view = "householdMember"
              │
              ▼
RightSideBar re-renders with HouseholdMemberView
```

## Related Documentation

- [State Management](20-state-management.md) - Zustand store and selectors
- [Hooks](30-hooks.md) - Domain hooks used by components
- [Frontend Overview](00-overview.md) - File structure and architecture
