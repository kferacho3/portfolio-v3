# AI Chat Architecture

> A guide to understanding how the AI Chat feature works.

---

## Quick Overview

The AI Chat is a conversational interface where users can:
1. **Chat with an AI assistant** - Send messages and receive streaming responses
2. **Select scope** - Choose a household or meeting to give the AI context
3. **View contextual information** - Right sidebar shows client/household details, ETF data, meetings

---

## Documentation Index

| Document | Purpose |
|----------|---------|
| **ARCHITECTURE.md** (this file) | Overall structure, components, data flow |
| **[STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)** | Zustand store, types, selectors, hooks, backend sync |

---

## File Structure

```
ai-chat/
├── page.tsx                      # Entry point - wraps everything in Suspense
├── types.ts                      # TypeScript types (shared across module)
├── constants.ts                  # Shared constants
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md           # This file
│   └── STATE_MANAGEMENT.md       # Store, types, selectors, hooks
│
├── store/                        # Zustand State Management
│   ├── index.ts                  # Main store
│   ├── selectors.ts              # Memoized selector hooks
│   └── types/                    # Type definitions (modular)
│       ├── index.ts              # Barrel export
│       ├── conversation.ts       # Conversation types
│       ├── store.ts              # Store interfaces
│       └── side-panel/           # Side panel types
│           ├── index.ts          # SidePanelState, OpenPanelOptions
│           └── views/            # View-specific state types
│               ├── index.ts      # ViewState union
│               ├── agenda.ts
│               ├── household-member.ts
│               ├── household-brief.ts
│               └── etf.ts
│
├── hooks/                        # Domain Hooks (store + API + logic)
│   ├── index.ts                  # Barrel export
│   ├── useConversation.ts        # Manages conversation ID & creation
│   ├── useHouseholdManagement.ts # Household list & selection
│   ├── useHouseholdLockWithAPI.ts # Lock conversation to household
│   ├── useBackendStateSync.ts    # Sync state to backend
│   ├── useChatProcessing.ts      # Tracks AI "thinking" steps
│   ├── useConversationHistory.ts # Loads previous messages
│   └── useAgendaData.ts          # Meeting data & context injection
│
├── utils/                        # Utility Functions
│   ├── index.ts                  # Barrel export
│   ├── agenda.ts                 # Meeting/agenda task derivation
│   ├── messages.ts               # Message content parsing & rendering
│   ├── formatters.ts             # Currency & percent formatters
│   └── tool-descriptions.ts      # AI tool name → human descriptions
│
└── _components/                  # UI Components (underscore = not routable)
    │
    ├── chat/                     # THE MAIN CHAT COMPONENT
    │   ├── index.tsx             # AIChat component - orchestrates chat UI
    │   └── _components/
    │       ├── ChatInput.tsx     # The text input box
    │       ├── chat-scope-panel/ # Scope Selection Panel
    │       │   ├── index.tsx     # ChatScopePanel - main dropdown
    │       │   └── _components/
    │       │       ├── ScopeTabs.tsx          # Tab bar (Households | Meetings)
    │       │       ├── HouseholdScopeTab.tsx  # Household search & selection
    │       │       ├── LockedHouseholdView.tsx # Locked state display
    │       │       └── MeetingScopeTab.tsx    # Meeting list & selection
    │       └── message-list/     # Message Display
    │           ├── index.tsx     # MessageList - container for messages
    │           └── _components/
    │               ├── MessageItem.tsx    # Single message bubble
    │               ├── ProcessingPill.tsx # "Thinking..." indicator
    │               └── message-content/   # Message formatting
    │                   ├── Markdown.tsx   # Main markdown renderer
    │                   ├── CodeBlock.tsx  # Code syntax highlighting
    │                   └── streaming/
    │                       ├── LiveMarkdown.tsx   # Streaming markdown
    │                       └── TableFormatter.tsx # Table rendering
    │
    ├── right-sidebar/            # RIGHT SIDEBAR
    │   ├── index.tsx             # RightSideBar - view router
    │   ├── types.ts              # Sidebar-specific types
    │   ├── layout-styles.ts      # Animation & layout constants
    │   │
    │   ├── hooks/                # Sidebar-specific hooks
    │   │   ├── index.ts
    │   │   ├── usePanelState.ts          # Panel open/close/animation
    │   │   └── useRightSidebarData.ts    # tRPC data fetching
    │   │
    │   ├── utils/                # Utility functions
    │   │   ├── index.ts
    │   │   └── data-transforms.ts
    │   │
    │   └── _components/          # View Components
    │       ├── index.ts          # Barrel export
    │       │
    │       ├── views/            # View Components (one per view mode)
    │       │   ├── index.ts
    │       │   ├── agenda-view/          # Meetings & tasks
    │       │   ├── etf-view/             # ETF/ticker information
    │       │   ├── household-brief-view/ # Household overview
    │       │   └── household-member-view/ # Individual member details
    │       │
    │       └── shared/           # Shared UI components
    │           ├── SectionWrapper.tsx
    │           └── StateComponents.tsx
    │
    └── calendar-modals/          # Calendar/Agenda Modal Overlays
        ├── index.tsx
        └── _components/
            └── AgendaList.tsx
```

