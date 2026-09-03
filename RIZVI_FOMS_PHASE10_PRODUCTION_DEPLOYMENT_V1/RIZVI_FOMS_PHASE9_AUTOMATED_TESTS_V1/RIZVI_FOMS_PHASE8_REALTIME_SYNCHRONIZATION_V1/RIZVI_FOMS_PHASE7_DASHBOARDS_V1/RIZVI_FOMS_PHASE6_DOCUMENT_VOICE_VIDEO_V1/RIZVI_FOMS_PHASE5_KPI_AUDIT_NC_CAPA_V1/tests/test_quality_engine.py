import pytest
from app.quality_engine import evaluate_kpi,transition_capa,can_close_capa
from app.audit_engine import nc_required_from_finding
def test_kpi(): assert evaluate_kpi(95,90,">=")
def test_kpi_fail(): assert not evaluate_kpi(85,90,">=")
def test_capa_transition(): assert transition_capa("OPEN","INVESTIGATION")=="INVESTIGATION"
def test_invalid_transition():
    with pytest.raises(ValueError): transition_capa("OPEN","CLOSED")
def test_closure_gate():
    assert can_close_capa("Effective",123)
    assert not can_close_capa("",123)
def test_nc_rule(): assert nc_required_from_finding("MAJOR_NC")
