---
covers: Context management system including ContextManager, providers, and accumulator pattern.
concepts: [context-manager, context-providers, context-accumulator, tool-driven-context, detail-levels]
---

# Context System

The context system manages household data that gets injected into the LLM's system prompt. It uses a **tool-driven** approach where context is loaded explicitly when tools are used, rather than analyzing queries to guess what's needed.

## Overview

The context system consists of three main components:

1. **ContextManager**: Orchestrates providers and builds context blocks
2. **Context Providers**: Load and format specific data types (household, holdings, etc.)
3. **ContextAccumulator**: Tracks what has been loaded across the conversation

**Location**: `advisor_copilot/context/`

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        ContextManager                            │
│                                                                  │
│  Responsibilities:                                               │
│  • Initialize providers for the household                        │
│  • Load context explicitly (tool-driven)                         │
│  • Build formatted context blocks for prompts                    │
│  • Track loaded contexts via accumulator                         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Household  │    │     IPS     │    │  Holdings   │  ...
│  Provider   │    │  Provider   │    │  Provider   │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                           ▼
               ┌─────────────────────┐
               │  ContextAccumulator │
               │                     │
               │  Tracks:            │
               │  • What's loaded    │
               │  • Detail levels    │
               │  • Load order       │
               └─────────────────────┘
```

## ContextManager

The central coordinator for all context operations.

**Location**: `advisor_copilot/context/manager.py`

### Initialization

```python
context_manager = ContextManager(
    household_id=uuid,  # None for General Mode
    db=async_session,
)
await context_manager.initialize()  # Loads base context
```

### Key Methods

| Method | Description |
|--------|-------------|
| `initialize()` | Load base context based on mode |
| `load_context(type, detail_level)` | Explicitly load a context type |
| `build_context_block()` | Build XML-formatted context string |
| `get_loaded_contexts()` | List of loaded context types |
| `is_context_loaded(type)` | Check if a type is loaded |

### Mode-Specific Loading

| Mode | Method Called | What Loads |
|------|---------------|------------|
| General | `load_general_mode_context()` | Synthetic dashboard context |
| Client | `load_client_mode_context()` | Household overview |

## Context Providers

Each provider handles one type of household data. All providers extend `ContextProviderBase`.

### Provider Registry

```python
PROVIDER_REGISTRY = {
    "household": HouseholdContextProvider,
    "ips": IPSContextProvider,
    "holdings": HoldingsContextProvider,
    "tasks": TasksContextProvider,
    "documents": DocumentsContextProvider,
}
```

### Provider Interface

```python
class ContextProviderBase:
    async def load(force_reload: bool = False) -> Any:
        """Load data from database"""

    def render(detail_level: DetailLevel) -> str:
        """Render data as formatted string"""

    def clear_cache() -> None:
        """Clear cached data"""
```

### Available Providers

| Provider | Data Type | What It Provides |
|----------|-----------|------------------|
| `HouseholdContextProvider` | household | Basic household info, members, summary |
| `IPSContextProvider` | ips | Investment Policy Statement details |
| `HoldingsContextProvider` | holdings | Account holdings, positions, allocations |
| `TasksContextProvider` | tasks | Pending tasks for the household |
| `DocumentsContextProvider` | documents | Document metadata (not full content) |

## ContextAccumulator

Tracks what contexts have been loaded and at what detail level. This prevents duplicate loading and enables cumulative context building.

**Location**: `advisor_copilot/context/accumulator.py`

### How It Works

```
Tool: GetHouseholdHoldings
         │
         ▼
ContextManager.load_context("holdings")
         │
         ▼
Accumulator.mark_loaded("holdings", data, DetailLevel.DEFAULT)
         │
         ▼
[Next turn]
         │
         ▼
ContextManager.build_context_block()
         │
         ▼
Returns XML with all accumulated contexts
```

### Accumulator Methods

| Method | Description |
|--------|-------------|
| `mark_loaded(type, data, level)` | Record that a context was loaded |
| `is_loaded(type)` | Check if already loaded |
| `get_loaded_types()` | List all loaded types |
| `build_context_block(render_fn)` | Build formatted context string |
| `clear()` | Reset accumulator |
| `summary()` | Debug summary of state |

## Detail Levels

Context can be rendered at different detail levels:

```python
class DetailLevel(Enum):
    SUMMARY = "summary"    # High-level overview
    DEFAULT = "default"    # Standard detail
    DETAILED = "detailed"  # Full detail for deep analysis
```

The detail level affects how providers format their output - more detail means more context tokens but better information for the LLM.

## Context Block Format

The `build_context_block()` method produces XML-formatted sections:

```xml
<household_context>
Household: Smith Family
Members: John Smith (Primary), Jane Smith (Spouse)
Total AUM: $1,234,567
Risk Profile: Moderate
</household_context>

<holdings_context>
Accounts:
- Brokerage (John): $500,000
  - AAPL: 100 shares ($15,000)
  - MSFT: 50 shares ($20,000)
  ...
</holdings_context>
```

## Tool-Driven Context Loading

Context is loaded in two ways:

### 1. Base Context (on initialize)

```
General Mode → Dashboard context (synthetic)
Client Mode  → Household overview
```

### 2. Tool-Triggered Loading

When tools execute, the agent loop loads related context:

```python
VIEW_TO_CONTEXT_MAP = {
    "householdMember": "holdings",
    "householdBrief": "household",
}
```

After switching views, the loop calls:
```python
if target_view in VIEW_TO_CONTEXT_MAP:
    context_type = VIEW_TO_CONTEXT_MAP[target_view]
    await context_manager.load_context(context_type)
```

## General Mode vs Client Mode

| Aspect | General Mode | Client Mode |
|--------|--------------|-------------|
| `household_id` | `None` | UUID |
| Providers | None initialized | All initialized |
| Base context | Synthetic dashboard | Household overview |
| Available tools | Market only | Market + Household |

### General Mode Context

When no household is selected, a synthetic context is added:

```python
dashboard_context = {
    "mode": "general",
    "description": "Advisor dashboard view - no client selected",
    "capabilities": [
        "Calendar and scheduling",
        "Cross-client queries",
        "General financial questions",
        "Notifications and alerts",
    ],
}
```

## Context Summary (Debugging)

For debugging, `context_summary()` returns the current state:

```python
{
    "mode": "client",
    "household_id": "uuid-here",
    "household_name": "Smith Family",
    "accumulator": {
        "loaded_types": ["household", "holdings"],
        "load_order": ["household", "holdings"],
        "detail_levels": {"household": "default", "holdings": "default"}
    }
}
```

## Related Documentation

- [Agent Loop](10-agent-loop.md) - How the loop uses context
- [Tools](30-tools.md) - Tools that trigger context loading
- [State Management](40-state-management.md) - View switching that triggers context
