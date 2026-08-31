/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/$1",
    },
    testMatch: [
        "**/__tests__/ipaymu/*.test.ts",
        "**/__tests__/marketing/*.test.ts",
        "!**/__tests__/marketing/pricing-engine.test.ts",
        "**/__tests__/p0/*.test.ts",
        "**/__tests__/order-refund/*.test.ts",
        "**/__tests__/security/*.test.ts",
    ],
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: "tsconfig.json",
            },
        ],
    },
};
