from datetime import datetime, timedelta
from uuid import uuid4

VALID_FREQUENCIES={'HOURLY','DAILY','WEEKLY','MONTHLY','QUARTERLY','HALF_YEARLY','ANNUAL','AD_HOC'}

def next_occurrence(frequency:str, current:datetime)->datetime|None:
    if frequency=='HOURLY': return current+timedelta(hours=1)
    if frequency=='DAILY': return current+timedelta(days=1)
    if frequency=='WEEKLY': return current+timedelta(days=7)
    if frequency=='MONTHLY': return current+timedelta(days=30)
    if frequency=='QUARTERLY': return current+timedelta(days=91)
    if frequency=='HALF_YEARLY': return current+timedelta(days=182)
    if frequency=='ANNUAL': return current+timedelta(days=365)
    return None

def validate_frequency(frequency:str)->str:
    f=frequency.upper()
    if f not in VALID_FREQUENCIES: raise ValueError('Unsupported frequency')
    return f

def completion_allowed(items:list[dict])->bool:
    for item in items:
        if item.get('status') not in {'DONE','NOT_APPLICABLE'}: return False
        if item.get('evidence_required') and not item.get('has_evidence'): return False
    return True

def overdue(due_at:datetime|None, now:datetime)->bool:
    return bool(due_at and due_at < now)
