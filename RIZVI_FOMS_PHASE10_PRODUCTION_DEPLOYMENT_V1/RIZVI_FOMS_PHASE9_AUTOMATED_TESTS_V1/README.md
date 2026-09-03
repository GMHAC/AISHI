# RIZVI FOMS — Phase 9: Automated Tests

## Added in Phase 9
- Central pytest configuration
- Cross-phase contract tests
- Workflow automation test matrix
- KPI and audit test matrix
- CAPA closure tests
- RBAC denial test
- Media classification tests
- Real-time event/idempotency tests
- Test runner script
- CI shell test command
- Production test strategy

## Run
```bash
python -m pip install -r requirements.txt
python -m pytest tests --strict-markers
```

## Scope
The test suite verifies executable business-rule modules included in this package.
External end-to-end validation requires the real production infrastructure.
