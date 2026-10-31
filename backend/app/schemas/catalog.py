from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import date, datetime
from decimal import Decimal

# Base config
class SchemaBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

# 1. Tax Rules
class TaxRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    rate_percent: Decimal = Field(..., ge=0, le=100)
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    description: Optional[str] = Field(None, max_length=255)

class TaxRuleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    rate_percent: Optional[Decimal] = Field(None, ge=0, le=100)
    valid_from: Optional[date] = None
    valid_until: Optional[date] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class TaxRuleResponse(SchemaBase):
    id: UUID
    name: str
    rate_percent: Decimal
    is_active: bool
    valid_from: Optional[date]
    valid_until: Optional[date]
    description: Optional[str]

# 2. Product Variants
class ProductVariantCreate(BaseModel):
    variant_name: str = Field(..., min_length=1, max_length=100)
    additional_price: Decimal = Field(Decimal("0.00"), ge=0)

class ProductVariantUpdate(BaseModel):
    variant_name: Optional[str] = Field(None, min_length=1, max_length=100)
    additional_price: Optional[Decimal] = Field(None, ge=0)
    is_active: Optional[bool] = None

class ProductVariantResponse(SchemaBase):
    id: UUID
    product_id: UUID
    variant_name: str
    additional_price: Decimal
    is_active: bool

# 3. Products
class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    product_type: str = Field(..., min_length=1, max_length=50)
    sales_price: Decimal = Field(..., ge=0)
    cost_price: Decimal = Field(..., ge=0)
    notes: Optional[str] = Field(None, max_length=1000)
    default_tax_rule_id: Optional[UUID] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    product_type: Optional[str] = Field(None, min_length=1, max_length=50)
    sales_price: Optional[Decimal] = Field(None, ge=0)
    cost_price: Optional[Decimal] = Field(None, ge=0)
    notes: Optional[str] = None
    default_tax_rule_id: Optional[UUID] = None
    is_active: Optional[bool] = None

class ProductResponse(SchemaBase):
    id: UUID
    name: str
    product_type: str
    sales_price: Decimal
    cost_price: Decimal
    notes: Optional[str]
    default_tax_rule_id: Optional[UUID]
    is_active: bool
    variants: List[ProductVariantResponse] = []

# 4. Plans
class PlanCreate(BaseModel):
    product_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    price: Decimal = Field(..., ge=0)
    billing_cycle: str = Field(..., pattern="^(daily|weekly|monthly|yearly)$")
    minimum_quantity: int = Field(1, ge=1)
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    allow_pause: bool = True
    allow_early_close: bool = True
    allow_renewal: bool = True
    auto_close_on_end: bool = False

class PlanUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    price: Optional[Decimal] = Field(None, ge=0)
    billing_cycle: Optional[str] = Field(None, pattern="^(daily|weekly|monthly|yearly)$")
    minimum_quantity: Optional[int] = Field(None, ge=1)
    available_from: Optional[date] = None
    available_until: Optional[date] = None
    allow_pause: Optional[bool] = None
    allow_early_close: Optional[bool] = None
    allow_renewal: Optional[bool] = None
    auto_close_on_end: Optional[bool] = None
    is_active: Optional[bool] = None

class PlanResponse(SchemaBase):
    id: UUID
    product_id: UUID
    name: str
    price: Decimal
    billing_cycle: str
    minimum_quantity: int
    available_from: Optional[date]
    available_until: Optional[date]
    allow_pause: bool
    allow_early_close: bool
    allow_renewal: bool
    auto_close_on_end: bool
    is_active: bool

# 5. Discounts
class DiscountCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    discount_type: str = Field(..., pattern="^(fixed|percentage)$")
    value: Decimal = Field(..., ge=0)
    minimum_purchase: Optional[Decimal] = Field(None, ge=0)
    minimum_quantity: Optional[int] = Field(None, ge=1)
    starts_on: Optional[date] = None
    ends_on: Optional[date] = None
    usage_limit: Optional[int] = Field(None, ge=1)
    scope: str = Field(..., pattern="^(products|subscription)$")
    product_ids: Optional[List[UUID]] = None

class DiscountUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    discount_type: Optional[str] = Field(None, pattern="^(fixed|percentage)$")
    value: Optional[Decimal] = Field(None, ge=0)
    minimum_purchase: Optional[Decimal] = Field(None, ge=0)
    minimum_quantity: Optional[int] = Field(None, ge=1)
    starts_on: Optional[date] = None
    ends_on: Optional[date] = None
    usage_limit: Optional[int] = Field(None, ge=1)
    scope: Optional[str] = Field(None, pattern="^(products|subscription)$")
    product_ids: Optional[List[UUID]] = None
    is_active: Optional[bool] = None

class DiscountResponse(SchemaBase):
    id: UUID
    name: str
    discount_type: str
    value: Decimal
    minimum_purchase: Optional[Decimal]
    minimum_quantity: Optional[int]
    starts_on: Optional[date]
    ends_on: Optional[date]
    usage_limit: Optional[int]
    usage_count: int
    scope: str
    is_active: bool

# 6. Quotation Templates
class QuotationTemplateLineCreate(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    quantity: int = Field(1, ge=1)
    tax_rule_id: Optional[UUID] = None

class QuotationTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    plan_id: UUID
    validity_days: int = Field(30, ge=1)
    payment_terms_days: int = Field(15, ge=0)
    description: Optional[str] = None
    lines: List[QuotationTemplateLineCreate] = []

class QuotationTemplateLineResponse(SchemaBase):
    id: UUID
    product_id: UUID
    variant_id: Optional[UUID]
    quantity: int
    tax_rule_id: Optional[UUID]

class QuotationTemplateResponse(SchemaBase):
    id: UUID
    name: str
    plan_id: UUID
    validity_days: int
    payment_terms_days: int
    description: Optional[str]
    is_active: bool
    lines: List[QuotationTemplateLineResponse] = []

# 7. Quotations
class QuotationFromTemplateRequest(BaseModel):
    template_id: UUID
    customer_id: UUID

class QuotationItemResponse(SchemaBase):
    id: UUID
    product_id: UUID
    variant_id: Optional[UUID]
    description_snapshot: str
    quantity: int
    unit_price: Decimal
    tax_rule_id: Optional[UUID]
    line_total: Decimal

class QuotationResponse(SchemaBase):
    id: UUID
    quotation_number: str
    customer_id: UUID
    template_id: Optional[UUID]
    plan_id: UUID
    issue_date: date
    valid_until: Optional[date]
    status: str
    subtotal: Decimal
    tax_total: Decimal
    grand_total: Decimal
    payment_terms_days: int
    items: List[QuotationItemResponse] = []

class ConvertBody(BaseModel):
    start_date: Optional[date] = None
    expiry_date: Optional[date] = None

# 8. Subscriptions
class SubscriptionItemCreate(BaseModel):
    product_id: UUID
    variant_id: Optional[UUID] = None
    quantity: int = Field(1, ge=1)
    unit_price: Optional[Decimal] = None
    tax_rule_id: Optional[UUID] = None

class SubscriptionCreate(BaseModel):
    customer_id: UUID
    plan_id: UUID
    start_date: Optional[date] = None
    expiry_date: Optional[date] = None
    payment_terms_days: int = Field(15, ge=0)
    auto_renew: bool = False
    items: List[SubscriptionItemCreate] = []

class SubscriptionStatusHistoryResponse(SchemaBase):
    id: UUID
    from_status: Optional[str]
    to_status: str
    changed_by: Optional[UUID]
    changed_at: datetime
    note: Optional[str]

class SubscriptionItemResponse(SchemaBase):
    id: UUID
    product_id: UUID
    variant_id: Optional[UUID]
    description_snapshot: str
    quantity: int
    unit_price: Decimal
    tax_rule_id: Optional[UUID]

class SubscriptionResponse(SchemaBase):
    id: UUID
    subscription_number: str
    customer_id: UUID
    plan_id: UUID
    quotation_id: Optional[UUID] = None
    status: str
    start_date: date
    expiry_date: Optional[date] = None
    current_period_start: Optional[date] = None
    current_period_end: Optional[date] = None
    next_billing_date: Optional[date] = None
    payment_terms_days: int = 15
    auto_renew: bool = False
    closed_reason: Optional[str] = None
    items: List[SubscriptionItemResponse] = []
    history: List[SubscriptionStatusHistoryResponse] = []

class PaginatedSubscriptions(BaseModel):
    items: List[SubscriptionResponse]
    total: int
    page: int
    page_size: int
