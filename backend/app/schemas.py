from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class ComponentIn(BaseModel):
    name: str
    description: Optional[str] = None


class ComponentOut(ComponentIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class MachineIn(BaseModel):
    machine_code: str
    name: str
    category: Optional[str] = None
    manufacturer: Optional[str] = None
    model_number: Optional[str] = None
    installation_date: Optional[datetime] = None
    location: Optional[str] = None
    department: Optional[str] = None
    operating_hours: float = 0
    criticality: str = "medium"
    maintenance_interval_hours: float = 500


class MachineUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    department: Optional[str] = None
    operating_hours: Optional[float] = None
    criticality: Optional[str] = None
    maintenance_interval_hours: Optional[float] = None
    health_score: Optional[int] = None
    status: Optional[str] = None


class MachineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    machine_code: str
    name: str
    category: Optional[str]
    manufacturer: Optional[str]
    model_number: Optional[str]
    location: Optional[str]
    department: Optional[str]
    operating_hours: float
    criticality: str
    health_score: int
    status: str
    maintenance_interval_hours: float
    last_maintenance_date: Optional[datetime]
    next_maintenance_date: Optional[datetime]


class SensorReadingIn(BaseModel):
    reading_type: str
    value: float
    unit: Optional[str] = None
    source: str = "manual"


class SensorReadingOut(SensorReadingIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    machine_id: int
    recorded_at: datetime


class MaintenanceRecordIn(BaseModel):
    type: str
    description: Optional[str] = None
    scheduled_date: Optional[datetime] = None
    performed_by: Optional[str] = None
    notes: Optional[str] = None


class MaintenanceRecordOut(MaintenanceRecordIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    machine_id: int
    status: str
    completed_date: Optional[datetime]


class WorkOrderIn(BaseModel):
    machine_id: int
    problem: str
    priority: str = "medium"
    recommended_actions: Optional[str] = None
    assigned_to: Optional[str] = None


class WorkOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    machine_id: int
    problem: str
    priority: str
    status: str
    recommended_actions: Optional[str]
    assigned_to: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]
    resolution_notes: Optional[str]


class WorkOrderUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    resolution_notes: Optional[str] = None


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    machine_id: int
    alert_type: str
    severity: str
    message: str
    created_at: datetime
    acknowledged: bool
    resolved: bool


class SparePartIn(BaseModel):
    name: str
    part_number: str
    quantity: int = 0
    minimum_stock: int = 1
    compatible_machine_categories: Optional[str] = None


class SparePartOut(SparePartIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    last_used_date: Optional[datetime]


class DiagnoseRequest(BaseModel):
    machine_id: Optional[int] = None
    problem_description: str
    answers: Optional[List[str]] = None
    use_online_ai: bool = False


class PossibleCause(BaseModel):
    cause: str
    confidence: int
    certainty: str  # confirmed | likely | possible | insufficient_information


class DiagnoseResponse(BaseModel):
    session_id: Optional[int] = None
    safety_notice: str
    clarifying_questions: List[str] = []
    possible_causes: List[PossibleCause] = []
    recommended_procedure: List[str] = []
    source: str  # offline | gemini
    needs_more_info: bool = False


class DashboardSummary(BaseModel):
    total_machines: int
    healthy: int
    attention: int
    critical: int
    open_work_orders: int
    upcoming_maintenance: int
    active_alerts: int
