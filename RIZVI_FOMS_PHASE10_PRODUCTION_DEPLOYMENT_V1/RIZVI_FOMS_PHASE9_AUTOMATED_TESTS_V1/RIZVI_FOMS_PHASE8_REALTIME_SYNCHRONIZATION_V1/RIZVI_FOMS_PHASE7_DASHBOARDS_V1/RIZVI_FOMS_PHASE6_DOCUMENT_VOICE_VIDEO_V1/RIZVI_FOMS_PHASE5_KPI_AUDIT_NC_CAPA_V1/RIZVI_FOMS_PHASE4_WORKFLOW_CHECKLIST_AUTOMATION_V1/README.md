# RIZVI FOMS — Phase 4 Workflow, Checklist & Automation

## Actual Phase 4 deliverables
- PostgreSQL migration: `database/004_workflow_checklist_automation.sql`
- Workflow engine rules
- Automation worker contract
- Checklist/evidence completion gate
- Recurring frequency logic
- Automated tests

Supported recurring frequencies:
HOURLY, DAILY, WEEKLY, MONTHLY, QUARTERLY, HALF_YEARLY, ANNUAL, AD_HOC.

Production automation requires deployment of the worker against the configured PostgreSQL/event infrastructure.
