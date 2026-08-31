/**
 * ==========================================
 * M5 SECURITY TEST — Admin Audit Logging
 * ==========================================
 *
 * Verifies that sensitive admin mutations
 * consistently create audit-log records.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

function readFile(relativePath: string): string {
    return readFileSync(
        resolve(process.cwd(), relativePath),
        "utf-8"
    );
}

/* ==========================================
 * AUDIT LOG INFRASTRUCTURE TESTS
 * ========================================== */

describe("M5 — Audit Log Infrastructure", () => {
    test("createAuditLog helper exists", () => {
        const code = readFile("lib/admin/audit-log.ts");
        expect(code).toContain("export async function createAuditLog");
    });

    test("AdminAuditLog model exists in Prisma schema", () => {
        const schema = readFile("prisma/schema.prisma");
        expect(schema).toContain("model AdminAuditLog");
    });

    test("AdminAuditLog has required fields", () => {
        const schema = readFile("prisma/schema.prisma");
        expect(schema).toContain("adminId");
        expect(schema).toContain("action");
        expect(schema).toContain("entityType");
        expect(schema).toContain("entityId");
        expect(schema).toContain("description");
        expect(schema).toContain("metadata");
    });

    test("createAuditLog sanitizes metadata", () => {
        const code = readFile("lib/admin/audit-log.ts");
        expect(code).toContain("sanitizeMetadata");
        expect(code).toContain("delete sanitized.password");
        expect(code).toContain("delete sanitized.token");
        expect(code).toContain("delete sanitized.secret");
    });

    test("createAuditLog is fire-and-forget (errors don't throw)", () => {
        const code = readFile("lib/admin/audit-log.ts");
        expect(code).toContain("AUDIT_LOG_ERROR");
        // Should catch errors, not rethrow
        expect(code).toMatch(/catch.*error.*\{[\s\S]*console\.error/);
    });
});

/* ==========================================
 * ORDER STATUS CHANGE AUDIT TESTS
 * ========================================== */

describe("M5 — Order Status Change Audit Logging", () => {
    test("Order PATCH route imports createAuditLog", () => {
        const code = readFile("app/api/admin/orders/[id]/route.ts");
        expect(code).toContain("import { createAuditLog }");
    });

    test("Order PATCH route calls createAuditLog on status change", () => {
        const code = readFile("app/api/admin/orders/[id]/route.ts");
        expect(code).toContain("createAuditLog({");
    });

    test("Audit log uses ORDER_STATUS_CHANGED for normal transitions", () => {
        const code = readFile("app/api/admin/orders/[id]/route.ts");
        expect(code).toContain("ORDER_STATUS_CHANGED");
    });

    test("Audit log uses ORDER_CANCELLED for cancellation", () => {
        const code = readFile("app/api/admin/orders/[id]/route.ts");
        expect(code).toContain("ORDER_CANCELLED");
    });

    test("Audit log records admin ID from session", () => {
        const code = readFile("app/api/admin/orders/[id]/route.ts");
        // Should use session.user.id, not request body
        expect(code).toContain("adminId: session.user.id");
    });

    test("Audit log records order entity", () => {
        const code = readFile("app/api/admin/orders/[id]/route.ts");
        expect(code).toContain('entityType: "Order"');
    });

    test("Audit log records previous and new status", () => {
        const code = readFile("app/api/admin/orders/[id]/route.ts");
        expect(code).toContain("previousStatus");
        expect(code).toContain("newStatus: status");
    });

    test("Audit log is fire-and-forget (doesn't block response)", () => {
        const code = readFile("app/api/admin/orders/[id]/route.ts");
        // Should use .catch() not await
        expect(code).toMatch(/createAuditLog\(\{[\s\S]*\.catch/);
    });

    test("Order status change still has authorization check", () => {
        const code = readFile("app/api/admin/orders/[id]/route.ts");
        expect(code).toContain('role !== "ADMIN"');
    });
});

/* ==========================================
 * REFUND AUDIT TESTS
 * ========================================== */

describe("M5 — Refund Audit Logging", () => {
    test("Refund PATCH route imports createAuditLog", () => {
        const code = readFile("app/api/admin/orders/[id]/refund/route.ts");
        expect(code).toContain("import { createAuditLog }");
    });

    test("Refund route calls createAuditLog", () => {
        const code = readFile("app/api/admin/orders/[id]/refund/route.ts");
        expect(code).toContain("createAuditLog({");
    });

    test("Audit log uses correct action for approve", () => {
        const code = readFile("app/api/admin/orders/[id]/refund/route.ts");
        expect(code).toContain("REFUND_APPROVED");
    });

    test("Audit log uses correct action for complete", () => {
        const code = readFile("app/api/admin/orders/[id]/refund/route.ts");
        expect(code).toContain("REFUND_COMPLETED");
    });

    test("Audit log uses correct action for reject", () => {
        const code = readFile("app/api/admin/orders/[id]/refund/route.ts");
        expect(code).toContain("REFUND_FAILED");
    });

    test("Audit log records admin ID from session", () => {
        const code = readFile("app/api/admin/orders/[id]/refund/route.ts");
        expect(code).toContain("adminId: session.user.id");
    });

    test("Audit log records refund entity", () => {
        const code = readFile("app/api/admin/orders/[id]/refund/route.ts");
        expect(code).toContain('entityType: "Refund"');
    });

    test("Audit log records amount and metadata", () => {
        const code = readFile("app/api/admin/orders/[id]/refund/route.ts");
        expect(code).toContain("amount: Number(refund.amount)");
        expect(code).toContain("action,");
        expect(code).toContain("reason");
    });

    test("Audit log is fire-and-forget (doesn't block response)", () => {
        const code = readFile("app/api/admin/orders/[id]/refund/route.ts");
        expect(code).toMatch(/createAuditLog\(\{[\s\S]*\.catch/);
    });

    test("Refund route still has authorization check", () => {
        const code = readFile("app/api/admin/orders/[id]/refund/route.ts");
        expect(code).toContain('role !== "ADMIN"');
    });
});

/* ==========================================
 * EXISTING AUDIT-LOGGED ROUTES STILL WORK
 * ========================================== */

describe("M5 — Existing Audit-Logged Routes Preserved", () => {
    test("Affiliate payout route still has audit logging", () => {
        const code = readFile("app/api/admin/affiliate/payouts/[id]/route.ts");
        expect(code).toContain("createAuditLog");
    });

    test("Affiliate applications route still has audit logging", () => {
        const code = readFile("app/api/admin/affiliate/applications/[id]/route.ts");
        expect(code).toContain("createAuditLog");
    });

    test("Payout webhook still has audit logging", () => {
        const code = readFile("app/api/payment/payout/webhook/route.ts");
        expect(code).toContain("createAuditLog");
    });
});

/* ==========================================
 * REGRESSION CHECKS
 * ========================================== */

describe("M5 — No regression to other fixes", () => {
    test("HSTS still present (M3 not broken)", () => {
        const config = readFile("next.config.ts");
        expect(config).toContain("Strict-Transport-Security");
    });

    test("CSP still present (M4 not broken)", () => {
        const config = readFile("next.config.ts");
        expect(config).toContain("Content-Security-Policy");
    });

    test("iPaymu outgoing signature still works (H2 not broken)", async () => {
        const { generateSignature } = await import(
            "@/lib/payment/ipaymu"
        );
        const sig = generateSignature(
            '{"amount":10000}',
            "1179000899",
            "test-key"
        );
        expect(sig).toMatch(/^[a-f0-9]{64}$/);
    });

    test("getClientIp still works (M2 not broken)", async () => {
        const { getClientIp } = await import(
            "@/lib/rate-limit"
        );
        delete process.env.TRUSTED_PROXY;
        const req = new Request("https://example.com", {
            headers: { "x-forwarded-for": "1.2.3.4" },
        });
        expect(getClientIp(req)).toBe("untrusted");
    });
});
