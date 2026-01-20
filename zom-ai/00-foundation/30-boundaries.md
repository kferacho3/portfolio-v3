---
covers: What Zom AI explicitly will NOT do - system boundaries
concepts: [boundaries, non-goals, limitations, constraints]
---

# Boundaries: What Zom AI Won't Do

These boundaries define what Zom AI is **not** designed for. When evaluating feature requests, these constraints help maintain focus.

## Not a General-Purpose Chatbot

Zom AI is a domain-specific assistant for financial advisors.

**Won't do**:
- General knowledge Q&A unrelated to finance
- Creative writing, coding assistance, or general AI tasks
- Conversations outside the advisor workflow context

**Why**: Every feature should serve the advisor use case. Scope creep dilutes the product.

## Not Autonomous

The agent assists but does not act independently.

**Won't do**:
- Execute trades or transactions
- Send communications on behalf of the advisor
- Make decisions without human confirmation
- Automatically select clients for the user

**Why**: Financial advice involves fiduciary duty. The advisor must remain in control of all consequential actions.

## Not Real-Time Trading

Zom AI provides advice and research, not execution.

**Won't do**:
- Place buy/sell orders
- Manage live portfolios
- React to real-time market events automatically

**Why**: Trading requires different infrastructure (order management, compliance checks, latency requirements). Zom AI is for preparation and research.

## Not a Data Lake

The agent loads context on-demand, not exhaustively.

**Won't do**:
- Pre-load all household data for every conversation
- Store the entire market data history in context
- Maintain a comprehensive knowledge base in memory

**Why**: Token budgets are finite. Tool-driven context loading scales better and keeps responses focused.

## Not Cross-Conversation

Each conversation is scoped to one household (once selected).

**Won't do**:
- Compare multiple households in one conversation
- Switch clients mid-conversation
- Carry context between conversations

**Why**: Simplifies state management and prevents data leakage between clients. New question = new conversation.
