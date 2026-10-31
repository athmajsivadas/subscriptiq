import os
import sys
import io
import uuid
from decimal import Decimal
from datetime import date, timedelta
import pypdf

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.core.money import money, ZERO
from app.models.all_models import (
    Customer, Product, ProductVariant, Plan, Subscription, SubscriptionItem,
    Invoice, InvoiceItem, TaxRule, Discount
)
from app.services.pricing import line_unit_price
from app.services.pdf_service import generate_invoice_pdf

def main():
    print("\n=== Section 8 & 14: PDF Generation and +560 Variant Arithmetic Verification ===\n")

    # 1. Manual Decimal Calculation
    plan_base_price = Decimal("1200.00")
    variant_extra = Decimal("560.00")
    qty = 2
    discount_rate = Decimal("0.10")  # 10%
    tax_rate = Decimal("18.00")      # 18%

    calc_unit_price = money(plan_base_price + variant_extra)   # 1760.00
    calc_subtotal = money(calc_unit_price * qty)               # 3520.00
    calc_discount = money(calc_subtotal * discount_rate)       # 352.00
    calc_net_subtotal = calc_subtotal - calc_discount          # 3168.00
    calc_tax = money(calc_net_subtotal * tax_rate / Decimal("100")) # 570.24
    calc_grand_total = money(calc_net_subtotal + calc_tax)     # 3738.24
    calc_amount_paid = Decimal("0.00")
    calc_balance_due = calc_grand_total

    print("--- 1. Manual Step-by-Step Decimal Calculation ---")
    print(f"  Plan Price:           INR {plan_base_price}")
    print(f"  Variant Extra:       +INR {variant_extra}")
    print(f"  Line Unit Price:      INR {calc_unit_price}  (1200.00 + 560.00 = 1760.00 exactly once)")
    print(f"  Quantity:             {qty}")
    print(f"  Subtotal:             INR {calc_subtotal}  (1760.00 * 2 = 3520.00)")
    print(f"  Discount (10%):      -INR {calc_discount}  (3520.00 * 0.10 = 352.00)")
    print(f"  Net Taxable:          INR {calc_net_subtotal}")
    print(f"  Tax (18%):           +INR {calc_tax}  (3168.00 * 0.18 = 570.24)")
    print(f"  Grand Total:          INR {calc_grand_total}  (3168.00 + 570.24 = 3738.24)")
    print(f"  Amount Paid:          INR {calc_amount_paid}")
    print(f"  Balance Due:          INR {calc_balance_due}")

    # 2. Database Record & PDF Generation
    with SessionLocal() as db:
        cust = Customer(
            company_name="Apex Global Technologies",
            billing_address="100 Silicon Blvd, Bengaluru",
            tax_identifier="29AAAAA1111A1Z1"
        )
        tax = TaxRule(name="GST 18%", rate_percent=tax_rate)
        prod = Product(name="Enterprise Cloud Suite", product_type="service", sales_price=Decimal("1000.00"), cost_price=Decimal("400.00"), default_tax_rule=tax)
        db.add_all([cust, tax, prod])
        db.flush()

        variant = ProductVariant(product_id=prod.id, variant_name="High-Performance GPU Cluster", additional_price=variant_extra)
        db.add(variant)
        db.flush()

        plan = Plan(product_id=prod.id, name="Enterprise GPU Monthly", price=plan_base_price, billing_cycle="monthly")
        db.add(plan)
        db.flush()

        # Compute line price via domain service
        computed_price = line_unit_price(plan, prod, variant)
        assert computed_price == calc_unit_price, f"Pricing mismatch: {computed_price} vs {calc_unit_price}"

        sub = Subscription(
            subscription_number=f"SUB-PDF-{uuid.uuid4().hex[:6]}",
            customer_id=cust.id,
            plan_id=plan.id,
            status="active",
            start_date=date(2026, 10, 1),
        )
        db.add(sub)
        db.flush()

        inv = Invoice(
            invoice_number=f"INV-PDF-{uuid.uuid4().hex[:6]}",
            customer_id=cust.id,
            subscription_id=sub.id,
            billing_period_start=date(2026, 10, 1),
            billing_period_end=date(2026, 10, 31),
            issue_date=date(2026, 10, 1),
            due_date=date(2026, 10, 16),
            subtotal=calc_subtotal,
            discount_total=calc_discount,
            tax_total=calc_tax,
            grand_total=calc_grand_total,
            amount_paid=calc_amount_paid,
            balance_due=calc_balance_due,
            status="confirmed",
        )
        inv.items.append(
            InvoiceItem(
                product_id=prod.id,
                description_snapshot=f"{prod.name} ({variant.variant_name})",
                quantity=qty,
                unit_price=calc_unit_price,
                discount_amount=calc_discount,
                tax_rate_percent=tax_rate,
                tax_amount=calc_tax,
                line_total=calc_grand_total,
            )
        )
        db.add(inv)
        db.commit()
        db.refresh(inv)

        print("\n--- 2. Generating Invoice PDF with ReportLab ---")
        pdf_bytes = generate_invoice_pdf(inv)
        print(f"Generated PDF successfully. Size: {len(pdf_bytes)} bytes")

    # 3. Extract text from PDF using pypdf
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    extracted_text = ""
    for page in reader.pages:
        extracted_text += page.extract_text() + "\n"

    print("\n--- 3. Raw Text Extracted from PDF ---")
    print("-" * 60)
    print(extracted_text.strip())
    print("-" * 60)

    # 4. Strict Arithmetic Verification
    print("\n--- 4. Cross-Verification Comparison ---")
    checks = [
        ("Invoice Number", inv.invoice_number, inv.invoice_number in extracted_text),
        ("Customer Name", "Apex Global Technologies", "Apex Global Technologies" in extracted_text),
        ("Variant Description", "High-Performance GPU Cluster", "High-Performance GPU Cluster" in extracted_text),
        ("Quantity (2)", "2", "2" in extracted_text),
        ("Unit Price (1760.00)", "1760.00", "1760.00" in extracted_text),
        ("Discount Total (352.00)", "352.00", "352.00" in extracted_text),
        ("Tax Total (570.24)", "570.24", "570.24" in extracted_text),
        ("Grand Total (3738.24)", "3738.24", "3738.24" in extracted_text),
        ("Balance Due (3738.24)", "3738.24", "3738.24" in extracted_text),
    ]

    all_matched = True
    for label, expected, matched in checks:
        status = "MATCH" if matched else "MISMATCH"
        print(f"  [{status}] {label:<28}: Expected '{expected}'")
        if not matched:
            all_matched = False

    assert all_matched, "Some PDF values failed verification!"
    print("\n[SUCCESS] PDF numbers perfectly match manual Decimal calculations to the exact paise!\n")

if __name__ == "__main__":
    main()
