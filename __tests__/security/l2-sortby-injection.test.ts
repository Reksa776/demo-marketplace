/**
 * L2 SECURITY TEST — Unvalidated Dynamic Key in Prisma orderBy
 *
 * Verifies that the admin refunds list route validates the `sortBy`
 * query parameter against a whitelist before passing it to Prisma's
 * orderBy clause.
 *
 * L2 Finding: The admin refunds route accepted any user-supplied
 * string as the sortBy parameter, which was interpolated directly
 * into Prisma's orderBy. While Prisma parameterizes values (no
 * SQL injection), this could:
 *   1. Cause Prisma errors revealing schema information in logs
 *   2. Allow sorting by sensitive internal fields
 *      (processedBy, requestedBy, providerRef)
 *   3. Violate the principle of least privilege for API inputs
 *
 * Fix: Added a whitelist of allowed sort fields with fallback
 * to the default field.
 */

import * as fs from "fs";
import * as path from "path";

function readFile(relPath: string): string {
    return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");
}

describe("L2 — Unvalidated sortBy in Prisma orderBy", () => {
    describe("Admin refunds route sortBy validation", () => {
        test("sortBy is validated against a whitelist of allowed fields", () => {
            const code = readFile("app/api/admin/refunds/route.ts");

            // Must define an array of allowed sort fields
            expect(code).toMatch(/allowedSortFields/);
            expect(code).toMatch(/const\s+allowedSortFields\s*=\s*\[/);

            // Must check if sortBy is in the allowed list
            expect(code).toMatch(/allowedSortFields\.includes/);

            // Must fallback to a safe default when invalid
            expect(code).toMatch(/"createdAt"/);
        });

        test("allowedSortFields contains only safe, non-sensitive columns", () => {
            const code = readFile("app/api/admin/refunds/route.ts");

            // Extract the allowedSortFields array content
            const match = code.match(
                /const\s+allowedSortFields\s*=\s*\[([\s\S]*?)\]/
            );
            expect(match).toBeTruthy();

            const fields = match![1]
                .replace(/["'\s]/g, "")
                .split(",")
                .filter(Boolean);

            // Must only contain safe, user-appropriate sort columns
            expect(fields.length).toBeGreaterThan(0);

            // Must NOT contain sensitive internal fields
            expect(fields).not.toContain("processedBy");
            expect(fields).not.toContain("requestedBy");
            expect(fields).not.toContain("providerRef");
            expect(fields).not.toContain("adminId");
            expect(fields).not.toContain("id");
        });

        test("sortBy uses whitelist fallback, not raw user input", () => {
            const code = readFile("app/api/admin/refunds/route.ts");

            // The actual sortBy variable must be assigned from the
            // whitelist check, not directly from searchParams
            // Pattern: const sortBy = allowedSortFields.includes(raw) ? raw : default
            expect(code).toMatch(
                /allowedSortFields\.includes\(.*\)\s*\?\s*\w+\s*:\s*["']createdAt["']/
            );
        });

        test("rawSortBy intermediate variable captures the raw input", () => {
            const code = readFile("app/api/admin/refunds/route.ts");

            // Should store the raw value before validation
            expect(code).toMatch(/rawSortBy/);

            // rawSortBy must come from searchParams
            expect(code).toMatch(
                /rawSortBy\s*=\s*searchParams\.get\("sortBy"\)/
            );
        });

        test("orderBy still uses the validated sortBy variable", () => {
            const code = readFile("app/api/admin/refunds/route.ts");

            // The orderBy clause must use the validated variable
            expect(code).toMatch(/\[sortBy\]:\s*sortOrder/);
        });
    });

    describe("Cross-cutting: No unsafe sortBy in other admin routes", () => {
        test("admin orders route uses hardcoded orderBy (no user input)", () => {
            const code = readFile("app/api/admin/orders/route.ts");
            // Must NOT have a dynamic sortBy from searchParams
            expect(code).not.toMatch(/searchParams\.get\("sortBy"\)/);
            expect(code).not.toMatch(/searchParams\.get\("sort"\)/);
        });

        test("admin affiliate route uses in-memory sort, not Prisma orderBy", () => {
            const code = readFile("app/api/admin/affiliate/route.ts");
            // The sort parameter is used for in-memory sorting via if/else,
            // not passed directly to Prisma's orderBy
            const match = code.match(/sort\s*===?\s*["'](\w+)["']/g);
            // If sort is used, it should only be in .sort() comparisons
            if (match) {
                expect(code).toMatch(/data\.sort\(/);
            }
        });
    });

    describe("Regression: No L1 error leak introduced", () => {
        test("L2 fix doesn't re-introduce error?.message leak", () => {
            const code = readFile("app/api/admin/refunds/route.ts");
            // The catch block must NOT return error?.message to client
            expect(code).not.toMatch(/message:\s*error\?\.message/);
        });
    });
});
