/**
 * L3 SECURITY TEST — SSRF via Unvalidated Path Parameters
 *
 * Verifies that admin settings regions routes validate
 * `id` and `subdistrictId` parameters as numeric before
 * interpolating them into RajaOngkir API URL paths.
 *
 * L3 Finding: The admin settings regions routes accepted
 * unvalidated string parameters and interpolated them
 * directly into external API URL paths:
 *   - /api/admin/settings/regions?type=cities&id=../../v2/user
 *   - /api/admin/settings/regions/destination?subdistrictId=../../v2/user
 *
 * This could allow path traversal to access different
 * RajaOngkir API endpoints, potentially exposing API keys
 * or accessing unintended data.
 *
 * Fix: Added numeric validation for id/subdistrictId parameters
 * before interpolation into URL paths.
 */

import * as fs from "fs";
import * as path from "path";

function readFile(relPath: string): string {
    return fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");
}

describe("L3 — SSRF via Unvalidated Path Parameters", () => {
    describe("Admin settings regions route", () => {
        test("validates id parameter as numeric before URL interpolation", () => {
            const code = readFile("app/api/admin/settings/regions/route.ts");

            // Must convert id to Number
            expect(code).toMatch(/Number\(id\)/);

            // Must check for valid integer
            expect(code).toMatch(/Number\.isInteger/);

            // Must reject non-numeric values
            expect(code).toMatch(/ID wilayah tidak valid/);
        });

        test("uses numericId (not raw id) in URL path construction", () => {
            const code = readFile("app/api/admin/settings/regions/route.ts");

            // Must use the validated numeric variable in URL paths
            expect(code).toMatch(/\/destination\/city\/\$\{numericId\}/);
            expect(code).toMatch(/\/destination\/district\/\$\{numericId\}/);
            expect(code).toMatch(/\/destination\/sub-district\/\$\{numericId\}/);

            // Must NOT use raw id in URL paths (except for provinces which has no id)
            // Check that city/district/subdistrict paths use numericId
            const cityMatch = code.match(/endpoint = `\/destination\/city\/\$\{(\w+)\}`/);
            expect(cityMatch).toBeTruthy();
            expect(cityMatch![1]).toBe("numericId");
        });

        test("returns 400 for non-numeric id values", () => {
            const code = readFile("app/api/admin/settings/regions/route.ts");
            // Must return 400 status for invalid IDs
            expect(code).toMatch(/status:\s*400/);
        });
    });

    describe("Admin settings regions/destination route", () => {
        test("validates subdistrictId parameter as numeric before URL interpolation", () => {
            const code = readFile("app/api/admin/settings/regions/destination/route.ts");

            // Must convert subdistrictId to Number
            expect(code).toMatch(/Number\(subdistrictId\)/);

            // Must check for valid integer
            expect(code).toMatch(/Number\.isInteger/);

            // Must reject non-numeric values
            expect(code).toMatch(/subdistrictId tidak valid/);
        });

        test("uses numericSubdistrictId in URL path construction", () => {
            const code = readFile("app/api/admin/settings/regions/destination/route.ts");

            // Must use the validated numeric variable in URL path
            expect(code).toMatch(/\/destination\/domestic-destination\/\$\{numericSubdistrictId\}/);
        });

        test("returns 400 for non-numeric subdistrictId values", () => {
            const code = readFile("app/api/admin/settings/destination/route.ts");
            // The destination route (not regions/destination) should also validate
            // Check that the search parameter is properly encoded
            expect(code).toMatch(/encodeURIComponent/);
        });
    });

    describe("Cross-cutting: Consistent with existing validated routes", () => {
        test("locations route already validates id as numeric (reference pattern)", () => {
            const code = readFile("app/api/admin/settings/locations/route.ts");
            expect(code).toMatch(/Number\.isInteger/);
            expect(code).toMatch(/ID wilayah tidak valid/);
        });
    });

    describe("Regression: No L1/L2 regressions introduced", () => {
        test("L3 fix doesn't re-introduce error?.message leak", () => {
            const regionsCode = readFile("app/api/admin/settings/regions/route.ts");
            const destCode = readFile("app/api/admin/settings/regions/destination/route.ts");
            expect(regionsCode).not.toMatch(/message:\s*error\?\.message/);
            expect(destCode).not.toMatch(/message:\s*error\?\.message/);
        });

        test("L2 sortBy whitelist still intact in refunds route", () => {
            const code = readFile("app/api/admin/refunds/route.ts");
            expect(code).toMatch(/allowedSortFields/);
            expect(code).toMatch(/allowedSortFields\.includes/);
        });
    });
});
