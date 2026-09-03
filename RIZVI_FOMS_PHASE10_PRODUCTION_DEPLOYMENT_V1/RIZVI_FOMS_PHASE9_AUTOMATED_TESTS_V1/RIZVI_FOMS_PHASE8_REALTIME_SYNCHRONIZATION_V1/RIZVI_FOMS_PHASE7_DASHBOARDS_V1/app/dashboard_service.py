from datetime import datetime

REFRESH_SECONDS=3

def dashboard_refresh_contract():
    return {
        'refresh_seconds': REFRESH_SECONDS,
        'transport': 'WebSocket/SSE recommended',
        'fallback': 'client polling',
        'server_generated_at': datetime.utcnow().isoformat()
    }

def status_bucket(status):
    s=(status or '').upper()
    if s in {'APPROVED','DONE','CLOSED','COMPLETED'}: return 'completed'
    if s in {'OVERDUE','FAILED','REJECTED'}: return 'attention'
    if s in {'OPEN','IN_PROGRESS','SUBMITTED','PENDING'}: return 'active'
    return 'other'

def summarize_status(rows):
    result={'total':0,'completed':0,'attention':0,'active':0,'other':0}
    for row in rows:
        result['total']+=1
        result[status_bucket(row.get('status'))]+=1
    return result
