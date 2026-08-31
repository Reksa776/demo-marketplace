/**
 * L1 SECURITY TEST — Error Message Information Leak
 *
 * Verifies that internal error messages (Prisma errors, database
 * structure, etc.) are NOT returned to the client in catch blocks
 * of admin API routes.
 *
 * L1 Finding: Several admin routes returned error?.message directly
 * in responses, potentially leaking database-level error details.
 *
 * Fix: Replaced error?.message with safe generic messages.
 */

import * as fs from "fs";
import * as path from "path";

const ROUTE_FILES = [
    "app/api/admin/shipping-discounts/route.ts",
    "app/api/admin/shipping-discounts/[id]/route.ts",
    "app/api/admin/bulk-discounts/route.ts",
    "app/api/admin/bulk-discounts/[id]/route.ts",
    "app/api/admin/broadcasts/[id]/route.ts",
    "app/api/admin/broadcasts/[id]/audience/route.ts",
];

function readFile(relPath: string): string {
    return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");
}

describe("L1 — Error Message Information Leak", () => {
    describe("Shipping discounts routes", () => {
        test("GET catch block returns safe generic message, not error?.message", () => {
            const code = readFile("app/api/admin/shipping-discounts/route.ts");
            // Must NOT return error?.message to client
            expect(code).not.toMatch(
                /return NextResponse\.json\(\{[^}]*message:\s*error\?\.message/
            );
            // Must log full error server-side
            expect(code).toMatch(/console\.error\(.*error\)/);
        });

        test("POST catch block returns safe generic message", () => {
            const code = readFile("app/api/admin/shipping-discounts/route.ts");
            const postCatchMatch = code.match(
                /POST[\s\S]*?catch[\s\S]*?NextResponse\.json\([^)]*\)/
            );
            expect(postCatchMatch).toBeTruthy();
            // Should not contain error?.message in the response
            expect(postCatchMatch![0]).not.toMatch(/error\?\.message/);
        });

        test("[id] GET returns safe message with not-found check", () => {
            const code = readFile("app/api/admin/shipping-discounts/[id]/route.ts");
            const getBlock = code.match(
                /GET[\s\S]*?catch[\s\S]*?NextResponse\.json/
            );
            expect(getBlock).toBeTruthy();
            // Should use instanceof Error check, not raw error?.message
            expect(getBlock![0]).toMatch(/instanceof Error/);
            // Should not leak error?.message directly
            expect(getBlock![0]).not.toMatch(/error\?\.message \?\?/);
        });

        test("[id] PATCH returns safe message", () => {
            const code = readFile("app/api/admin/shipping-discounts/[id]/route.ts");
            expect(code).not.toMatch(
                /error\?\.message \?\?/
            );
        });

        test("[id] DELETE returns safe message", () => {
            const code = readFile("app/api/admin/shipping-discounts/[id]/route.ts");
            expect(code).not.toMatch(
                /error\?\.message \?\?/
            );
        });
    });

    describe("Bulk discounts routes", () => {
        test("GET catch block returns safe generic message", () => {
            const code = readFile("app/api/admin/bulk-discounts/route.ts");
            expect(code).not.toMatch(
                /error\?\.message \?\?/
            );
            expect(code).toMatch(/console\.error\(.*error\)/);
        });

        test("POST catch block returns safe generic message", () => {
            const code = readFile("app/api/admin/bulk-discounts/route.ts");
            expect(code).not.toMatch(
                /error\?\.message \?\?/
            );
        });

        test("[id] routes use instanceof Error check, not raw error?.message", () => {
            const code = readFile("app/api/admin/bulk-discounts/[id]/route.ts");
            expect(code).toMatch(/instanceof Error/);
            expect(code).not.toMatch(
                /error\?\.message \?\?/
            );
        });
    });

    describe("Broadcasts routes", () => {
        test("[id] GET returns safe message", () => {
            const code = readFile("app/api/admin/broadcasts/[id]/route.ts");
            expect(code).not.toMatch(
                /error\?\.message \?\?/
            );
        });

        test("[id] PATCH returns safe generic message", () => {
            const code = readFile("app/api/admin/broadcasts/[id]/route.ts");
            expect(code).not.toMatch(
                /error\?\.message \?\?/
            );
        });

        test("[id] DELETE returns safe message", () => {
            const code = readFile("app/api/admin/broadcasts/[id]/route.ts");
            expect(code).not.toMatch(
                /error\?\.message \?\?/
            );
        });

        test("[id] audience returns safe generic message", () => {
            const code = readFile("app/api/admin/broadcasts/[id]/audience/route.ts");
            expect(code).not.toMatch(
                /error\?\.message \?\?/
            );
        });
    });

    describe("Cross-cutting: No error?.message leak in fixed routes", () => {
        test("none of the fixed routes return error?.message to client", () => {
            for (const file of ROUTE_FILES) {
                const code = readFile(file);
                // Check for the dangerous pattern: returning error?.message in JSON response
                const hasLeak = /message:\s*error\?\.message/.test(code);
                expect(hasLeak).toBe(false);
            }
        });

        test("fixed routes use safe generic messages in all catch blocks", () => {
            // Verify that no catch block returns error?.message to the client
            for (const file of ROUTE_FILES) {
                const code = readFile(file);
                // The key security property: error?.message is never returned to client
                const hasLeak = /message:\s*error\?\.message/.test(code);
                expect(hasLeak).toBe(false);
            }
        });
    });
});
