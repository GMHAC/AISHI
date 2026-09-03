from fastapi import HTTPException
def authorize(required_permission, granted_permissions):
    if required_permission not in granted_permissions:
        raise HTTPException(403,"Permission denied")
    return True
