import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Date,
    Numeric,
    Integer,
    BigInteger,
    ForeignKey,
    CheckConstraint,
    Index,
    text,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

# 1. users
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    full_name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow, server_default=text("now()"))

    customer = relationship("Customer", back_populates="user", uselist=False)

    __table_args__ = (
        CheckConstraint("role IN ('admin', 'staff', 'customer')", name="ck_users_role"),
    )

# 2. customers
class Customer(Base):
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), unique=True, nullable=True)
    company_name = Column(String(255), nullable=False)
    phone = Column(String(50), nullable=True)
    billing_address = Column(String(500), nullable=True)
    tax_identifier = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, server_default=text("now()"))

    user = relationship("User", back_populates="customer")
    subscriptions = relationship("Subscription", back_populates="customer")
    quotations = relationship("Quotation", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")

# 3. tax_rules
class TaxRule(Base):
    __tablename__ = "tax_rules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    name = Column(String(100), nullable=False)
    rate_percent = Column(Numeric(12, 2), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    valid_from = Column(Date, nullable=True)
    valid_until = Column(Date, nullable=True)
    description = Column(String(255), nullable=True)

    __table_args__ = (
        CheckConstraint("rate_percent >= 0 AND rate_percent <= 100", name="ck_tax_rules_rate_percent"),
    )

# 4. products
class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    name = Column(String(255), nullable=False)
    product_type = Column(String(50), nullable=False)
    sales_price = Column(Numeric(12, 2), nullable=False)
    cost_price = Column(Numeric(12, 2), nullable=False)
    notes = Column(String(1000), nullable=True)
    default_tax_rule_id = Column(UUID(as_uuid=True), ForeignKey("tax_rules.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))

    default_tax_rule = relationship("TaxRule")
    variants = relationship("ProductVariant", back_populates="product")
    plans = relationship("Plan", back_populates="product")

    __table_args__ = (
        CheckConstraint("sales_price >= 0", name="ck_products_sales_price"),
        CheckConstraint("cost_price >= 0", name="ck_products_cost_price"),
    )

# 5. product_variants
class ProductVariant(Base):
    __tablename__ = "product_variants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    variant_name = Column(String(100), nullable=False)
    additional_price = Column(Numeric(12, 2), nullable=False, default=0.00, server_default=text("0.00"))
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))

    product = relationship("Product", back_populates="variants")

    __table_args__ = (
        CheckConstraint("additional_price >= 0", name="ck_product_variants_additional_price"),
    )

# 6. plans
class Plan(Base):
    __tablename__ = "plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    name = Column(String(255), nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    billing_cycle = Column(String(50), nullable=False)
    minimum_quantity = Column(Integer, nullable=False, default=1, server_default=text("1"))
    available_from = Column(Date, nullable=True)
    available_until = Column(Date, nullable=True)
    allow_pause = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    allow_early_close = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    allow_renewal = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    auto_close_on_end = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))

    product = relationship("Product", back_populates="plans")

    __table_args__ = (
        CheckConstraint("price >= 0", name="ck_plans_price"),
        CheckConstraint("minimum_quantity >= 1", name="ck_plans_minimum_quantity"),
        CheckConstraint("billing_cycle IN ('daily', 'weekly', 'monthly', 'yearly')", name="ck_plans_billing_cycle"),
    )

# 7. quotation_templates
class QuotationTemplate(Base):
    __tablename__ = "quotation_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    name = Column(String(255), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False)
    validity_days = Column(Integer, nullable=False, default=30, server_default=text("30"))
    payment_terms_days = Column(Integer, nullable=False, default=15, server_default=text("15"))
    description = Column(String(1000), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))

    plan = relationship("Plan")
    lines = relationship("QuotationTemplateLine", back_populates="template")

# 8. quotation_template_lines
class QuotationTemplateLine(Base):
    __tablename__ = "quotation_template_lines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    template_id = Column(UUID(as_uuid=True), ForeignKey("quotation_templates.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Integer, nullable=False, default=1, server_default=text("1"))
    tax_rule_id = Column(UUID(as_uuid=True), ForeignKey("tax_rules.id", ondelete="SET NULL"), nullable=True)

    template = relationship("QuotationTemplate", back_populates="lines")
    product = relationship("Product")
    variant = relationship("ProductVariant")
    tax_rule = relationship("TaxRule")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_quotation_template_lines_quantity"),
    )

