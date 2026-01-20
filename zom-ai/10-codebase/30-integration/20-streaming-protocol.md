---
covers:
  - Vercel AI SDK streaming format
  - Event prefixes and types
  - Backend StreamProtocol
  - Frontend stream handling
concepts:
  - SSE streaming
  - Tool call events
  - context_panel_update events
---

# Streaming Protocol

This document details the streaming protocol used between the Zom AI backend and frontend, based on the Vercel AI SDK format.

---

## Overview

The backend streams responses using Server-Sent Events (SSE) in the **Vercel AI SDK protocol**. This enables:
- Real-time text streaming
- Tool call visibility during execution
- Custom events like view updates

```
┌─────────────────────────────────────────────────────────────────┐
│                         Backend Agent                           │
│                                                                 │
│    ┌──────────────────┐      ┌──────────────────┐               │
│    │   AgentLoop      │─────►│  StreamProtocol  │               │
│    │ (Mirascope-based)│      │ (Vercel AI SDK)  │               │
│    └──────────────────┘      └────────┬─────────┘               │
│                                       │                         │
│                                       ▼  SSE Stream             │
└───────────────────────────────────────┼─────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Frontend                               │
│                                                                 │
│    ┌──────────────────┐      ┌──────────────────┐               │
│    │    useChat       │◄─────│  Stream Handler  │               │
│    │ (Vercel AI SDK)  │      │                  │               │
│    └──────────────────┘      └──────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Vercel AI SDK Format

### Event Prefixes

Each line in the SSE stream starts with a prefix that identifies the event type:

| Prefix | Name | Description | Example |
|--------|------|-------------|---------|
| `0:` | Text | Text content chunk | `0:"Hello, "` |
| `9:` | Tool Call Start | Tool call initiated | `9:{"toolCallId":"abc","toolName":"get_ticker_info","args":{...}}` |
| `a:` | Tool Call Result | Tool execution result | `a:{"toolCallId":"abc","result":{...}}` |
| `2:` | Data | Custom events | `2:[{"context_panel_update":{...}}]` |
| `e:` | Finish | Stream end marker | `e:{"finishReason":"stop","usage":{...}}` |

### Example Stream

```
0:"Let me look up "
0:"AAPL for you."
9:{"toolCallId":"call_1","toolName":"get_ticker_info","args":{"ticker":"AAPL"}}
a:{"toolCallId":"call_1","result":{"name":"Apple Inc","price":182.52}}
2:[{"context_panel_update":{"view":"etf","ticker":"AAPL"}}]
0:"Apple Inc is currently trading at $182.52."
e:{"finishReason":"stop","usage":{"promptTokens":150,"completionTokens":42}}
```

---

## Backend: StreamProtocol

**Location:** `advisor_copilot/stream/vercel.py`

The `StreamProtocol` class formats output for the frontend according to the Vercel AI SDK specification.

### Key Methods

```python
class StreamVercel(AbstractStreamProtocol):
    def text(self, content: str) -> str:
        """Format text chunk: 0:"content" """
        return f'0:{json.dumps(content)}\n'

    def tool_call(self, tool_call_id: str, name: str, args: dict) -> str:
        """Format tool call start: 9:{...} """
        return f'9:{json.dumps({"toolCallId": tool_call_id, "toolName": name, "args": args})}\n'

    def tool_result(self, tool_call_id: str, result: Any) -> str:
        """Format tool result: a:{...} """
        return f'a:{json.dumps({"toolCallId": tool_call_id, "result": result})}\n'

    def data(self, events: list[dict]) -> str:
        """Format custom events: 2:[...] """
        return f'2:{json.dumps(events)}\n'

    def finish(self, reason: str, usage: dict) -> str:
        """Format end marker: e:{...} """
        return f'e:{json.dumps({"finishReason": reason, "usage": usage})}\n'
```

### Usage in Agent Loop

```python
async def run_agent_loop(session, messages) -> AsyncGenerator[str, None]:
    protocol = StreamVercel()

    # Stream text
    async for chunk in llm.stream(messages):
        yield protocol.text(chunk.content)

    # Emit tool calls
    for tool_call in response.tool_calls:
        yield protocol.tool_call(
            tool_call.id,
            tool_call.name,
            tool_call.args
        )

        # Execute tool and emit result
        result = await execute_tool(tool_call, session)
        yield protocol.tool_result(tool_call.id, result)

        # Emit view update if tool triggers view change
        if tool_call.name in TOOL_TO_VIEW_MAP:
            view = TOOL_TO_VIEW_MAP[tool_call.name]
            yield protocol.data([{
                "context_panel_update": {
                    "view": view,
                    "timestamp": datetime.now().isoformat()
                }
            }])

    yield protocol.finish("stop", usage)
