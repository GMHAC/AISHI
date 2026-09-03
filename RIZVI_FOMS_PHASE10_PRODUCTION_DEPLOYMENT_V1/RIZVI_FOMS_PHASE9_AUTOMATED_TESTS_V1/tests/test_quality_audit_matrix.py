import pytest
from app.quality_engine import evaluate_kpi, can_close_capa
from app.audit_engine import validate_finding_classification, nc_required_from_finding

@pytest.mark.parametrize('actual,target,op,expected',[
    (100,90,'>=',True),(80,90,'>=',False),
    (80,90,'<=',True),(100,90,'<=',False),
    (90,90,'=',True)
])
def test_kpi_matrix(actual,target,op,expected):
    assert evaluate_kpi(actual,target,op) is expected

@pytest.mark.parametrize('kind,required',[
    ('OBSERVATION',False),('OPPORTUNITY',False),
    ('MINOR_NC',True),('MAJOR_NC',True)
])
def test_audit_nc_rule(kind,required):
    assert nc_required_from_finding(kind) is required

def test_invalid_finding_classification():
    with pytest.raises(ValueError):
        validate_finding_classification('UNKNOWN')

def test_capa_closure_gate():
    assert can_close_capa('Effective',1)
    assert not can_close_capa('',1)
    assert not can_close_capa('Effective',None)
