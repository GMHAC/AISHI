from app.realtime import IdempotencyStore,event_envelope

def test_duplicate_event_is_processed_once_per_consumer():
    store=IdempotencyStore()
    assert store.accept_once('dashboard','event-1')
    assert not store.accept_once('dashboard','event-1')
    assert store.accept_once('audit-read-model','event-1')

def test_event_payload_preserved():
    payload={'status':'OVERDUE','scope':'SECTION'}
    event=event_envelope('work_item.changed','work_item','1',payload)
    assert event['payload']==payload
