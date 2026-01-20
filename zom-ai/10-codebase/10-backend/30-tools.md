---
covers: Tool system including registry, market tools, household tools, and tool-to-view mapping.
concepts: [tool-registry, mirascope-tools, market-tools, household-tools, tool-to-view-map]
---

# Tool System

The tool system provides capabilities to the LLM agent. Tools are Mirascope `BaseTool` classes organized into two categories: **Market Tools** (no session required) and **Household Tools** (require session injection).

## Overview

The Advisor Copilot has 18 tools total:
- **14 Market Tools**: Fetch market data, ticker info, news, etc.
- **4 Household Tools**: Access client-specific data (holdings, IPS, tasks, documents)

**Location**: `advisor_copilot/tools/`

## Tool Registry

Tools are organized as simple lists in the registry module.

**Location**: `advisor_copilot/tools/registry.py`

```python
# Market tools - no session required
MARKET_TOOLS: list[type[BaseTool]] = [
    GetTickerInfo,
    GetTickerFundamentals,
    GetTickerNews,
    # ... 11 more
]

# Household tools - require session injection
HOUSEHOLD_TOOLS: list[type[BaseTool]] = [
    GetHouseholdHoldings,
    CompareToIps,
    SearchDocuments,
    CreateTask,
]

# Combined list passed to @llm.call
ALL_TOOLS = MARKET_TOOLS + HOUSEHOLD_TOOLS
```

## Market Tools (14)

Market tools fetch financial data from external APIs. They don't require household context and work in both General and Client modes.

| Tool | Description |
|------|-------------|
| `GetTickerInfo` | Basic ticker information (price, change, volume) |
| `GetTickerFundamentals` | Fundamental metrics (P/E, market cap, etc.) |
| `GetTickerNews` | Recent news for a specific ticker |
| `GetAllTickerNews` | Aggregated news across multiple tickers |
| `GetTickerInfoBulk` | Batch ticker info lookup |
| `GetInsiderTrades` | Insider trading activity |
| `GetDarkpoolTrades` | Dark pool transaction data |
| `GetCongressTrades` | Congressional trading disclosures |
| `GetInstitutionOwnership` | Institutional ownership data |
| `GetHistoricalOptions` | Historical options data |
| `GetEtfHoldings` | ETF constituent holdings |
| `GetEtfList` | Search/list ETFs |
| `GetQuartrEarnings` | Earnings call transcripts |
| `SearchTickers` | Search for tickers by name/symbol |

**Location**: `advisor_copilot/tools/market/`

## Household Tools (4)

Household tools access client-specific data. They require session injection and only work in Client Mode (when a household is selected).

| Tool | Description |
|------|-------------|
| `GetHouseholdHoldings` | Get all holdings for the household |
| `CompareToIps` | Compare current allocation to IPS targets |
| `SearchDocuments` | Search household documents |
| `CreateTask` | Create a task for the household |

**Location**: `advisor_copilot/tools/household/`

### Session Injection

Household tools need access to the session (for household_id, database, etc.). This is injected at runtime:

```python
def inject_session(tool_instance: BaseTool, session: AdvisorCopilotSession) -> None:
    """Inject session into household tools that need it."""
    tool_class = type(tool_instance)
    if tool_class in HOUSEHOLD_TOOLS:
        tool_instance._session = session
```

The agent loop calls this for each tool before execution:

```python
for chunk, tool in stream:
    if tool is not None:
        inject_session(tool, session)  # Inject before call
        result = await tool.call()
```

## Tool-to-View Mapping

Certain tools trigger automatic view switching in the side panel. This creates a seamless UX where discussing holdings switches to the holdings view.

```python
TOOL_TO_VIEW_MAP = {
    "GetHouseholdHoldings": "householdMember",
    "CompareToIps": "householdMember",
    "CreateTask": "householdMember",
    "GetEtfHoldings": "etf",
}
```

### How It Works

```
User: "Show me the Smith family holdings"
            │
            ▼
Agent calls GetHouseholdHoldings tool
            │
            ▼
Agent loop checks TOOL_TO_VIEW_MAP
            │
            ▼
"GetHouseholdHoldings" → "householdMember"
            │
            ▼
SidePanelController.set_view("householdMember")
            │
            ▼
Stream emits side_panel_update event
            │
            ▼
Frontend sidebar switches to household member view
```

### Tools NOT Mapped

`SearchDocuments` is intentionally NOT in the mapping. Per spec, document search returns results inline in the chat rather than switching views.

## Tool Definition Pattern

Tools are Mirascope `BaseTool` classes with typed fields:

```python
class GetTickerInfo(BaseTool):
    """Get basic information about a stock ticker."""

    ticker: str = Field(description="The stock ticker symbol (e.g., AAPL)")

    async def call(self) -> dict[str, Any]:
        """Fetch ticker info from API."""
        # Implementation...
        return {"ticker": self.ticker, "price": 150.00, ...}
```

### Household Tool Pattern

Household tools access session via `_session` attribute:

```python
class GetHouseholdHoldings(BaseTool):
    """Get holdings for the current household."""

    _session: AdvisorCopilotSession | None = None

    async def call(self) -> dict[str, Any]:
        """Fetch holdings from database."""
        if not self._session:
            return {"error": "Session not initialized"}

        household_id = self._session.household_id
        # Query database...
        return {"holdings": [...]}
```

## Tool Execution Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  LLM decides to call a tool                                      │
│  → Mirascope parses tool call from response                      │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Agent loop receives (chunk, tool) from stream                   │
│  → tool is a BaseTool instance with populated fields             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  inject_session(tool, session)                                   │
│  → Only affects household tools                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  result = await tool.call()                                      │
│  → Returns dict (may include "error" key on failure)             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  result = compact_for_context(result)                            │
│  → Truncate large results to fit context window                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Emit tool events to stream                                      │
│  → tool_call_start, tool_call_result                             │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Check TOOL_TO_VIEW_MAP                                          │
│  → Switch view if tool is mapped                                 │
│  → Load additional context for new view                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Append tool result to message history                           │
│  → Continue to next loop iteration                               │
└─────────────────────────────────────────────────────────────────┘
```

## Error Handling

Tool errors are caught and returned as structured error objects:

```python
try:
    result = await tool.call()
except Exception as e:
    result = {"error": str(e)}
```

The agent receives the error and can respond appropriately:

```
Agent: "I encountered an error fetching the ticker info: API rate limit exceeded. Let me try again in a moment."
```

## Utility Functions

| Function | Description |
|----------|-------------|
| `inject_session(tool, session)` | Inject session into household tools |
| `is_household_tool(tool_class)` | Check if a tool requires session |

## Directory Structure

```
tools/
├── registry.py          # Tool lists, TOOL_TO_VIEW_MAP, inject_session
├── market/              # Market tools (14)
│   ├── get_ticker_info.py
│   ├── get_ticker_fundamentals.py
│   ├── get_ticker_news.py
│   └── ...
└── household/           # Household tools (4)
    ├── get_household_holdings.py
    ├── compare_to_ips.py
    ├── search_documents.py
    └── create_task.py
```

## Related Documentation

- [Agent Loop](10-agent-loop.md) - How tools are executed in the loop
- [Context System](20-context-system.md) - Context loaded after tool execution
- [State Management](40-state-management.md) - View switching triggered by tools