---

## Visual Overview

### Chat Interface

```
┌─────────────────────────────────────────────────────────┐
│  ChatScopePanel (appears on input focus)                │
│  ┌─────────────────────────────────────────────────────┐│
│  │ [Households] [Meetings]              ← tabs         ││
│  ├─────────────────────────────────────────────────────┤│
│  │ "Smith Family"                       [Household]    ││
│  │ Serving ETFs and mutual fund data...                ││
│  ├─────────────────────────────────────────────────────┤│
│  │ 🔍 Search households...                             ││
│  │ ○ Smith Family                                      ││
│  │ ○ Johnson Household                                 ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│  ChatInput (always visible)                             │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Ask, search, or brief Zom AI...        [👥][+][➤]  ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Main Chat Component Layout

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   MessageList (_components/message-list/)               │
│     ├── MessageItem (each message bubble)               │
│     └── ProcessingPill (AI "thinking" indicator)        │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ChatScopePanel (dropdown - shows when input focused)  │
│     ├── ScopeTabs (Households | Meetings)               │
│     └── HouseholdScopeTab or MeetingScopeTab            │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ChatInput (the text box + send button)                │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### The Main Component: `AIChat`

**File:** `_components/chat/index.tsx`

The orchestrator that:
- Composes all domain hooks
- Manages chat UI state
- Renders the chat interface

```typescript
export function AIChat() {
  // 1. Conversation management
  const { token, conversationId, ensureConversation } = useConversation();

  // 2. Backend sync (runs in background)
  useBackendStateSync(conversationId);

  // 3. Scope panel state (from store)
  const { isScopePanelOpen, activeScopeTab } = useScopePanelState();
  const { setIsScopePanelOpen, setActiveScopeTab } = useScopePanelActions();

  // 4. Household management
  const { households, selectedHouseholdId } = useHouseholdManagement(...);

  // 5. Household lock (store + API)
  const { setHousehold, isLocked } = useHouseholdLockWithAPI(conversationId);

  // 6. Chat streaming (Vercel AI SDK)
  const { messages, input, handleSubmit, isLoading } = useChat({ ... });

  // ... render UI
}
```

### Right Sidebar: `RightSideBar`

**File:** `_components/right-sidebar/index.tsx`

A sliding drawer that acts as a **view router**, rendering the appropriate view based on `side_panel.current_view`:

| View Mode | Component | Purpose |
|-----------|-----------|---------|
| `agenda` | `AgendaView` | Upcoming meetings & tasks |
| `householdMember` | `HouseholdMemberView` | Individual member details (tabs: overview/accounts/notes) |
| `householdBrief` | `HouseholdBriefView` | Household overview |
| `etf` | `ETFView` | ETF/ticker data |

```typescript
const renderContent = () => {
  switch (currentView) {
    case "etf": return <ETFView />;
    case "householdMember": return <HouseholdMemberView />;
    case "householdBrief": return <HouseholdBriefView />;
    case "agenda":
    default: return <AgendaView />;
  }
};
```

---

## Data Flow

### Sending a Message

```
User types in ChatInput
         │
         ▼
User presses Enter
         │
         ▼