# 9. quotations
class Quotation(Base):
    __tablename__ = "quotations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    quotation_number = Column(String(100), unique=True, nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("quotation_templates.id", ondelete="SET NULL"), nullable=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False)
    issue_date = Column(Date, nullable=False)
    valid_until = Column(Date, nullable=True)
    status = Column(String(50), nullable=False, default="draft", server_default=text("'draft'"))
    subtotal = Column(Numeric(12, 2), nullable=False, default=0.00, server_default=text("0.00"))
    tax_total = Column(Numeric(12, 2), nullable=False, default=0.00, server_default=text("0.00"))
    grand_total = Column(Numeric(12, 2), nullable=False, default=0.00, server_default=text("0.00"))
    payment_terms_days = Column(Integer, nullable=False, default=15, server_default=text("15"))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    customer = relationship("Customer", back_populates="quotations")
    plan = relationship("Plan")
    items = relationship("QuotationItem", back_populates="quotation")

    __table_args__ = (
        CheckConstraint("status IN ('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted')", name="ck_quotations_status"),
        CheckConstraint("subtotal >= 0", name="ck_quotations_subtotal"),
        CheckConstraint("tax_total >= 0", name="ck_quotations_tax_total"),
        CheckConstraint("grand_total >= 0", name="ck_quotations_grand_total"),
    )

# 10. quotation_items
class QuotationItem(Base):
    __tablename__ = "quotation_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    quotation_id = Column(UUID(as_uuid=True), ForeignKey("quotations.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)
    description_snapshot = Column(String(500), nullable=False)
    quantity = Column(Integer, nullable=False, default=1, server_default=text("1"))
    unit_price = Column(Numeric(12, 2), nullable=False)
    tax_rule_id = Column(UUID(as_uuid=True), ForeignKey("tax_rules.id", ondelete="SET NULL"), nullable=True)
    line_total = Column(Numeric(12, 2), nullable=False)

    quotation = relationship("Quotation", back_populates="items")
    product = relationship("Product")
    variant = relationship("ProductVariant")
    tax_rule = relationship("TaxRule")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_quotation_items_quantity"),
        CheckConstraint("unit_price >= 0", name="ck_quotation_items_unit_price"),
        CheckConstraint("line_total >= 0", name="ck_quotation_items_line_total"),
    )

# 11. subscriptions
class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    subscription_number = Column(String(100), unique=True, nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False)
    quotation_id = Column(UUID(as_uuid=True), ForeignKey("quotations.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), nullable=False, default="draft", server_default=text("'draft'"))
    start_date = Column(Date, nullable=False)
    expiry_date = Column(Date, nullable=True)
    current_period_start = Column(Date, nullable=True)
    current_period_end = Column(Date, nullable=True)
    next_billing_date = Column(Date, nullable=True)
    payment_terms_days = Column(Integer, nullable=False, default=15, server_default=text("15"))
    auto_renew = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    closed_reason = Column(String(500), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, server_default=text("now()"))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow, server_default=text("now()"))

    customer = relationship("Customer", back_populates="subscriptions")
    plan = relationship("Plan")
    quotation = relationship("Quotation")
    items = relationship("SubscriptionItem", back_populates="subscription")
    history = relationship("SubscriptionStatusHistory", back_populates="subscription", order_by="SubscriptionStatusHistory.changed_at")
    invoices = relationship("Invoice", back_populates="subscription")

    __table_args__ = (
        CheckConstraint("status IN ('draft', 'quotation', 'confirmed', 'active', 'paused', 'closed')", name="ck_subscriptions_status"),
        Index("ux_subscriptions_quotation", "quotation_id", unique=True, postgresql_where=text("quotation_id IS NOT NULL")),
        Index("ix_subscriptions_due", "next_billing_date", postgresql_where=text("status = 'active'")),
        Index("ix_subscriptions_customer_status", "customer_id", "status"),
    )

# 12. subscription_items
class SubscriptionItem(Base):
    __tablename__ = "subscription_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    variant_id = Column(UUID(as_uuid=True), ForeignKey("product_variants.id", ondelete="SET NULL"), nullable=True)
    description_snapshot = Column(String(500), nullable=False)
    quantity = Column(Integer, nullable=False, default=1, server_default=text("1"))
    unit_price = Column(Numeric(12, 2), nullable=False)
    tax_rule_id = Column(UUID(as_uuid=True), ForeignKey("tax_rules.id", ondelete="SET NULL"), nullable=True)

    subscription = relationship("Subscription", back_populates="items")
    product = relationship("Product")
    variant = relationship("ProductVariant")
    tax_rule = relationship("TaxRule")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_subscription_items_quantity"),
        CheckConstraint("unit_price >= 0", name="ck_subscription_items_unit_price"),
    )

