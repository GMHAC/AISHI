# Phase 8 — Real-time Synchronization

## Implemented foundations
- Transactional event outbox table
- Event inbox / consumer deduplication table
- Event cursor
- Sync subscription tracking
- Real-time event envelope
- WebSocket hub implementation
- Idempotency contract
- Durable publish/retry/dead-letter contract

## Synchronization model
Business transaction → Outbox event → Durable publisher → Consumer inbox
→ Read-model/dashboard update → WebSocket/SSE notification.

## Reliability
- Database remains source of truth
- Event IDs support deduplication
- Inbox unique key supports idempotent consumers
- Failed events can be retried
- Exhausted events can enter dead-letter state
- Clients reconnect and re-fetch authoritative state

## 3-second dashboard target
The earlier dashboard target is supported by push notifications and event-driven
refresh. Exact latency depends on production infrastructure and load.
