import io
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from app.models.all_models import Invoice

def generate_invoice_pdf(invoice: Invoice) -> bytes:
    """
    Section 12: PDF generated strictly from invoice snapshots.
    No current catalog prices are read.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    story = []

    # Title & Invoice Details
    story.append(Paragraph(f"<b>INVOICE: {invoice.invoice_number}</b>", styles["Title"]))
    story.append(Spacer(1, 12))

    info_data = [
        [f"Issue Date: {invoice.issue_date}", f"Due Date: {invoice.due_date}"],
        [f"Billing Period: {invoice.billing_period_start} to {invoice.billing_period_end}", f"Status: {invoice.status.upper()}"],
        [f"Customer: {invoice.customer.company_name if invoice.customer else 'N/A'}", ""],
    ]
    info_table = Table(info_data, colWidths=[270, 270])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 16))

    # Line Items Table
    table_data = [["Description", "Qty", "Unit Price", "Discount", "Tax %", "Total"]]
    for item in invoice.items:
        table_data.append([
            item.description_snapshot,
            str(item.quantity),
            f"INR {item.unit_price:.2f}",
            f"INR {item.discount_amount:.2f}",
            f"{item.tax_rate_percent:.1f}%",
            f"INR {item.line_total:.2f}",
        ])

    items_table = Table(table_data, colWidths=[180, 40, 80, 80, 60, 100])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F3F4F6')),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('ALIGN', (1,0), (-1,-1), 'RIGHT'),
        ('ALIGN', (0,0), (0,-1), 'LEFT'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 16))

    # Summary Table
    summary_data = [
        ["Subtotal:", f"INR {invoice.subtotal:.2f}"],
        ["Discount Total:", f"- INR {invoice.discount_total:.2f}"],
        ["Tax Total:", f"INR {invoice.tax_total:.2f}"],
        ["Grand Total:", f"INR {invoice.grand_total:.2f}"],
        ["Amount Paid:", f"INR {invoice.amount_paid:.2f}"],
        ["Balance Due:", f"INR {invoice.balance_due:.2f}"],
    ]
    summary_table = Table(summary_data, colWidths=[440, 100])
    summary_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('FONTNAME', (0,3), (-1,3), 'Helvetica-Bold'),
        ('FONTNAME', (0,5), (-1,5), 'Helvetica-Bold'),
    ]))
    story.append(summary_table)

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
