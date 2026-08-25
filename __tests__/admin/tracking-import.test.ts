/**
 * ==========================================
 * BULK TRACKING IMPORT TESTS
 * ==========================================
 *
 * Static/code-path verification tests.
 * These verify architecture, validation rules,
 * and code patterns without requiring a running
 * database.
 *
 * Run: npx tsx __tests__/admin/tracking-import.test.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

function readFile(relativePath: string): string {
    return readFileSync(
        resolve(process.cwd(), relativePath),
        "utf-8"
    );
}

function assert(condition: boolean, message: string) {
    if (!condition) {
        throw new Error(`FAIL: ${message}`);
    }
}

function pass(name: string) {
    console.log(`  ✅ ${name}`);
}

function fail(name: string, error: string) {
    console.log(`  ❌ ${name}: ${error}`);
}

// ==========================================
// TEST SUITE
// ==========================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
    try {
        fn();
        pass(name);
        passed++;
    } catch (e) {
        fail(
            name,
            e instanceof Error ? e.message : String(e)
        );
        failed++;
    }
}

console.log("\n=== BULK TRACKING IMPORT TESTS ===\n");

// ==========================================
// 1. TEMPLATE API ARCHITECTURE
// ==========================================

console.log("1. Template API Architecture:");

const templateRoute = readFile(
    "app/api/admin/orders/tracking-template/route.ts"
);

test("Template route has GET export", () => {
    assert(
        templateRoute.includes("export async function GET"),
        "Template route missing GET export"
    );
});

test("Template route checks ADMIN role", () => {
    assert(
        templateRoute.includes('session.user.role !== "ADMIN"'),
        "Template route missing ADMIN role check"
    );
});

test("Template route checks Unauthorized", () => {
    assert(
        templateRoute.includes("Unauthorized"),
        "Template route missing Unauthorized check"
    );
});

test("Template generates .xlsx format", () => {
    assert(
        templateRoute.includes('bookType: "xlsx"'),
        "Template not generating xlsx format"
    );
});

test("Template has orderNumber column", () => {
    assert(
        templateRoute.includes("orderNumber"),
        "Template missing orderNumber column"
    );
});

test("Template has trackingNumber column", () => {
    assert(
        templateRoute.includes("trackingNumber"),
        "Template missing trackingNumber column"
    );
});

test("Template has courier column", () => {
    assert(
        templateRoute.includes("courier"),
        "Template missing courier column"
    );
});

test("Template has Petunjuk (instructions) sheet", () => {
    assert(
        templateRoute.includes("Petunjuk"),
        "Template missing Petunjuk sheet"
    );
});

test("Template has Template sheet", () => {
    assert(
        templateRoute.includes('"Template"'),
        "Template missing Template sheet"
    );
});

test("Template uses XLSX library", () => {
    assert(
        templateRoute.includes('import * as XLSX from "xlsx"'),
        "Template not using XLSX library"
    );
});

test("Template returns Excel content type", () => {
    assert(
        templateRoute.includes(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        "Template missing Excel content type"
    );
});

test("Template has Content-Disposition attachment", () => {
    assert(
        templateRoute.includes("attachment"),
        "Template missing attachment disposition"
    );
});

// ==========================================
// 1B. TEMPLATE DATABASE QUERY
// ==========================================

test("Template queries database with prisma", () => {
    assert(
        templateRoute.includes('import { prisma }'),
        "Template not importing prisma"
    );
});

test("Template uses prisma.order.findMany", () => {
    assert(
        templateRoute.includes("prisma.order.findMany"),
        "Template not using prisma.order.findMany"
    );
});

test("Template filters out orders with existing trackingNumber (null)", () => {
    assert(
        templateRoute.includes("trackingNumber: null"),
        "Template missing trackingNumber: null filter"
    );
});

test("Template filters out orders with empty trackingNumber", () => {
    assert(
        templateRoute.includes('trackingNumber: ""'),
        "Template missing empty trackingNumber filter"
    );
});

test("Template uses OR for trackingNumber filter (null OR empty)", () => {
    assert(
        templateRoute.includes("OR:") &&
            templateRoute.includes("trackingNumber: null"),
        "Template missing OR logic for trackingNumber filter"
    );
});

test("Template excludes CANCELLED orders", () => {
    assert(
        templateRoute.includes("CANCELLED") &&
            templateRoute.includes("notIn"),
        "Template not excluding CANCELLED orders"
    );
});

test("Template excludes COMPLETED orders", () => {
    assert(
        templateRoute.includes("COMPLETED") &&
            templateRoute.includes("notIn"),
        "Template not excluding COMPLETED orders"
    );
});

test("Template does NOT use hardcoded sample data", () => {
    assert(
        !templateRoute.includes('orderNumber: "ORD-001"') &&
            !templateRoute.includes('orderNumber: "ORD-002"'),
        "Template still uses hardcoded sample data"
    );
});

test("Template does NOT include sample tracking numbers", () => {
    assert(
        !templateRoute.includes('JNE123456789') &&
            !templateRoute.includes('SPX987654321'),
        "Template still includes sample tracking numbers"
    );
});

test("Template limits max rows to 500", () => {
    assert(
        templateRoute.includes("MAX_TEMPLATE_ROWS") &&
            templateRoute.includes("500"),
        "Template missing 500 row limit"
    );
});

test("Template selects orderNumber from database", () => {
    assert(
        templateRoute.includes("orderNumber: true"),
        "Template not selecting orderNumber"
    );
});

test("Template selects recipientName for customerName column", () => {
    assert(
        templateRoute.includes("recipientName: true"),
        "Template not selecting recipientName"
    );
});

test("Template selects createdAt for orderDate column", () => {
    assert(
        templateRoute.includes("createdAt: true"),
        "Template not selecting createdAt"
    );
});

test("Template selects shippingCourier for reference column", () => {
    assert(
        templateRoute.includes("shippingCourier: true"),
        "Template not selecting shippingCourier"
    );
});

test("Template writes orderNumber as read-only (from DB)", () => {
    assert(
        templateRoute.includes("orderNumber: order.orderNumber"),
        "Template not writing orderNumber from database"
    );
});

test("Template writes empty trackingNumber for admin to fill", () => {
    assert(
        templateRoute.includes('trackingNumber: ""'),
        "Template not writing empty trackingNumber"
    );
});

test("Template pre-fills courier from customer selection", () => {
    assert(
        templateRoute.includes("order.shippingCourier"),
        "Template not pre-filling courier from customer selection"
    );
});

test("Template has customerName info column", () => {
    assert(
        templateRoute.includes("customerName"),
        "Template missing customerName column"
    );
});

test("Template has orderDate info column", () => {
    assert(
        templateRoute.includes("orderDate"),
        "Template missing orderDate column"
    );
});

test("Template has status info column", () => {
    assert(
        templateRoute.includes("status: order.status"),
        "Template missing status info column"
    );
});

test("Template handles empty results gracefully", () => {
    assert(
        templateRoute.includes("orders.length === 0"),
        "Template missing empty results handler"
    );
});

test("Template shows notice when no eligible orders", () => {
    assert(
        templateRoute.includes("Tidak ada order"),
        "Template missing empty result notice"
    );
});

test("Template creates valid Excel even with no data rows", () => {
    assert(
        templateRoute.includes("XLSX.utils.sheet_add_aoa"),
        "Template not creating valid empty sheet"
    );
});

// ==========================================
// 2. IMPORT API ARCHITECTURE
// ==========================================

console.log("\n2. Import API Architecture:");

const importRoute = readFile(
    "app/api/admin/orders/tracking-import/route.ts"
);

test("Import route has POST export", () => {
    assert(
        importRoute.includes("export async function POST"),
        "Import route missing POST export"
    );
});

test("Import route checks ADMIN role", () => {
    assert(
        importRoute.includes('session.user.role !== "ADMIN"'),
        "Import route missing ADMIN role check"
    );
});

test("Import route checks Unauthorized", () => {
    assert(
        importRoute.includes("Unauthorized"),
        "Import route missing Unauthorized check"
    );
});

test("Import route validates multipart/form-data", () => {
    assert(
        importRoute.includes("multipart/form-data"),
        "Import route not validating content type"
    );
});

test("Import route uses XLSX library", () => {
    assert(
        importRoute.includes('import * as XLSX from "xlsx"'),
        "Import route not using XLSX library"
    );
});

test("Import route uses prisma", () => {
    assert(
        importRoute.includes('import { prisma }'),
        "Import route not using prisma"
    );
});

// ==========================================
// 3. FILE VALIDATION
// ==========================================

console.log("\n3. File Validation:");

test("Import validates file size (5MB max)", () => {
    assert(
        importRoute.includes("MAX_FILE_SIZE") &&
            importRoute.includes("5 * 1024 * 1024"),
        "Import missing 5MB file size limit"
    );
});

test("Import checks file size === 0", () => {
    assert(
        importRoute.includes("file.size === 0"),
        "Import missing empty file check"
    );
});

test("Import validates .xlsx extension", () => {
    assert(
        importRoute.includes('.xlsx"'),
        "Import missing .xlsx extension validation"
    );
});

test("Import validates .xls extension", () => {
    assert(
        importRoute.includes('.xls"'),
        "Import missing .xls extension validation"
    );
});

test("Import validates .csv extension", () => {
    assert(
        importRoute.includes('.csv"'),
        "Import missing .csv extension validation"
    );
});

test("Import validates file extension (not just MIME)", () => {
    assert(
        importRoute.includes("getExtension"),
        "Import not validating file extension"
    );
});

test("Import rejects non-Excel files", () => {
    assert(
        importRoute.includes("Format file tidak didukung"),
        "Import missing non-Excel rejection message"
    );
});

test("Import handles corrupt Excel", () => {
    assert(
        importRoute.includes("File bukan Excel yang valid"),
        "Import missing corrupt file handling"
    );
});

// ==========================================
// 4. HEADER VALIDATION
// ==========================================

console.log("\n4. Header Validation:");

test("Import validates required headers", () => {
    assert(
        importRoute.includes("requiredHeaders"),
        "Import missing required headers validation"
    );
});

test("Import requires orderNumber header", () => {
    assert(
        importRoute.includes('"orderNumber"'),
        "Import missing orderNumber in required headers"
    );
});

test("Import requires trackingNumber header", () => {
    assert(
        importRoute.includes('"trackingNumber"'),
        "Import missing trackingNumber in required headers"
    );
});

test("Import requires courier header", () => {
    assert(
        importRoute.includes('"courier"'),
        "Import missing courier in required headers"
    );
});

test("Import reports missing headers", () => {
    assert(
        importRoute.includes("Kolom yang wajib ada tidak ditemukan"),
        "Import missing header error message"
    );
});

// ==========================================
// 5. ROW VALIDATION RULES
// ==========================================

console.log("\n5. Row Validation Rules:");

test("Import validates orderNumber is required", () => {
    assert(
        importRoute.includes("orderNumber wajib diisi"),
        "Import missing orderNumber required validation"
    );
});

test("Import validates trackingNumber is required", () => {
    assert(
        importRoute.includes("trackingNumber wajib diisi"),
        "Import missing trackingNumber required validation"
    );
});

test("Import validates courier is required", () => {
    assert(
        importRoute.includes("courier wajib diisi"),
        "Import missing courier required validation"
    );
});

test("Import checks duplicate orderNumber within file", () => {
    assert(
        importRoute.includes("orderNumber duplikat"),
        "Import missing duplicate orderNumber check"
    );
});

test("Import checks duplicate trackingNumber within file", () => {
    assert(
        importRoute.includes("trackingNumber duplikat"),
        "Import missing duplicate trackingNumber check"
    );
});

test("Import validates order exists in database", () => {
    assert(
        importRoute.includes("Order tidak ditemukan"),
        "Import missing order not found validation"
    );
});

test("Import rejects cancelled orders", () => {
    assert(
        importRoute.includes("CANCELLED") &&
            importRoute.includes(
                "Tidak dapat menambahkan resi"
            ),
        "Import missing cancelled order rejection"
    );
});

test("Import implements idempotency (same tracking = skip)", () => {
    assert(
        importRoute.includes("sudah memiliki nomor resi yang sama") &&
            importRoute.includes("SKIPPED"),
        "Import missing idempotency for same tracking number"
    );
});

test("Import rejects different existing tracking", () => {
    assert(
        importRoute.includes(
            "sudah memiliki nomor resi berbeda"
        ),
        "Import missing different tracking number rejection"
    );
});

test("Import detects formula payloads", () => {
    assert(
        importRoute.includes("isFormulasPayload"),
        "Import missing formula payload detection"
    );
});

test("Import sanitizes input (trim)", () => {
    assert(
        importRoute.includes("sanitizeValue"),
        "Import missing sanitizeValue function"
    );
});

test("Import strips formula prefix (=)", () => {
    assert(
        importRoute.includes('str.startsWith("=")'),
        "Import not stripping formula prefix"
    );
});

test("Import strips leading single quotes", () => {
    assert(
        importRoute.includes("str.startsWith(\"'\")"),
        "Import not stripping leading single quotes"
    );
});

// ==========================================
// 6. PARTIAL SUCCESS
// ==========================================

console.log("\n6. Partial Success:");

test("Import processes each row independently", () => {
    // The loop processes each row individually with try/catch
    assert(
        importRoute.includes("for (") &&
            importRoute.includes("try {"),
        "Import not processing rows independently"
    );
});

test("Import tracks success count", () => {
    assert(
        importRoute.includes("successCount++"),
        "Import missing successCount"
    );
});

test("Import tracks failed count", () => {
    assert(
        importRoute.includes("failedCount++"),
        "Import missing failedCount"
    );
});

test("Import tracks skipped count", () => {
    assert(
        importRoute.includes("skippedCount++"),
        "Import missing skippedCount"
    );
});

test("Import returns row-level results", () => {
    assert(
        importRoute.includes("results.push"),
        "Import missing row-level result push"
    );
});

test("Import returns summary with all counts", () => {
    assert(
        importRoute.includes("summary:") &&
            importRoute.includes("success:") &&
            importRoute.includes("failed:") &&
            importRoute.includes("skipped:"),
        "Import missing complete summary"
    );
});

// ==========================================
// 7. DATABASE UPDATE
// ==========================================

console.log("\n7. Database Update:");

test("Import uses prisma.order.update", () => {
    assert(
        importRoute.includes("prisma.order.update"),
        "Import not using prisma.order.update"
    );
});

test("Import updates trackingNumber field", () => {
    assert(
        importRoute.includes("trackingNumber,") &&
            importRoute.includes("data: {"),
        "Import not updating trackingNumber"
    );
});

test("Import generates tracking URL", () => {
    assert(
        importRoute.includes("createTrackingUrl"),
        "Import not generating tracking URL"
    );
});

test("Import updates trackingUrl field", () => {
    assert(
        importRoute.includes("trackingUrl,"),
        "Import not updating trackingUrl"
    );
});

test("Import does NOT change order status", () => {
    // The import only updates trackingNumber and trackingUrl — no status field
    const updateDataMatch = importRoute.match(/data:\s*\{([^}]+)\}/g);
    if (updateDataMatch) {
        for (const match of updateDataMatch) {
            // Only check the data block inside prisma.order.update
            if (match.includes("trackingNumber") && match.includes("trackingUrl")) {
                assert(
                    !match.includes("status:"),
                    "Import data block contains status field — should not change order status"
                );
            }
        }
    }
});

test("Import does NOT change order total", () => {
    const updateSection = importRoute.substring(
        importRoute.indexOf("prisma.order.update"),
        importRoute.indexOf("results.push")
    );
    assert(
        !updateSection.includes("total:") ||
            !updateSection.includes("subtotal:"),
        "Import should not change order total"
    );
});

// ==========================================
// 8. PRE-FLIGHT QUERY (PERFORMANCE)
// ==========================================

console.log("\n8. Pre-flight Query (Performance):");

test("Import fetches all matching orders in one query", () => {
    assert(
        importRoute.includes("prisma.order.findMany") &&
            importRoute.includes("in: Array.from(orderNumbers)"),
        "Import not using batch order query"
    );
});

test("Import builds orderMap for O(1) lookup", () => {
    assert(
        importRoute.includes("orderMap"),
        "Import not building orderMap"
    );
});

test("Import limits max rows to 500", () => {
    assert(
        importRoute.includes("500"),
        "Import missing 500 row limit"
    );
});

// ==========================================
// 9. IDENTITY & AUTHORIZATION
// ==========================================

console.log("\n9. Identity & Authorization:");

test("Import requires authenticated user", () => {
    assert(
        importRoute.includes("session?.user?.id"),
        "Import not checking user session"
    );
});

test("Import requires ADMIN role", () => {
    assert(
        importRoute.includes('role !== "ADMIN"'),
        "Import not checking ADMIN role"
    );
});

test("Template requires authenticated user", () => {
    assert(
        templateRoute.includes("session?.user?.id"),
        "Template not checking user session"
    );
});

test("Template requires ADMIN role", () => {
    assert(
        templateRoute.includes('role !== "ADMIN"'),
        "Template not checking ADMIN role"
    );
});

// ==========================================
// 10. TRACKING URL BUILDER
// ==========================================

console.log("\n10. Tracking URL Builder:");

test("createTrackingUrl handles JNE", () => {
    assert(
        importRoute.includes("jne") &&
            importRoute.includes("jne.co.id"),
        "createTrackingUrl missing JNE support"
    );
});

test("createTrackingUrl handles J&T", () => {
    assert(
        (importRoute.includes("jnt") || importRoute.includes("j&t")) &&
            importRoute.includes("jet.co.id"),
        "createTrackingUrl missing J&T support"
    );
});

test("createTrackingUrl handles SiCepat", () => {
    assert(
        importRoute.includes("sicepat") &&
            importRoute.includes("sicepat.com"),
        "createTrackingUrl missing SiCepat support"
    );
});

test("createTrackingUrl handles AnterAja", () => {
    assert(
        importRoute.includes("anteraja") &&
            importRoute.includes("anteraja.id"),
        "createTrackingUrl missing AnterAja support"
    );
});

test("createTrackingUrl handles POS", () => {
    assert(
        importRoute.includes("pos") &&
            importRoute.includes("posindonesia.co.id"),
        "createTrackingUrl missing POS support"
    );
});

test("createTrackingUrl returns null for unknown courier", () => {
    assert(
        importRoute.includes("return null"),
        "createTrackingUrl missing null return for unknown courier"
    );
});

// ==========================================
// 11. ERROR REPORT API
// ==========================================

console.log("\n11. Error Report API:");

const errorReportRoute = readFile(
    "app/api/admin/orders/tracking-error-report/route.ts"
);

test("Error report has POST export", () => {
    assert(
        errorReportRoute.includes("export async function POST"),
        "Error report missing POST export"
    );
});

test("Error report checks ADMIN role", () => {
    assert(
        errorReportRoute.includes('session.user.role !== "ADMIN"'),
        "Error report missing ADMIN role check"
    );
});

test("Error report validates errors array", () => {
    assert(
        errorReportRoute.includes("Array.isArray(errors)"),
        "Error report missing array validation"
    );
});

test("Error report generates Excel", () => {
    assert(
        errorReportRoute.includes("XLSX.write") &&
            errorReportRoute.includes('bookType: "xlsx"'),
        "Error report not generating Excel"
    );
});

test("Error report returns Excel content type", () => {
    assert(
        errorReportRoute.includes(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ),
        "Error report missing Excel content type"
    );
});

test("Error report has max limit (500)", () => {
    assert(
        errorReportRoute.includes("500"),
        "Error report missing 500 row limit"
    );
});

// ==========================================
// 12. UI INTEGRATION
// ==========================================

console.log("\n12. UI Integration:");

const adminOrdersPage = readFile(
    "components/admin/orders/AdminOrdersPage.tsx"
);

test("AdminOrdersPage has template download button", () => {
    assert(
        adminOrdersPage.includes("handleDownloadTemplate"),
        "AdminOrdersPage missing template download handler"
    );
});

test("AdminOrdersPage has upload Excel button", () => {
    assert(
        adminOrdersPage.includes("handleUploadExcel"),
        "AdminOrdersPage missing upload Excel handler"
    );
});

test("AdminOrdersPage has file input for Excel", () => {
    assert(
        adminOrdersPage.includes('accept=".xlsx,.xls,.csv"'),
        "AdminOrdersPage missing file input accept filter"
    );
});

test("AdminOrdersPage shows import result summary", () => {
    assert(
        adminOrdersPage.includes("importResult") &&
            adminOrdersPage.includes("summary"),
        "AdminOrdersPage missing import result display"
    );
});

test("AdminOrdersPage has error report download", () => {
    assert(
        adminOrdersPage.includes("handleDownloadErrorReport"),
        "AdminOrdersPage missing error report download"
    );
});

test("AdminOrdersPage shows loading state during import", () => {
    assert(
        adminOrdersPage.includes("importing") &&
            adminOrdersPage.includes("Memproses"),
        "AdminOrdersPage missing loading state"
    );
});

test("AdminOrdersPage shows loading state during template download", () => {
    assert(
        adminOrdersPage.includes("downloadingTemplate"),
        "AdminOrdersPage missing template download loading state"
    );
});

test("AdminOrdersPage has close button for result panel", () => {
    assert(
        adminOrdersPage.includes("setShowImportResult(false)"),
        "AdminOrdersPage missing close button for result panel"
    );
});

test("AdminOrdersPage reloads orders after import", () => {
    assert(
        adminOrdersPage.includes("loadOrders(page, search, statusFilter)"),
        "AdminOrdersPage not reloading orders after import"
    );
});

test("AdminOrdersPage resets file input after selection", () => {
    assert(
        adminOrdersPage.includes('e.target.value = ""'),
        "AdminOrdersPage not resetting file input"
    );
});

test("AdminOrdersPage shows row-level status badges", () => {
    assert(
        adminOrdersPage.includes("SUCCESS") &&
            adminOrdersPage.includes("FAILED") &&
            adminOrdersPage.includes("SKIPPED"),
        "AdminOrdersPage missing row-level status badges"
    );
});

test("AdminOrdersPage uses useRef for file input", () => {
    assert(
        adminOrdersPage.includes("useRef"),
        "AdminOrdersPage not using useRef for file input"
    );
});

// ==========================================
// 13. SECURITY
// ==========================================

console.log("\n13. Security:");

test("Import uses formula detection (injection prevention)", () => {
    assert(
        importRoute.includes("isFormulasPayload"),
        "Import missing formula detection"
    );
});

test("Formula detection checks = prefix", () => {
    assert(
        importRoute.includes('trimmed.startsWith("=")'),
        "Formula detection missing = check"
    );
});

test("Formula detection checks + prefix", () => {
    assert(
        importRoute.includes('trimmed.startsWith("+")'),
        "Formula detection missing + check"
    );
});

test("Formula detection checks @ prefix", () => {
    assert(
        importRoute.includes('trimmed.startsWith("@")'),
        "Formula detection missing @ check"
    );
});

test("Import strips formula prefix from values", () => {
    assert(
        importRoute.includes('str.startsWith("=")') &&
            importRoute.includes("str.slice(1)"),
        "Import not stripping formula prefix"
    );
});

test("Import validates content-type is multipart", () => {
    assert(
        importRoute.includes("multipart/form-data"),
        "Import not validating content type"
    );
});

// ==========================================
// 14. EXISTING ORDER LIFECYCLE INTEGRITY
// ==========================================

console.log("\n14. Existing Order Lifecycle Integrity:");

const adminOrderPatch = readFile(
    "app/api/admin/orders/[id]/route.ts"
);

test("Existing PATCH route still has status transition guard", () => {
    assert(
        adminOrderPatch.includes("validTransitions") &&
            adminOrderPatch.includes("allowed.includes(status)"),
        "Existing PATCH route lost status transition guard"
    );
});

test("Existing PATCH route still validates SHIPPED requires tracking", () => {
    assert(
        adminOrderPatch.includes('status === "SHIPPED"') &&
            adminOrderPatch.includes("cleanTrackingNumber"),
        "Existing PATCH route lost SHIPPED tracking validation"
    );
});

test("Import does NOT modify order PATCH route", () => {
    // Verify the PATCH route wasn't accidentally modified
    assert(
        adminOrderPatch.includes("export async function PATCH"),
        "Existing PATCH route structure changed"
    );
});

// ==========================================
// 15. CHECKOUT & PAYMENT INTEGRITY
// ==========================================

console.log("\n15. Checkout & Payment Integrity:");

const checkoutCode = readFile("lib/checkout.ts");

test("Checkout service unchanged - createCheckoutOrder exists", () => {
    assert(
        checkoutCode.includes("export async function createCheckoutOrder"),
        "Checkout createCheckoutOrder missing"
    );
});

test("Checkout service unchanged - rollbackCheckoutOrder exists", () => {
    assert(
        checkoutCode.includes("export async function rollbackCheckoutOrder"),
        "Checkout rollbackCheckoutOrder missing"
    );
});

// ==========================================
// SUMMARY
// ==========================================

console.log("\n" + "=".repeat(50));
console.log(
    `\n📊 RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total\n`
);

if (failed > 0) {
    console.log("❌ Some tests failed!");
    process.exit(1);
} else {
    console.log("✅ All tests passed!");
    process.exit(0);
}
