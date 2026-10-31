"""Pydantic schemas for report endpoints (spec section 15)."""

from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal


# ---------- Overview ----------

class AdminOverviewResponse(BaseModel):
    """Full dashboard overview returned to admin users."""
    active_subscriptions: int
    mrr: Decimal
    revenue_collected: Decimal
    outstanding: Decimal
    overdue_count: int
    overdue_amount: Decimal
    new_customers: int
    renewals_due_7_days: int


class StaffOverviewResponse(BaseModel):
    """Limited dashboard overview returned to staff users."""
    active_subscriptions: int
    draft_invoice_count: int
    overdue_count: int


# ---------- Revenue ----------

class RevenueRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    invoice_id: UUID
    method: str
    amount: Decimal
    payment_date: date
    payment_reference: Optional[str] = None
    recorded_by: Optional[UUID] = None
    created_at: datetime


class PaginatedRevenue(BaseModel):
    items: List[RevenueRecord]
    total: int
    page: int
    page_size: int


# ---------- Subscriptions report ----------

class SubscriptionReportRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    subscription_number: str
    customer_id: UUID
    plan_id: UUID
    status: str
    start_date: date
    expiry_date: Optional[date] = None
    next_billing_date: Optional[date] = None
    auto_renew: bool
    created_at: datetime


class PaginatedSubscriptionReport(BaseModel):
    items: List[SubscriptionReportRecord]
    total: int
    page: int
    page_size: int


# ---------- Overdue ----------

class OverdueRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    invoice_number: str
    customer_id: UUID
    subscription_id: UUID
    due_date: date
    grand_total: Decimal
    balance_due: Decimal
    days_overdue: int
    bucket: str


class PaginatedOverdue(BaseModel):
    items: List[OverdueRecord]
    total: int
    page: int
    page_size: int


# ---------- Payments report ----------

class PaymentReportRecord(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    invoice_id: UUID
    idempotency_key: Optional[str] = None
    payment_reference: Optional[str] = None
    method: str
    amount: Decimal
    payment_date: date
    note: Optional[str] = None
    recorded_by: Optional[UUID] = None
    created_at: datetime


class PaginatedPaymentReport(BaseModel):
    items: List[PaymentReportRecord]
    total: int
    page: int
    page_size: int


# ---------- Portal ----------

class PortalPlanResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    name: str
    price: Decimal
    billing_cycle: str
    minimum_quantity: int
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    allow_pause: bool
    allow_early_close: bool
    allow_renewal: bool


class PortalProfileResponse(BaseModel):
    """Customer profile with related user info."""
    customer_id: UUID
    company_name: str
    phone: Optional[str] = None
    billing_address: Optional[str] = None
    tax_identifier: Optional[str] = None
    user_id: Optional[UUID] = None
    email: Optional[str] = None
    full_name: Optional[str] = None
    created_at: datetime