# 13. subscription_status_history
class SubscriptionStatusHistory(Base):
    __tablename__ = "subscription_status_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=False)
    changed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    changed_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, server_default=text("now()"))
    note = Column(String(500), nullable=True)

    subscription = relationship("Subscription", back_populates="history")

# 14. discounts
class Discount(Base):
    __tablename__ = "discounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    name = Column(String(255), nullable=False)
    discount_type = Column(String(50), nullable=False)
    value = Column(Numeric(12, 2), nullable=False)
    minimum_purchase = Column(Numeric(12, 2), nullable=True)
    minimum_quantity = Column(Integer, nullable=True)
    starts_on = Column(Date, nullable=True)
    ends_on = Column(Date, nullable=True)
    usage_limit = Column(Integer, nullable=True)
    usage_count = Column(Integer, nullable=False, default=0, server_default=text("0"))
    scope = Column(String(50), nullable=False)
    is_active = Column(Boolean, nullable=False, default=True, server_default=text("true"))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    products = relationship("DiscountProduct", back_populates="discount")

    __table_args__ = (
        CheckConstraint("discount_type IN ('fixed', 'percentage')", name="ck_discounts_discount_type"),
        CheckConstraint("scope IN ('products', 'subscription')", name="ck_discounts_scope"),
        CheckConstraint("value >= 0", name="ck_discounts_value"),
    )

# 15. discount_products
class DiscountProduct(Base):
    __tablename__ = "discount_products"

    discount_id = Column(UUID(as_uuid=True), ForeignKey("discounts.id", ondelete="CASCADE"), primary_key=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)

    discount = relationship("Discount", back_populates="products")
    product = relationship("Product")

# 16. discount_redemptions
class DiscountRedemption(Base):
    __tablename__ = "discount_redemptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    discount_id = Column(UUID(as_uuid=True), ForeignKey("discounts.id", ondelete="RESTRICT"), nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="CASCADE"), nullable=False)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    discount_amount = Column(Numeric(12, 2), nullable=False)
    redeemed_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, server_default=text("now()"))

    __table_args__ = (
        CheckConstraint("discount_amount >= 0", name="ck_discount_redemptions_discount_amount"),
    )

