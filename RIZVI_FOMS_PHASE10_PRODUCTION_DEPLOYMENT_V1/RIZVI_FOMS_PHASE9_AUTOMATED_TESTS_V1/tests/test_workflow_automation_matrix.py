import pytest
from datetime import datetime
from app.workflow_engine import next_occurrence, completion_allowed

@pytest.mark.parametrize('frequency',[
    'HOURLY','DAILY','WEEKLY','MONTHLY','QUARTERLY',
    'HALF_YEARLY','ANNUAL','AD_HOC'
])
def test_frequency_handling(frequency):
    value=next_occurrence(frequency, datetime(2026,1,1))
    if frequency=='AD_HOC': assert value is None
    else: assert value is not None

def test_checklist_cannot_complete_without_required_evidence():
    assert completion_allowed([{'status':'DONE','evidence_required':False,'has_evidence':False}])
    assert not completion_allowed([{'status':'DONE','evidence_required':True,'has_evidence':False}])
