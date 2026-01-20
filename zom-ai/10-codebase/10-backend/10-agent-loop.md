---
covers: ReAct agent loop implementation using Mirascope with streaming and tool execution.
concepts: [agent-loop, react-pattern, mirascope, streaming, tool-execution, llm-call]
---

# Agent Loop

The agent loop is the core execution engine of the Advisor Copilot. It implements a ReAct (Reason + Act) pattern using Mirascope's `@llm.call` decorator with streaming support and tool execution.

## Overview

The agent loop is an async generator that:
1. Loads context based on conversation mode (General or Client)
2. Builds a system prompt with accumulated context
3. Calls the LLM with available tools
4. Executes any tool calls and appends results to message history
5. Repeats until the LLM produces a final response (no tool calls)
6. Streams all output using the Vercel AI SDK protocol

**Location**: `advisor_copilot/agent/loop.py`

## ReAct Pattern Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Initialize                                                   │
│     • Load base context (General or Client mode)                 │
│     • Build system prompt with accumulated context               │
│     • Inject visual context (what user is viewing)               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. LLM Call (with tools)                                        │
│     @llm.call(provider="anthropic", model="claude-sonnet-4-5",   │
│               stream=True, tools=ALL_TOOLS)                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
              ▼                         ▼
┌─────────────────────┐    ┌────────────────────────────────────┐
│  3a. Tool Called    │    │  3b. Text Response                  │
│                     │    │                                      │
│  • Inject session   │    │  • Stream chunks to frontend         │
│  • Execute tool     │    │  • Persist message                   │
│  • Emit tool events │    │  • Emit end marker                   │
│  • Auto-switch view │    │  • Return (done!)                    │
│  • Load context     │    │                                      │
│  • Continue loop    │    │                                      │
└─────────┬───────────┘    └────────────────────────────────────┘
          │
          │ (append tool result to messages)
          │
          └─────────────────┐
                            │
                            ▼
                   ┌────────────────┐
                   │  Back to 2.    │
                   │  (next iter)   │
                   └────────────────┘
```

## AdvisorCopilotSession

The session is a request-scoped container that holds everything needed for a single request. It does **not** hold message history (loaded from DB per request).

**Location**: `advisor_copilot/agent/session.py`

```python
@dataclass
class AdvisorCopilotSession:
    advisor_id: UUID          # Who is using the system
    household_id: UUID | None # Which household (None = General Mode)
    conversation_id: UUID     # Which conversation thread
    db: AsyncSession          # Database connection
    model: str                # LLM model to use
    conversation_state: ConversationState  # Current state
```

### Key Methods

| Method | Description |
|--------|-------------|
| `initialize()` | Called once per request to load base context |
| `stream(messages)` | Run the agent loop and yield stream events |
| `create_panel_controller()` | Create a controller for view switching |
| `update_state(state)` | Update conversation state |
| `persist_state()` | Save state to database |

## Mirascope Integration

The loop uses Mirascope's `@llm.call` decorator for all LLM interactions:

```python
@llm.call(
    provider="anthropic",
    model="claude-sonnet-4-5",
    stream=True,
    tools=ALL_TOOLS,
)
async def _agent_call(messages: list[Any]) -> BaseDynamicConfig:
    """Make a streaming LLM call with tools."""
    return {"messages": messages}
```

### Two Call Patterns

1. **With Tools** (`_agent_call`): Used during the loop when tools are available
2. **Without Tools** (`_final_response`): Used when max iterations exceeded

## Streaming Protocol

Output is formatted for the frontend using the Vercel AI SDK protocol:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `0:` | Text content | `0:"Here's the analysis..."` |
| `9:` | Tool call start | `9:{"toolCallId":"...", "name":"..."}` |
| `a:` | Tool call result | `a:{"toolCallId":"...", "result":...}` |
| `2:` | Custom events | `2:[{"thinking": {"status":"analyzing"}}]` |
| `e:` | End marker | `e:{"finishReason":"stop"}` |

### Custom Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `thinking` | Before each LLM call | `{"status": "analyzing", "iteration": N}` |
| `tool_call_start` | Tool execution begins | `{"name": "...", "args": {...}}` |
| `tool_call_result` | Tool execution complete | `{"name": "...", "success": bool}` |
| `side_panel_update` | View changes | `{"view": "...", "view_state": {...}}` |
| `processing_reset` | New turn starts | `{"status": "new_turn"}` |

## Tool-Driven View Switching

When certain tools are called, the side panel view automatically switches:

```python
TOOL_TO_VIEW_MAP = {
    "GetHouseholdHoldings": "householdMember",
    "CompareToIps": "householdMember",
    "CreateTask": "householdMember",
    "GetEtfHoldings": "etf",
}
```

The agent loop handles this by:
1. Checking if the tool is in `TOOL_TO_VIEW_MAP`
2. Creating a `SidePanelController` with an event emitter
3. Calling `controller.set_view(target_view)`
4. Yielding emitted events to the stream
5. Loading additional context for the new view

## Context Building

The system prompt is assembled from multiple sources:

```
┌─────────────────────────────────────────────────────────────────┐
│  System Prompt                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Base System Prompt (from system_prompt.md)               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  <accumulated_context>                                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Context blocks from ContextManager.build_context_block() │  │
│  │  (household data, holdings, IPS, etc.)                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│  </accumulated_context>                                          │
│                                                                  │
│  <visual_context>                                                │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  What the user is currently viewing in the UI             │  │
│  │  (side panel view, selected member, etc.)                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│  </visual_context>                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Error Handling

- **Tool Errors**: Caught and returned as `{"error": "..."}` in the tool result
- **Max Iterations**: After 10 iterations, generates final response without tools
- **Persistence Errors**: Caught and logged but don't interrupt the stream

## Message Flow

```
API Request
    │
    ▼
Load conversation from DB
    │
    ▼
Create AdvisorCopilotSession
    │
    ▼
Initialize (load base context)
    │
    ▼
run_agent_loop(session, messages, context_manager, persistence)
    │
    ▼
Yield stream events
    │
    ▼
Frontend receives SSE stream
```

## Related Documentation

- [Context System](20-context-system.md) - How context is loaded and accumulated
- [Tools](30-tools.md) - Available tools and the registry pattern
- [State Management](40-state-management.md) - Conversation state and view switching