# 17. invoices
class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    invoice_number = Column(String(100), unique=True, nullable=False)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False)
    subscription_id = Column(UUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="RESTRICT"), nullable=False)
    billing_period_start = Column(Date, nullable=False)
    billing_period_end = Column(Date, nullable=False)
    issue_date = Column(Date, nullable=False)
    due_date = Column(Date, nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False, default=0.00, server_default=text("0.00"))
    discount_total = Column(Numeric(12, 2), nullable=False, default=0.00, server_default=text("0.00"))
    tax_total = Column(Numeric(12, 2), nullable=False, default=0.00, server_default=text("0.00"))
    grand_total = Column(Numeric(12, 2), nullable=False, default=0.00, server_default=text("0.00"))
    amount_paid = Column(Numeric(12, 2), nullable=False, default=0.00, server_default=text("0.00"))
    balance_due = Column(Numeric(12, 2), nullable=False, default=0.00, server_default=text("0.00"))
    status = Column(String(50), nullable=False, default="draft", server_default=text("'draft'"))
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, server_default=text("now()"))

    customer = relationship("Customer", back_populates="invoices")
    subscription = relationship("Subscription", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice")
    payments = relationship("Payment", back_populates="invoice")

    __table_args__ = (
        CheckConstraint("status IN ('draft', 'confirmed', 'paid', 'cancelled')", name="ck_invoices_status"),
        CheckConstraint("billing_period_end >= billing_period_start", name="ck_invoices_billing_period"),
        CheckConstraint("subtotal >= 0", name="ck_invoices_subtotal"),
        CheckConstraint("discount_total >= 0", name="ck_invoices_discount_total"),
        CheckConstraint("tax_total >= 0", name="ck_invoices_tax_total"),
        CheckConstraint("grand_total >= 0", name="ck_invoices_grand_total"),
        CheckConstraint(
            "amount_paid >= 0 AND balance_due >= 0 AND amount_paid + balance_due = grand_total",
            name="ck_invoices_balance_due_formula",
        ),
        Index("ux_invoice_period", "subscription_id", "billing_period_start", "billing_period_end", unique=True),
        Index("ix_invoices_customer_status_due", "customer_id", "status", "due_date"),
        Index("ix_invoices_overdue", "due_date", postgresql_where=text("status = 'confirmed' AND balance_due > 0")),
        Index("ix_invoices_issue_date", "issue_date"),
    )

# 18. invoice_items
class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    description_snapshot = Column(String(500), nullable=False)
    quantity = Column(Integer, nullable=False, default=1, server_default=text("1"))
    unit_price = Column(Numeric(12, 2), nullable=False)
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0.00, server_default=text("0.00"))
    tax_rate_percent = Column(Numeric(12, 2), nullable=False, default=0.00, server_default=text("0.00"))
    tax_amount = Column(Numeric(12, 2), nullable=False, default=0.00, server_default=text("0.00"))
    line_total = Column(Numeric(12, 2), nullable=False)

    invoice = relationship("Invoice", back_populates="items")
    product = relationship("Product")

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_invoice_items_quantity"),
        CheckConstraint("unit_price >= 0", name="ck_invoice_items_unit_price"),
        CheckConstraint("discount_amount >= 0", name="ck_invoice_items_discount_amount"),
        CheckConstraint("tax_rate_percent >= 0 AND tax_rate_percent <= 100", name="ck_invoice_items_tax_rate_percent"),
        CheckConstraint("tax_amount >= 0", name="ck_invoice_items_tax_amount"),
        CheckConstraint("line_total >= 0", name="ck_invoice_items_line_total"),
    )

# 19. payments
class Payment(Base):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="RESTRICT"), nullable=False)
    idempotency_key = Column(String(255), nullable=True)
    payment_reference = Column(String(255), nullable=True)
    method = Column(String(50), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_date = Column(Date, nullable=False)
    note = Column(String(1000), nullable=True)
    recorded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, server_default=text("now()"))

    invoice = relationship("Invoice", back_populates="payments")

    __table_args__ = (
        CheckConstraint("method IN ('cash', 'upi', 'card', 'bank_transfer', 'gateway', 'other')", name="ck_payments_method"),
        CheckConstraint("amount > 0", name="ck_payments_amount"),
        Index("ux_payments_idempotency", "idempotency_key", unique=True, postgresql_where=text("idempotency_key IS NOT NULL")),
        Index("ux_payments_reference", "payment_reference", unique=True, postgresql_where=text("payment_reference IS NOT NULL")),
        Index("ix_payments_invoice", "invoice_id", "payment_date"),
        Index("ix_payments_date", "payment_date"),
    )

# 20. password_reset_tokens
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, server_default=text("now()"))

# 21. notifications
class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    kind = Column(String(100), nullable=False)
    invoice_id = Column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    sent_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, server_default=text("now()"))

    __table_args__ = (
        Index("ux_notifications_invoice_kind", "invoice_id", "kind", unique=True),
    )

# 22. audit_logs
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    meta = Column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow, server_default=text("now()"))

# 23. sequences
class Sequence(Base):
    __tablename__ = "sequences"

    name = Column(String(100), primary_key=True)
    value = Column(BigInteger, nullable=False, default=1, server_default=text("1"))
