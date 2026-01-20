---
covers: Complete Zom AI system architecture spanning backend agent and frontend AI chat.
concepts: [advisor-copilot, ai-chat, mirascope, zustand, vercel-ai-sdk, shared-reality]
---

# Codebase Overview

This is the formal documentation entry point for understanding how the Zom AI system is built. The codebase spans two repositories working together as one unified AI assistant for financial advisors.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Zom AI System                                       │
│                                                                                  │
│  ┌─────────────────────────┐              ┌─────────────────────────────────┐   │
│  │   Frontend (Next.js)    │              │   Backend (Python/FastAPI)       │   │
│  │   zom-ai-frontend/      │              │   zom-ai/backend/               │   │
│  │                         │              │                                  │   │
│  │  ┌───────────────────┐  │    REST/     │  ┌────────────────────────────┐ │   │
│  │  │  AI Chat Page     │  │    tRPC      │  │  Advisor Copilot Service   │ │   │
│  │  │  • AIChat         │◄─┼─────────────►│  │  • AgentLoop (Mirascope)   │ │   │
│  │  │  • RightSideBar   │  │              │  │  • ContextManager          │ │   │
│  │  │  • ChatScopePanel │  │   Streaming  │  │  • ToolRegistry            │ │   │
│  │  └───────────────────┘  │   (SSE)      │  └────────────────────────────┘ │   │
│  │                         │              │             │                    │   │
│  │  ┌───────────────────┐  │              │             ▼                    │   │
│  │  │  Zustand Store    │  │   Shared     │  ┌────────────────────────────┐ │   │
│  │  │  (Single Source   │◄─┼───Reality───►│  │  ConversationState (JSONB) │ │   │
│  │  │   of Truth)       │  │              │  │  (Persisted in PostgreSQL) │ │   │
│  │  └───────────────────┘  │              │  └────────────────────────────┘ │   │
│  │                         │              │                                  │   │
│  └─────────────────────────┘              └─────────────────────────────────┘   │
│                                                                                  │
│  Key Integration Points:                                                         │
│  • Vercel AI SDK streaming protocol (0:, 9:, a:, 2:, e: prefixes)               │
│  • Bidirectional state sync (context_panel_update events)                        │
│  • Household lock mechanism (conversation bound to client)                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Core Principles

These principles guide all architectural decisions in the Zom AI system:

| Principle | Description |
|-----------|-------------|
| **Explicit State** | All context flows through parameters, not globals. No hidden state. |
| **Tool-Driven Context** | The agent requests what it needs via tools, not query analysis. |
| **Streaming-First** | Real-time user feedback via Vercel AI SDK protocol. |
| **Single Source of Truth** | Frontend: Zustand store. Backend: ConversationState JSONB. |
| **Shared Reality** | Agent and user always see the same UI context. |

---

## Section Index

| Section | Description |
|---------|-------------|
| [10-backend/](./10-backend/00-overview.md) | **Backend: Advisor Copilot** — Mirascope-based agent loop, context management, tool registry, state management |
| [20-frontend/](./20-frontend/00-overview.md) | **Frontend: AI Chat** — Zustand store, components, domain hooks, Vercel AI SDK integration |
| [30-integration/](./30-integration/00-overview.md) | **Integration** — API contracts, streaming protocol, bidirectional state sync |

---

## Quick Navigation

### Understanding the Backend
Start with: [Backend Overview](./10-backend/00-overview.md) → [Agent Loop](./10-backend/10-agent-loop.md) → [Context System](./10-backend/20-context-system.md)

### Understanding the Frontend
Start with: [Frontend Overview](./20-frontend/00-overview.md) → [State Management](./20-frontend/20-state-management.md) → [Components](./20-frontend/10-components.md)

### Understanding the Integration
Start with: [Integration Overview](./30-integration/00-overview.md) → [Streaming Protocol](./30-integration/20-streaming-protocol.md) → [State Sync](./30-integration/30-state-sync.md)

---

## Related Documentation

- **Foundation**: [../00-foundation/](../00-foundation/00-overview.md) — Purpose, principles, and boundaries of Zom AI
- **Appendix**: [../99-appendix/](../99-appendix/00-overview.md) — Development guide, local setup, testing
