---
covers: Backend Advisor Copilot service architecture, components, and directory structure.
concepts: [advisor-copilot, mirascope, agent-loop, context-manager, tool-registry, streaming]
---

# Backend: Advisor Copilot

The Advisor Copilot is a Mirascope-based LLM agent service that powers the AI assistant for financial advisors. It handles chat conversations, tool execution, context management, and state synchronization with the frontend.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API Layer                                       │
│                    POST /api/v1/copilot/chat/stream                          │
│                                                                              │
│  Request: {                                                                  │
│    conversation_id: UUID,                                                    │
│    message: string           # Just the new user message                     │
│  }                                                                           │
│                                                                              │
│  Server loads: conversation → household_id, message history from DB          │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AdvisorCopilotSession                                │
│                                                                              │
│  Request-scoped container holding:                                           │
│      advisor_id: UUID          # Who is using the system                     │
│      household_id: UUID        # Which household (if in Client Mode)         │
│      conversation_id: UUID     # Which conversation thread                   │
│      db: AsyncSession          # Database connection                         │
│      model: str                # LLM model to use                            │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────┐
│   ContextManager    │  │    ToolRegistry     │  │   ChatPersistence       │
│                     │  │                     │  │                         │
│ Providers:          │  │ Market Tools (14):  │  │ Hooks:                  │
│ • Household         │  │ • get_ticker_info   │  │ • save_incoming_msgs    │
│ • IPS               │  │ • get_fundamentals  │  │ • on_tool_call          │
│ • Holdings          │  │ • get_news          │  │ • on_tool_result        │
│ • Tasks             │  │ • ...               │  │ • on_text               │
│ • Documents         │  │                     │  │ • on_end                │
│                     │  │ Household Tools (4):│  │                         │
│ Accumulator:        │  │ • get_holdings      │  │                         │
│ • Tracks loaded     │  │ • compare_to_ips    │  │                         │
│                     │  │ • create_task       │  │                         │
│                     │  │ • search_documents  │  │                         │
└─────────────────────┘  └─────────────────────┘  └─────────────────────────┘
              │                       │                       │
              └───────────┬───────────┴───────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AgentLoop                                       │
│                                                                              │
│  Mirascope-based ReAct loop:                                                 │
│  1. Load base context (mode-dependent)                                       │
│  2. Build system prompt with accumulated context                             │
│  3. Call LLM with tools → execute tools → append results → repeat            │
│  4. Stream final response when no more tools                                 │
│  5. Emit context_panel_update events for view switching                      │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         StreamProtocol (Vercel AI SDK)                       │
│                                                                              │
│  Formats output for frontend:                                                │
│  • 0:"text chunk"           - Text content                                   │
│  • 9:{toolCallId, ...}      - Tool call start                                │
│  • a:{toolCallId, result}   - Tool call result                               │
│  • 2:[{event: data}]        - Custom events (thinking, view changes)         │
│  • e:{finishReason, usage}  - End marker                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
services/advisor_copilot/
├── __init__.py                 # Main exports
├── types.py                    # ChatRequest, ChatMessage models
│
├── agent/                      # Core agent logic
│   ├── session.py              # AdvisorCopilotSession (request-scoped)
│   ├── loop.py                 # Mirascope-based agent loop
│   ├── user_prompt_builder.py  # Builds system prompts with context
│   └── system_prompt.md        # System prompt template
│
├── context/                    # Household context system
│   ├── manager.py              # ContextManager - orchestrates providers
│   ├── accumulator.py          # ContextAccumulator - tracks loaded contexts
│   ├── base.py                 # ContextProviderBase abstract class
│   ├── providers/              # HouseholdProvider, IPSProvider, etc.
│   └── models/                 # Pydantic models for context data
│
├── state/                      # Conversation state management
│   ├── models.py               # ConversationState, SidePanelState, ViewType
│   └── controller.py           # SidePanelController - view switching
│
├── stream/                     # Streaming infrastructure
│   ├── vercel.py               # StreamVercel - Vercel AI SDK protocol
│   ├── persistence.py          # ChatPersistence - message saving
│   └── queue.py                # PersistenceQueue - async DB writes
│
└── tools/                      # Tool system
    ├── registry.py             # Tool lists, TOOL_TO_VIEW_MAP
    ├── market/                 # 14 market research tools
    └── household/              # 4 household-aware tools
```

## Section Index

| Document | Description |
|----------|-------------|
| [Agent Loop](10-agent-loop.md) | ReAct loop implementation, Mirascope patterns, streaming |
| [Context System](20-context-system.md) | ContextManager, providers, accumulator pattern |
| [Tools](30-tools.md) | ToolRegistry, market tools, household tools |
| [State Management](40-state-management.md) | ConversationState, SidePanelController, modes |

## Key Concepts

### Conversation Modes

| Mode | Description | Context Available |
|------|-------------|-------------------|
| **General** | No household selected | Advisor dashboard, calendar, tasks |
| **Client** | Locked to a household | Full household data: holdings, IPS, documents, tasks |

### Core Principles

- **Explicit State**: All context flows through parameters, not globals
- **Tool-Driven Context**: Agent requests what it needs via tools (no query analysis)
- **Streaming-First**: Real-time responses via Vercel AI SDK protocol
- **Mirascope Everywhere**: All LLM calls use the `@llm.call` decorator pattern

## Related Documentation

- **Frontend**: [Frontend Overview](../20-frontend/00-overview.md) - UI components consuming this API
- **Integration**: [Integration Overview](../30-integration/00-overview.md) - How frontend and backend connect