```

---

## Custom Events

### context_panel_update

The most important custom event—tells the frontend to update the context panel view.

**Format:**
```
2:[{"context_panel_update":{"view":"holdings","ticker":"AAPL","timestamp":"2026-01-15T12:00:00Z"}}]
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `view` | string | Target view: `"agenda"`, `"householdBrief"`, `"householdMember"`, `"etf"`, `"holdings"` |
| `ticker` | string? | Ticker symbol (for ETF views) |
| `householdId` | string? | Household UUID (for household views) |
| `memberId` | string? | Member UUID (for member views) |
| `timestamp` | string | ISO timestamp |

### thinking/reasoning

Optional events for showing AI "thinking" state:

```
2:[{"thinking":{"step":"Analyzing household holdings..."}}]
2:[{"reasoning":{"content":"I should compare to the IPS targets..."}}]
```

---

## Frontend: useChat Hook

**Location:** `_components/chat/index.tsx`

The frontend uses Vercel AI SDK's `useChat` hook to handle the stream.

### Basic Usage

```typescript
import { useChat } from "ai/react";

const { messages, input, handleSubmit, isLoading, data } = useChat({
  api: "/api/copilot",
  body: {
    conversation_id: conversationId,
  },
  onToolCall: ({ toolCall }) => {
    // Handle tool call visualization
    console.log("Tool called:", toolCall.name);
  },
});
```

### Stream Event Handling

The `data` property contains custom events (prefix `2:`):

```typescript
// Access custom events
const streamData = data;  // Array of custom event payloads

// Watch for context_panel_update events
useEffect(() => {
  if (!streamData) return;

  for (const event of streamData) {
    if (event.context_panel_update) {
      // Update Zustand store
      const { view, ticker, householdId, memberId } = event.context_panel_update;

      if (view === "etf" && ticker) {
        openEtf(ticker);
      } else if (view === "householdBrief" && householdId) {
        openHousehold(householdId);
      }
      // ... handle other views
    }
  }
}, [streamData]);
```

---

## Tool-to-View Mapping

**Location:** `advisor_copilot/agent/loop.py`

Certain tools automatically trigger view changes:

```python
TOOL_TO_VIEW_MAP = {
    # Market tools → ETF view
    "get_ticker_info": ViewType.ETF,
    "get_ticker_fundamentals": ViewType.ETF,
    "get_ticker_news": ViewType.ETF,
    "get_etf_holdings": ViewType.ETF,

    # Household tools → Household views
    "get_household_holdings": ViewType.HOLDINGS,
    "compare_to_ips": ViewType.HOUSEHOLD_BRIEF,
    "search_documents": ViewType.HOUSEHOLD_BRIEF,
}
```

When a tool executes successfully, the agent loop:
1. Emits the `context_panel_update` event
2. Persists the new view state to the database
3. Frontend updates the UI in real-time

---

## Message Format

### User Message

The frontend sends only the new message (history is loaded from DB):

```json
{
  "conversation_id": "uuid",
  "message": "What are the holdings for this client?"
}
```

### Assistant Message (Streamed)

Assembled from stream chunks:

```typescript
interface Message {
  id: string;
  role: "assistant";
  content: string;  // Accumulated text from 0: prefixes
  toolInvocations?: {
    toolCallId: string;
    toolName: string;
    args: Record<string, any>;
    result?: any;
    state: "call" | "result";
  }[];
}
```

---

## Error Handling in Streams

### Stream Errors

If the backend encounters an error during streaming:

```
0:"I encountered an error while processing your request."
e:{"finishReason":"error","error":{"message":"Tool execution failed"}}
```

### Handling on Frontend

```typescript
const { error } = useChat({
  // ...
  onError: (error) => {
    console.error("Chat error:", error);
    // Show error toast or message
  },
});

// Error is also available reactively
if (error) {
  return <ErrorMessage error={error} />;
}
```
