from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal

class InvoiceItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product_id: UUID
    description_snapshot: str
    quantity: int
    unit_price: Decimal
    discount_amount: Decimal
    tax_rate_percent: Decimal
    tax_amount: Decimal
    line_total: Decimal

class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    invoice_number: str
    customer_id: UUID
    subscription_id: UUID
    billing_period_start: date
    billing_period_end: date
    issue_date: date
    due_date: date
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    grand_total: Decimal
    amount_paid: Decimal
    balance_due: Decimal
    status: str
    sent_at: Optional[datetime]
    created_at: datetime
    is_overdue: bool = False
    items: List[InvoiceItemResponse] = []

class PaginatedInvoices(BaseModel):
    items: List[InvoiceResponse]
    total: int
    page: int
    page_size: int

class BulkConfirmRequest(BaseModel):
    ids: Optional[List[UUID]] = None
    all_drafts: bool = False
    limit: Optional[int] = Field(None, ge=1, le=500)

class PaymentCreate(BaseModel):
    invoice_id: UUID
    amount: Decimal = Field(..., gt=0)
    method: str = Field(..., pattern="^(cash|upi|card|bank_transfer|gateway|other)$")
    idempotency_key: Optional[str] = None
    payment_reference: Optional[str] = None
    payment_date: Optional[date] = None
    note: Optional[str] = Field(None, max_length=1000)

class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    invoice_id: UUID
    idempotency_key: Optional[str]
    payment_reference: Optional[str]
    method: str
    amount: Decimal
    payment_date: date
    note: Optional[str]
    recorded_by: Optional[UUID]
    created_at: datetime

class PaginatedPayments(BaseModel):
    items: List[PaymentResponse]
    total: int
    page: int
    page_size: int
