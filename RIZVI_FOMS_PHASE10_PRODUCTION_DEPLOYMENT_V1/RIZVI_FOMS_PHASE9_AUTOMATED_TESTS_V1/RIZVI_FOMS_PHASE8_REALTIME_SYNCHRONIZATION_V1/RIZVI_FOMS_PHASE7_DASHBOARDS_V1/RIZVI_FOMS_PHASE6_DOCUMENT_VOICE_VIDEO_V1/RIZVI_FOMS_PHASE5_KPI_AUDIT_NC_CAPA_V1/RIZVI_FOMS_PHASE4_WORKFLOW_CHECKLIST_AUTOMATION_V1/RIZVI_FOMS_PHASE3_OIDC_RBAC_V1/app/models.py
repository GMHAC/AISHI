from sqlalchemy import String,Integer,ForeignKey,Boolean,UniqueConstraint
from sqlalchemy.orm import Mapped,mapped_column
from .database import Base

class Employee(Base):
    __tablename__="employees"
    id:Mapped[int]=mapped_column(Integer,primary_key=True)
    official_id:Mapped[str]=mapped_column(String(100),unique=True,index=True)
    mobile:Mapped[str|None]=mapped_column(String(30),unique=True,nullable=True,index=True)
    full_name:Mapped[str]=mapped_column(String(200))
    oidc_subject:Mapped[str|None]=mapped_column(String(255),unique=True,nullable=True)
    active:Mapped[bool]=mapped_column(Boolean,default=True)

class Role(Base):
    __tablename__="roles"
    id:Mapped[int]=mapped_column(Integer,primary_key=True)
    code:Mapped[str]=mapped_column(String(100),unique=True)
    name:Mapped[str]=mapped_column(String(200))

class Permission(Base):
    __tablename__="permissions"
    id:Mapped[int]=mapped_column(Integer,primary_key=True)
    module:Mapped[str]=mapped_column(String(100))
    action:Mapped[str]=mapped_column(String(50))
    __table_args__=(UniqueConstraint("module","action",name="uq_permission"),)

class EmployeeRole(Base):
    __tablename__="employee_roles"
    employee_id:Mapped[int]=mapped_column(ForeignKey("employees.id"),primary_key=True)
    role_id:Mapped[int]=mapped_column(ForeignKey("roles.id"),primary_key=True)

class RolePermission(Base):
    __tablename__="role_permissions"
    role_id:Mapped[int]=mapped_column(ForeignKey("roles.id"),primary_key=True)
    permission_id:Mapped[int]=mapped_column(ForeignKey("permissions.id"),primary_key=True)
