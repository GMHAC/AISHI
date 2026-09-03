VALID_FINDING_CLASSES={'OBSERVATION','MINOR_NC','MAJOR_NC','OPPORTUNITY'}
def validate_finding_classification(value):
    v=value.upper()
    if v not in VALID_FINDING_CLASSES: raise ValueError('Invalid finding classification')
    return v
def nc_required_from_finding(classification):
    return classification.upper() in {'MINOR_NC','MAJOR_NC'}
