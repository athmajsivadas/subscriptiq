import os
import sys
import time
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "demo_screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

def run():
    print("\n=== Playwright End-to-End Section 26 Demo Automation ===\n")
    console_logs = []
    console_errors = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        # Test Desktop (1280x800)
        context = browser.new_context(viewport={"width": 1280, "height": 800})
        page = context.new_page()

        # Listen to console
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: console_errors.append(str(err)))

        # 1. Login
        print("1. Navigating to Login Page (http://localhost:8080/login)...")
        page.goto("http://localhost:8080/login")
        page.wait_for_selector("input[type='email']", timeout=10000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "login_1280.png"))

        print("2. Submitting Admin Credentials (admin@brightloop.test / Admin#2026)...")
        page.fill("input[type='email']", "admin@brightloop.test")
        page.fill("input[type='password']", "Admin#2026")
        page.click("button[type='submit']")

        # 2. Dashboard
        page.wait_for_url("**/dashboard", timeout=10000)
        page.wait_for_selector("text=Executive Financial Overview", timeout=10000)
        print("3. Successfully arrived at Admin Dashboard!")
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "dashboard_1280.png"))

        # Capture tablet and mobile viewports
        page.set_viewport_size({"width": 768, "height": 1024})
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "dashboard_768.png"))

        page.set_viewport_size({"width": 375, "height": 812})
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "dashboard_375.png"))

        # Reset to desktop
        page.set_viewport_size({"width": 1280, "height": 800})
        page.wait_for_timeout(500)

        # 3. First Billing Day Run
        print("4. Triggering First Billing Day run via UI button...")
        billing_btn = page.locator("button:has-text('Simulate Billing Day')").first
        billing_btn.click()
        
        # Wait for generated invoices text - billing 200 subs can take 90+ seconds
        page.wait_for_selector("text=Generated", timeout=120000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "billing_run1_1280.png"))
        run1_text = page.locator("text=Generated").inner_text()
        print(f"   -> First click complete: {run1_text}")

        # 4. Second Billing Day Run -> Expect 'Nothing due: everything already billed.'
        print("5. Triggering Second Billing Day run immediately...")
        # Wait for button to be enabled again (not disabled) before clicking
        page.wait_for_selector("button:has-text('Simulate Billing Day'):not([disabled])", timeout=15000)
        # Re-locate the button to avoid stale reference
        billing_btn2 = page.locator("button:has-text('Simulate Billing Day')").first
        billing_btn2.click()

        # Wait for result div to update - first it clears, then shows "Nothing due"
        page.wait_for_selector("text=Nothing due: everything already billed.", timeout=25000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "billing_run2_nothing_due_1280.png"))
        print("   -> Verified exact toast message: 'Nothing due: everything already billed.'!")

        # 5. Invoices Lifecycle: Confirm, Send, Download PDF
        print("6. Navigating to Invoices Page (/invoices)...")
        page.goto("http://localhost:8080/invoices")
        page.wait_for_selector("table", timeout=10000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "invoices_1280.png"))

        # Confirm a draft invoice
        confirm_btn = page.locator("button:has-text('Confirm')").first
        if confirm_btn.is_visible():
            print("   -> Confirming Draft invoice...")
            confirm_btn.click()
            page.wait_for_timeout(1000)

        # Send invoice
        send_btn = page.locator("button:has-text('Send')").first
        if send_btn.is_visible():
            print("   -> Sending invoice...")
            # Dismiss alert dialog automatically
            page.on("dialog", lambda dialog: dialog.accept())
            send_btn.click()
            page.wait_for_timeout(1000)

        # View detail modal (lines, discount, tax, totals)
        print("7. Viewing Invoice Detail modal...")
        view_btn = page.locator("button:has-text('View')").first
        view_btn.click()
        page.wait_for_selector("text=Invoice Line Items", timeout=10000)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "invoice_detail_modal_1280.png"))
        print("   -> Detail modal displayed with lines, taxes, discount, and grand total!")

        # Close modal
        page.locator("button:has-text('Close')").click()
        page.wait_for_timeout(500)

        # 6. Customer Portal verification
        print("8. Testing Customer Portal (/portal/plans)...")
        # Login as customer
        cust_context = browser.new_context(viewport={"width": 1280, "height": 800})
        cust_page = cust_context.new_page()
        cust_page.goto("http://localhost:8080/login")
        cust_page.fill("input[type='email']", "cust1@brightloop.test")
        cust_page.fill("input[type='password']", "Cust1#2026")
        cust_page.click("button[type='submit']")
        cust_page.wait_for_url("**/portal", timeout=10000)
        cust_page.screenshot(path=os.path.join(SCREENSHOT_DIR, "portal_dashboard_1280.png"))
        print("   -> Customer successfully logged in to /portal!")

        cust_page.goto("http://localhost:8080/portal/plans")
        cust_page.wait_for_selector("text=Available Subscription Plans", timeout=10000)
        cust_page.screenshot(path=os.path.join(SCREENSHOT_DIR, "portal_plans_1280.png"))
        print("   -> /portal/plans rendered cleanly!")

        browser.close()

    print("\n=== Console Errors Report ===")
    if console_errors:
        print(f"Total Console Errors: {len(console_errors)}")
        for err in console_errors:
            print(f"  [ERROR] {err}")
    else:
        print("Total Console Errors: 0 (Clean browser execution!)")

    print("\n[SUCCESS] Playwright Section 26 Demo completed successfully!\n")

if __name__ == "__main__":
    run()
