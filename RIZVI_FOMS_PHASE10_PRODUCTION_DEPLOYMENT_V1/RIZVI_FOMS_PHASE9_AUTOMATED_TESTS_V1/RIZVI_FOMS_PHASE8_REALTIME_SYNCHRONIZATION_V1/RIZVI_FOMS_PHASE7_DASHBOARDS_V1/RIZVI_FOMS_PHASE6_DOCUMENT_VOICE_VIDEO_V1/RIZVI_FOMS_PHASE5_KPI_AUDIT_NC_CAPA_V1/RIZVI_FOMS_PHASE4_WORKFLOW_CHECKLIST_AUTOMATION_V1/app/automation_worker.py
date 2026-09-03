# Worker contract for scheduled automation.
# Production deployment should run this in a separate worker process.
from datetime import datetime
from .workflow_engine import next_occurrence

def run_due_rules(db, now=None):
    now=now or datetime.utcnow()
    # Select enabled rules where next_run_at <= now.
    # Create work items/events transactionally, then calculate next_run_at.
    # Actual database orchestration belongs to the deployment worker.
    return {"checked_at":now.isoformat(),"status":"worker-contract-ready"}
