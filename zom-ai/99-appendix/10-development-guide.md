---
covers: Local development setup, testing strategies, and debugging techniques for Zom AI.
concepts: [local-setup, testing, bruno, debugging, streaming]
---

# Development Guide

This guide covers how to set up a local development environment, test the Zom AI system, and debug common issues.

---

## Local Setup

### Prerequisites

| Requirement | Purpose |
|-------------|---------|
| Python 3.11+ | Backend runtime |
| Node.js 18+ | Frontend runtime |
| PostgreSQL | Database |
| uv | Python package management |
| pnpm | Node package management |
| Bruno | API testing client |

### Backend Setup

```bash
# Navigate to backend
cd zom-ai/backend

# Install dependencies
uv sync

# Copy environment file
cp .env.example .env

# Configure required variables:
# - DATABASE_URL: PostgreSQL connection string
# - OPENAI_API_KEY: For LLM calls
# - Any external API keys for market tools

# Run migrations
uv run alembic upgrade head

# Seed test data
uv run python scripts/seed.py

# Start server
uv run uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
# Navigate to frontend
cd zom-ai-frontend

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local

# Configure:
# - NEXT_PUBLIC_API_URL: Backend URL (usually http://localhost:8000)

# Start development server
pnpm dev
```

---

## Testing

### API Testing with Bruno

The backend includes Bruno collections for testing endpoints. Bruno is preferred over Postman for its Git-friendly file format.

#### Test Collections

| Collection | Location | Purpose |
|------------|----------|---------|
| copilot | `bruno_zom_ai/copilot/` | Production conversation endpoints |
| ai-testing | `bruno_zom_ai/ai-testing/` | Debugging endpoints (aggregated responses) |
| auth | `bruno_zom_ai/auth/` | Authentication flows |

### Option 1: AI-Testing Endpoint (Debugging)

Best for: Debugging tool calls, seeing aggregated responses, inspecting raw stream.

```
POST /v1/ai-testing/agent/{household_id}/query
```

**Response includes:**
- `response`: Aggregated LLM text
- `tool_calls`: Array of tools called with success/failure
- `raw_stream`: Vercel AI SDK chunks for debugging

**Steps:**
1. Ensure `api_key` is set in Bruno environment
2. Run `ai-testing/agent/Process Agent Query.bru`

### Option 2: Production Endpoints (End-to-End)

Best for: Full integration testing, verifying streaming behavior.

**Steps:**
1. Run `auth/Login.bru` (saves `auth_token`)
2. Run `copilot/Create Conversation.bru` (saves `conversation_id`)
3. Run `copilot/Stream Chat.bru`

### Example Test Queries

| Category | Example Query |
|----------|---------------|
| Household Context | "What holdings does this client have?" |
| Household Context | "Is this client outside their IPS bands?" |
| Market Research | "What's the latest news on AAPL?" |
| Market Research | "Show me the fundamentals for MSFT" |
| Write Operations | "Create a task to review the portfolio" |

---

## Debugging

### Understanding Stream Output

The backend uses Vercel AI SDK protocol. Each line in the stream has a prefix:

| Prefix | Meaning | Example |
|--------|---------|---------|
| `0:` | Text content | `0:"Hello, I can help..."` |
| `9:` | Tool call start | `9:{"toolCallId":"...", "toolName":"get_ticker_info"}` |
| `a:` | Tool call result | `a:{"toolCallId":"...", "result":{...}}` |
| `2:` | Custom events | `2:[{"thinking":{"status":"analyzing"}}]` |
| `e:` | End marker | `e:{"finishReason":"stop", "usage":{...}}` |

### Common Issues

#### "Conversation not found"
- Ensure you ran `Create Conversation` first
- Check that `conversation_id` is set in Bruno environment
- Verify you're logged in as the correct user

#### "Household not found" or access denied
- Ensure `household_id` in environment matches a seeded household
- Verify the household belongs to the authenticated advisor

#### Empty response
- Check server logs for errors
- Verify `OPENAI_API_KEY` is configured
- Try a simpler query like "Hello"

#### Tool call errors
- Check that external API keys are configured (for market tools)
- Review tool call details in `raw_stream` or `tool_calls` response

### Debugging State Sync

When the frontend and backend state get out of sync:

1. **Check backend state**: `GET /v1/copilot/conversations/{id}/state`
2. **Check frontend state**: React DevTools → Zustand store
3. **Verify sync events**: Look for `2:[{"context_panel_update":...}]` in stream
4. **Check debounce timing**: Frontend syncs ~1s after user changes

### Debugging Agent Loop

To trace agent execution:

1. Enable debug logging in backend: `LOG_LEVEL=DEBUG`
2. Watch for these log entries:
   - `Starting agent loop` — Loop iteration beginning
   - `Tool call: {name}` — Tool being executed
   - `Tool result: {name}` — Tool execution complete
   - `Streaming response` — Final text generation

---

## Environment Variables

### Backend (`zom-ai/backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | OpenAI API key for LLM calls |
| `SECRET_KEY` | Yes | JWT signing key |
| `LOG_LEVEL` | No | Logging verbosity (default: INFO) |

### Frontend (`zom-ai-frontend/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend API base URL |
| `NEXT_PUBLIC_WS_URL` | No | WebSocket URL (if used) |

---

## Related Documentation

- [Backend Overview](../10-codebase/10-backend/00-overview.md) — Agent architecture
- [Frontend Overview](../10-codebase/20-frontend/00-overview.md) — UI architecture
- [Streaming Protocol](../10-codebase/30-integration/20-streaming-protocol.md) — Stream format details
- [State Sync](../10-codebase/30-integration/30-state-sync.md) — Bidirectional sync patterns
