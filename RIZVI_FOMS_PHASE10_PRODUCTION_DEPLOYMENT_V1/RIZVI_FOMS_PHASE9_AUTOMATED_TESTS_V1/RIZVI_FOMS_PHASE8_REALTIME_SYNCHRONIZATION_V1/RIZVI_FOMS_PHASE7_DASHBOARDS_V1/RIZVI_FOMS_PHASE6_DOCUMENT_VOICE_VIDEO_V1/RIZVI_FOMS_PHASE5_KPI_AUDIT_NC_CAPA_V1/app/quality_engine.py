from decimal import Decimal

def evaluate_kpi(actual, target, operator='>='):
    a, t = Decimal(str(actual)), Decimal(str(target))
    if operator == '>=': return a >= t
    if operator == '<=': return a <= t
    if operator == '>': return a > t
    if operator == '<': return a < t
    if operator == '=': return a == t
    raise ValueError('Unsupported KPI operator')

CAPA_ALLOWED={
    'OPEN': {'INVESTIGATION','REJECTED'},
    'INVESTIGATION': {'ACTION','REJECTED'},
    'ACTION': {'IMPLEMENTED'},
    'IMPLEMENTED': {'EFFECTIVENESS_REVIEW'},
    'EFFECTIVENESS_REVIEW': {'CLOSED','ACTION'},
    'CLOSED': set(),
    'REJECTED': set()
}

def transition_capa(current, target):
    current=current.upper(); target=target.upper()
    if target not in CAPA_ALLOWED.get(current,set()):
        raise ValueError(f'Invalid CAPA transition: {current} -> {target}')
    return target

def can_close_capa(effectiveness_result, verified_by):
    return bool(effectiveness_result and verified_by)
