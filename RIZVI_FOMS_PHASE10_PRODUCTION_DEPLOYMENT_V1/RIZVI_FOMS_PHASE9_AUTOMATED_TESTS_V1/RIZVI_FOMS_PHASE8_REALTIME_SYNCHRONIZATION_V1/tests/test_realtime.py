from app.realtime import event_envelope,IdempotencyStore
def test_event_envelope():
    e=event_envelope('work_item.changed','work_item','123',{'status':'DONE'})
    assert e['event_type']=='work_item.changed'
    assert e['payload']['status']=='DONE'
def test_idempotency():
    s=IdempotencyStore()
    assert s.accept_once('dashboard','abc')
    assert not s.accept_once('dashboard','abc')
    assert s.accept_once('another','abc')
