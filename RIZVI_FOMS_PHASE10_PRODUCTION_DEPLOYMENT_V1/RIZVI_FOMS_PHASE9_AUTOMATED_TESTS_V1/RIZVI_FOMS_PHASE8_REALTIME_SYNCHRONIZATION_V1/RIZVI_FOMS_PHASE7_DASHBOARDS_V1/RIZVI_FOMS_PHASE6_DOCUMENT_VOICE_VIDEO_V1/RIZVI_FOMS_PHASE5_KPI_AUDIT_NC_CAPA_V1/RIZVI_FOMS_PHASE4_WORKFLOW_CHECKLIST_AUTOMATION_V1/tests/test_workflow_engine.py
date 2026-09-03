from datetime import datetime,timedelta
from app.workflow_engine import validate_frequency,next_occurrence,completion_allowed,overdue
def test_hourly():
    x=datetime(2026,8,30,10,0)
    assert next_occurrence('HOURLY',x)==datetime(2026,8,30,11,0)
def test_frequency():
    assert validate_frequency('daily')=='DAILY'
def test_evidence_gate():
    assert not completion_allowed([{'status':'DONE','evidence_required':True,'has_evidence':False}])
    assert completion_allowed([{'status':'DONE','evidence_required':True,'has_evidence':True}])
def test_overdue():
    assert overdue(datetime.utcnow()-timedelta(seconds=1),datetime.utcnow())