┌────────────────────────────────────┐
│ ensureConversation()               │  ← Creates conversation if needed
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ useChat.handleSubmit()             │  ← Vercel AI SDK sends to /api/copilot
│ body: { conversation_id }          │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ /api/copilot route:                │
│  - Extracts last user message      │
│  - Forwards to backend             │
└────────────────┬───────────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│ Backend streams response (SSE)     │
│ MessageList re-renders             │
└────────────────────────────────────┘
```

### Selecting a Household

```
User selects household in ChatScopePanel
         │
         ▼
┌────────────────────────────────────────┐
│ setHousehold(householdId)              │
│ (useHouseholdLockWithAPI hook)         │
└────────────────────┬───────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────────┐  ┌─────────────────────┐
│ API: selectClient   │  │ Store updates:      │
│ (locks conversation)│  │ - householdId       │
└─────────────────────┘  │ - conversationMode  │
                         │ - side_panel        │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ useBackendStateSync │
                         │ syncs to backend    │
                         └─────────────────────┘
```

---

## API Endpoints

### REST Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/copilot` | POST (SSE) | Send message, receive streaming response |

### tRPC Queries & Mutations

```typescript
// Copilot (conversation management)
api.copilot.createConversation   // Create a new conversation
api.copilot.getHistory           // Get conversation message history
api.copilot.selectClient         // Lock conversation to a household
api.copilot.getState             // Get conversation state
api.copilot.updateState          // Update conversation state

// Advisory (household data)
api.advisory.getHouseholds       // Get list of households
api.advisory.getHouseholdMember  // Get household member details
api.advisory.getClientHoldings   // Get client portfolio holdings

// Other
api.meetings.getMeetings         // Get upcoming meetings
api.ticker.getTickerInfo         // Get ETF/ticker information
```

---

## Key Types

```typescript
// Scope panel tabs
type ScopeTabKey = "households" | "meetings";

// Right sidebar views
type SidePanelView =
  | "agenda"          // Default: daily agenda/meetings
  | "householdMember" // Individual member details with tabs
  | "householdBrief"  // Household-level summary
  | "etf";            // ETF/mutual fund details

// Conversation mode (affects lock behavior)
type ConversationMode = "general" | "household";
```

For detailed type definitions, see [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md).

---

## Quick Reference

### "I want to understand state management"
→ See [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)

### "I want to understand how messages are sent"
→ Look at `_components/chat/index.tsx` (`onSubmit` callback) and `/api/copilot/route.ts`

### "I want to understand the scope dropdown"
→ Look at `_components/chat/_components/chat-scope-panel/index.tsx`

### "I want to understand how households are loaded"
→ Look at `hooks/useHouseholdManagement.ts`

### "I want to add a new scope tab"
1. Add to `scopeTabs` array in `types.ts`
2. Create new `XxxScopeTab.tsx` in `chat-scope-panel/_components/`
3. Add case in `chat-scope-panel/index.tsx` to render it

### "I want to add a new view to the right sidebar"
1. Create new view directory in `right-sidebar/_components/views/`:
   ```
   views/
   └── my-new-view/
       ├── index.tsx
       └── _components/
           └── MySubComponent.tsx
   ```
2. Export from `views/index.ts`
3. Add view mode to `SidePanelView` type in `right-sidebar/types.ts`
4. Add view state type in `store/types/side-panel/views/`
5. Add case in `renderContent()` in `right-sidebar/index.tsx`

### "I want to open the right sidebar programmatically"
```typescript
import { useNavigationActions } from "../../store/selectors";

const { openHouseholdMember, openHousehold, openEtf } = useNavigationActions();

// Open with household member
openHouseholdMember("member_123", { tab: "accounts" });

// Open with ETF
openEtf("SPY");
```

### "I want to access household context in chat"
```typescript
// Use the unified store selectors (single source of truth)
import { useHouseholdContextState } from "../../store/selectors";

const { householdId, conversationMode, isLocked } = useHouseholdContextState();

// For actions (setting household with API call)
import { useHouseholdLockWithAPI } from "../../hooks";

const { setHousehold, isLocked } = useHouseholdLockWithAPI(conversationId);
```
