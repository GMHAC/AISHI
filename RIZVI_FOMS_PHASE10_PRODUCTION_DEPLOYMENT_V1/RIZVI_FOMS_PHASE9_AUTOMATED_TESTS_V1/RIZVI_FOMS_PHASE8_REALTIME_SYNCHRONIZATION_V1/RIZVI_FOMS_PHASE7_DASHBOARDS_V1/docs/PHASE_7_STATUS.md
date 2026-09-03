# Phase 7 — Section, Department & Management Dashboards

## Section Dashboard
- Current work status
- Checklist completion
- Overdue items
- KPI status
- Audit/NC/CAPA attention items
- Recent evidence/media
- Section alerts

## Department Dashboard
- Aggregated section performance
- Open/in-progress/overdue work
- KPI measurements
- Audit findings
- NC/CAPA status
- Department alerts and messages

## Management Dashboard
- Cross-department live operational summary
- Work status aggregation
- KPI status
- Audit / NC / CAPA attention
- Enterprise alerts
- Management messages and delivery tracking

## Real-time architecture
The 3-second refresh requirement is represented as a production contract using
WebSocket/SSE event delivery with polling fallback. Actual 3-second delivery
depends on deployed database, worker, event bus, network and client infrastructure.
