import pytest

@pytest.mark.unit
def test_supported_recurring_frequencies():
    from app.workflow_engine import VALID_FREQUENCIES
    assert {'HOURLY','DAILY','WEEKLY','MONTHLY','QUARTERLY'} <= VALID_FREQUENCIES

@pytest.mark.unit
def test_capa_invalid_close_transition():
    from app.quality_engine import transition_capa
    with pytest.raises(ValueError):
        transition_capa('OPEN','CLOSED')

@pytest.mark.security
def test_rbac_denies_missing_permission():
    from app.rbac import authorize
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        authorize('management:read', set())
    assert exc.value.status_code == 403

@pytest.mark.contract
def test_realtime_event_contract():
    from app.realtime import event_envelope
    event=event_envelope('work_item.changed','work_item','123',{'status':'DONE'})
    assert set(['event_type','aggregate_type','aggregate_id','payload','occurred_at']) <= set(event)

@pytest.mark.unit
def test_media_voice_video_document_classification():
    from app.media_security import classify_asset
    assert classify_asset('audio/mpeg','a.mp3') == 'VOICE'
    assert classify_asset('video/mp4','a.mp4') == 'VIDEO'
    assert classify_asset('application/pdf','a.pdf') == 'DOCUMENT'
