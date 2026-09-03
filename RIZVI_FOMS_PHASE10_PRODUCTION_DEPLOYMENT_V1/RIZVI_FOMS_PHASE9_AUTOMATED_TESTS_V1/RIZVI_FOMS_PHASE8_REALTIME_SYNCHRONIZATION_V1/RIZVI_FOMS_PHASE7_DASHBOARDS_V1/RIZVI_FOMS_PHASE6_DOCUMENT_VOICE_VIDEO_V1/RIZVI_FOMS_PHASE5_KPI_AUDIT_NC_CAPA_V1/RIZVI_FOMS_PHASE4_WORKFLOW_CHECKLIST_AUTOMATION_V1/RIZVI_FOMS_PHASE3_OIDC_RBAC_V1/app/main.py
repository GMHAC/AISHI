from fastapi import FastAPI,Depends
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel
from .database import Base,engine,get_db
from .models import Employee,Role,Permission,EmployeeRole,RolePermission
from .security import verify_oidc_bearer
from .rbac import permissions_for_subject,require_permission

app=FastAPI(title="RIZVI FOMS Phase 3 OAuth/OIDC + RBAC")

@app.on_event("startup")
def startup(): Base.metadata.create_all(engine)

class EmployeeIn(BaseModel):
    official_id:str
    full_name:str
    mobile:str|None=None
    oidc_subject:str|None=None
class RoleIn(BaseModel): code:str; name:str
class PermissionIn(BaseModel): module:str; action:str

@app.get("/health")
def health(): return {"status":"ok","auth":"oidc-bearer","rbac":"server-side"}

@app.post("/admin/employees")
def create_employee(x:EmployeeIn,db:Session=Depends(get_db)):
    e=Employee(**x.model_dump());db.add(e);db.commit();db.refresh(e);return {"id":e.id,"official_id":e.official_id}

@app.post("/admin/roles")
def create_role(x:RoleIn,db:Session=Depends(get_db)):
    r=Role(**x.model_dump());db.add(r);db.commit();db.refresh(r);return {"id":r.id,"code":r.code}

@app.post("/admin/permissions")
def create_permission(x:PermissionIn,db:Session=Depends(get_db)):
    p=Permission(**x.model_dump());db.add(p);db.commit();db.refresh(p);return {"id":p.id,"permission":f"{p.module}:{p.action}"}

@app.post("/admin/employees/{employee_id}/roles/{role_id}")
def grant_role(employee_id:int,role_id:int,db:Session=Depends(get_db)):
    db.add(EmployeeRole(employee_id=employee_id,role_id=role_id));db.commit();return {"granted":True}

@app.post("/admin/roles/{role_id}/permissions/{permission_id}")
def grant_permission(role_id:int,permission_id:int,db:Session=Depends(get_db)):
    db.add(RolePermission(role_id=role_id,permission_id=permission_id));db.commit();return {"granted":True}

@app.get("/auth/me")
def me(claims=Depends(verify_oidc_bearer),db:Session=Depends(get_db)):
    return {"subject":claims["sub"],"permissions":sorted(permissions_for_subject(claims["sub"],db))}

@app.get("/secure/management")
def management(claims=Depends(require_permission("management","read"))):
    return {"message":"Management dashboard access granted","subject":claims["sub"]}
