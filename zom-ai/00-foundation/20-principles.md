---
covers: Design principles and heuristics that guide Zom AI development
concepts: [principles, explicit state, tool-driven context, streaming-first, single source of truth, bidirectional sync]
---

# Design Principles

These principles guide all architectural decisions in Zom AI. When making design choices, defer to these heuristics.

## 1. Explicit State, No Globals

**Principle**: All context flows through explicit parameters, not class-level globals.

**Rationale**: Makes data flow traceable, simplifies testing, and eliminates hidden dependencies. Every function should declare what it needs.

**Example**: `AdvisorCopilotSession` is a dataclass that explicitly carries `advisor_id`, `household_id`, `conversation_id`, and `db` connection — not global singletons.

## 2. Tool-Driven Context

**Principle**: The agent requests context it needs through tools, rather than pre-loading everything.

**Rationale**:
- Reduces token usage (only load what's needed)
- Makes context gathering visible to the user
- Scales better as data grows

**Example**: Instead of loading all household data upfront, the agent calls `get_holdings` or `get_ips` tools when it needs that information.

## 3. Streaming-First

**Principle**: Responses stream to the user in real-time, not after completion.

**Rationale**:
- Better perceived performance (users see progress)
- Allows early termination if off-track
- Enables showing tool calls as they happen

**Implementation**: Vercel AI SDK protocol on both ends — backend streams SSE with prefixes (`0:`, `9:`, `a:`, etc.), frontend uses `useChat` hook.

## 4. Single Source of Truth (Frontend)

**Principle**: The Zustand store is the single source of truth for all frontend state.

**Rationale**:
- No conflicting state between components
- Predictable data flow
- Easy debugging (inspect store)

**Rule**: Components read from store selectors. Mutations go through store actions or domain hooks that wrap store + API.

## 5. Bidirectional State Sync

**Principle**: Frontend and backend maintain synchronized state through explicit sync mechanisms.

**Rationale**: The agent needs to know what the user sees, and the UI needs to reflect what the agent is doing.

**How it works**:
- **User → Backend**: `useBackendStateSync` hook sends state to backend on changes
- **Agent → Frontend**: `context_panel_update` stream events update the store
- **Visual context injection**: Agent receives `<visual_context>` block describing current UI state

## 6. Internal Services for External APIs

**Principle**: External services are wrapped in internal service classes.

**Rationale**:
- Clear abstraction over providers
- Easy to swap implementations
- Mockable for testing

**Example**: `TickerService` wraps external market data APIs, `StreamVercel` wraps SSE streaming.

## 7. Mode-Aware Behavior

**Principle**: The system behaves differently based on conversation mode (General vs Client).

**Rationale**: Advisors don't always have a client selected. General mode handles calendar, market research. Client mode handles household-specific queries.

**Rule**: Mode is determined by `household_id` presence. Once a client is selected, the conversation is locked — switching requires starting a new conversation.
