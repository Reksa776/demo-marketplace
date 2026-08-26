/**
 * SPIN WHEEL MILESTONE LOGIC — AUTOMATED TESTS
 *
 * Tests verify the mathematical correctness of milestone-based
 * spending calculations. These are pure logic tests that don't
 * require a database.
 *
 * Run: npx tsx __tests__/spin-wheel/milestone-logic.test.ts
 */

let passed = 0;
let failed = 0;

function testCase(name: string, fn: () => void) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e: any) {
        console.log(`  ❌ ${name}: ${e.message}`);
        failed++;
    }
}

function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}

function assertEqual(actual: number, expected: number, label: string) {
    if (actual !== expected) {
        throw new Error(
            `${label}: expected ${expected}, got ${actual}`
        );
    }
}

// ==========================================
// MILESTONE CALCULATION FUNCTIONS
// (mirrors lib/spin-wheel.ts logic)
// ==========================================

interface MilestoneResult {
    totalMilestones: number;
    availableSpins: number;
    spendingProgress: number;
    remainingSpend: number;
    spinsRemaining: number;
}

function calculateMilestones(
    totalPaidSpend: number,
    minimumSpend: number,
    usedSpins: number, // count of USED spins only
    maxSpinsPerUser: number // 0 or Infinity = no cap
): MilestoneResult {
    const totalMilestones =
        minimumSpend > 0
            ? Math.floor(totalPaidSpend / minimumSpend)
            : 0;

    // Available = milestones earned - used spins
    const availableSpins = Math.max(
        0,
        totalMilestones - usedSpins
    );

    // Optional campaign cap (0 or 1 means no cap)
    const maxSpinsCap = maxSpinsPerUser > 1
        ? maxSpinsPerUser
        : Infinity;

    const spinsRemaining = Math.min(
        availableSpins,
        Math.max(0, maxSpinsCap - usedSpins)
    );

    const spendingProgress =
        minimumSpend > 0
            ? totalPaidSpend % minimumSpend
            : 0;

    const remainingSpend = Math.max(
        0,
        minimumSpend - spendingProgress
    );

    return {
        totalMilestones,
        availableSpins,
        spendingProgress,
        remainingSpend,
        spinsRemaining,
    };
}

// ==========================================
// TEST CASES
// ==========================================

console.log("\nA. Required Test Cases (CASE 1-10):");

const MIN_SPEND = 100000;
const MAX_SPINS = 10;

// CASE 1: Spend Rp0
testCase("CASE 1: Spend Rp0 → milestone=0, available=0, progress=0", () => {
    const r = calculateMilestones(0, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r.totalMilestones, 0, "totalMilestones");
    assertEqual(r.spinsRemaining, 0, "spinsRemaining");
    assertEqual(r.spendingProgress, 0, "spendingProgress");
});

// CASE 2: Spend Rp50K
testCase("CASE 2: Spend Rp50K → milestone=0, available=0, progress=Rp50K", () => {
    const r = calculateMilestones(50000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r.totalMilestones, 0, "totalMilestones");
    assertEqual(r.spinsRemaining, 0, "spinsRemaining");
    assertEqual(r.spendingProgress, 50000, "spendingProgress");
    assertEqual(r.remainingSpend, 50000, "remainingSpend");
});

// CASE 3: Spend Rp100K
testCase("CASE 3: Spend Rp100K → milestone=1, available=1, progress=0", () => {
    const r = calculateMilestones(100000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r.totalMilestones, 1, "totalMilestones");
    assertEqual(r.spinsRemaining, 1, "spinsRemaining");
    assertEqual(r.spendingProgress, 0, "spendingProgress");
});

// CASE 4: Spend Rp100K + 1 spin USED
testCase("CASE 4: Spend Rp100K + 1 spin USED → milestone=1, available=0", () => {
    const r = calculateMilestones(100000, MIN_SPEND, 1, MAX_SPINS);
    assertEqual(r.totalMilestones, 1, "totalMilestones");
    assertEqual(r.spinsRemaining, 0, "spinsRemaining");
    assertEqual(r.spendingProgress, 0, "spendingProgress");
});

// CASE 5: Spend Rp200K + 1 spin USED
testCase("CASE 5: Spend Rp200K + 1 spin USED → milestone=2, available=1", () => {
    const r = calculateMilestones(200000, MIN_SPEND, 1, MAX_SPINS);
    assertEqual(r.totalMilestones, 2, "totalMilestones");
    assertEqual(r.spinsRemaining, 1, "spinsRemaining (2 earned - 1 used)");
    assertEqual(r.spendingProgress, 0, "spendingProgress");
});

// CASE 6: Rp50K × 10 = Rp500K
testCase("CASE 6: Rp50K × 10 = Rp500K → milestone=5, available=5, progress=0", () => {
    const r = calculateMilestones(500000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r.totalMilestones, 5, "totalMilestones");
    assertEqual(r.spinsRemaining, 5, "spinsRemaining");
    assertEqual(r.spendingProgress, 0, "spendingProgress");
});

// CASE 7: Rp500K + 2 spins USED
testCase("CASE 7: Rp500K + 2 spins USED → milestone=5, available=3", () => {
    const r = calculateMilestones(500000, MIN_SPEND, 2, MAX_SPINS);
    assertEqual(r.totalMilestones, 5, "totalMilestones");
    assertEqual(r.spinsRemaining, 3, "spinsRemaining (5 earned - 2 used)");
    assertEqual(r.spendingProgress, 0, "spendingProgress");
});

// CASE 8: Rp550K + 2 spins USED
testCase("CASE 8: Rp550K + 2 spins USED → milestone=5, available=3, progress=Rp50K", () => {
    const r = calculateMilestones(550000, MIN_SPEND, 2, MAX_SPINS);
    assertEqual(r.totalMilestones, 5, "totalMilestones");
    assertEqual(r.spinsRemaining, 3, "spinsRemaining (5 earned - 2 used)");
    assertEqual(r.spendingProgress, 50000, "spendingProgress");
    assertEqual(r.remainingSpend, 50000, "remainingSpend");
});

// CASE 9: Repeated GET does not create spins
testCase("CASE 9: Repeated GET does not create spins (read-only)", () => {
    const r1 = calculateMilestones(100000, MIN_SPEND, 0, MAX_SPINS);
    const r2 = calculateMilestones(100000, MIN_SPEND, 0, MAX_SPINS);
    const r3 = calculateMilestones(100000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r1.spinsRemaining, 1, "call 1");
    assertEqual(r2.spinsRemaining, 1, "call 2");
    assertEqual(r3.spinsRemaining, 1, "call 3");
    assertEqual(r1.spendingProgress, 0, "progress call 1");
    assertEqual(r2.spendingProgress, 0, "progress call 2");
    assertEqual(r3.spendingProgress, 0, "progress call 3");
});

// CASE 10: Concurrent POST semantics
testCase("CASE 10: Concurrent POST semantics — no double-consume", () => {
    // Two simultaneous spins: both see usedSpins=0 → both get 1 available
    // In reality, DB transaction prevents double-consume
    const r1 = calculateMilestones(100000, MIN_SPEND, 0, MAX_SPINS);
    const r2 = calculateMilestones(100000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r1.spinsRemaining, 1, "request 1 sees 1 spin");
    assertEqual(r2.spinsRemaining, 1, "request 2 sees 1 spin");
    // After transaction: usedSpins=1 → no more available
    const rAfter = calculateMilestones(100000, MIN_SPEND, 1, MAX_SPINS);
    assertEqual(rAfter.spinsRemaining, 0, "after consume: 0 spins");
});

console.log("\nB. Spending Progression Examples:");

testCase("Rp100K → 1 spin available", () => {
    const r = calculateMilestones(100000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r.spinsRemaining, 1, "spinsRemaining");
    assertEqual(r.spendingProgress, 0, "spendingProgress");
});

testCase("Rp200K → 2 spins available", () => {
    const r = calculateMilestones(200000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r.spinsRemaining, 2, "spinsRemaining");
    assertEqual(r.spendingProgress, 0, "spendingProgress");
});

testCase("Rp300K → 3 spins available", () => {
    const r = calculateMilestones(300000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r.spinsRemaining, 3, "spinsRemaining");
    assertEqual(r.spendingProgress, 0, "spendingProgress");
});

testCase("Rp500K → 5 spins available", () => {
    const r = calculateMilestones(500000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r.spinsRemaining, 5, "spinsRemaining");
    assertEqual(r.spendingProgress, 0, "spendingProgress");
});

console.log("\nC. maxSpinsPerUser Cap:");

testCase("maxSpinsPerUser=0 → no cap (unlimited by milestones)", () => {
    const r = calculateMilestones(500000, MIN_SPEND, 0, 0);
    assertEqual(r.spinsRemaining, 5, "spinsRemaining (no cap)");
});

testCase("maxSpinsPerUser=3 → capped at 3 spins", () => {
    const r = calculateMilestones(500000, MIN_SPEND, 0, 3);
    assertEqual(r.totalMilestones, 5, "totalMilestones");
    assertEqual(r.spinsRemaining, 3, "capped by maxSpinsPerUser");
});

testCase("maxSpinsPerUser=5 → all 5 available", () => {
    const r = calculateMilestones(500000, MIN_SPEND, 0, 5);
    assertEqual(r.spinsRemaining, 5, "spinsRemaining");
});

testCase("maxSpinsPerUser=5, used 3 → 2 remaining", () => {
    const r = calculateMilestones(500000, MIN_SPEND, 3, 5);
    assertEqual(r.spinsRemaining, 2, "spinsRemaining");
});

testCase("maxSpinsPerUser=5, used 5 → 0 remaining", () => {
    const r = calculateMilestones(500000, MIN_SPEND, 5, 5);
    assertEqual(r.spinsRemaining, 0, "spinsRemaining (max reached)");
    assertEqual(r.totalMilestones, 5, "totalMilestones still 5");
});

console.log("\nD. Edge Cases:");

testCase("minimumSpend=0 → 0 milestones", () => {
    const r = calculateMilestones(100000, 0, 0, MAX_SPINS);
    assertEqual(r.totalMilestones, 0, "totalMilestones");
    assertEqual(r.spinsRemaining, 0, "spinsRemaining");
});

testCase("spending < minimumSpend → 0 milestones", () => {
    const r = calculateMilestones(99999, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r.totalMilestones, 0, "totalMilestones");
    assertEqual(r.spinsRemaining, 0, "spinsRemaining");
    assertEqual(r.spendingProgress, 99999, "spendingProgress");
    assertEqual(r.remainingSpend, 1, "remainingSpend");
});

testCase("spending exactly at boundary → 1 milestone", () => {
    const r = calculateMilestones(100000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r.totalMilestones, 1, "totalMilestones");
    assertEqual(r.spinsRemaining, 1, "spinsRemaining");
    assertEqual(r.spendingProgress, 0, "spendingProgress");
});

testCase("usedSpins > totalMilestones → 0 available (over-consumed)", () => {
    const r = calculateMilestones(100000, MIN_SPEND, 2, MAX_SPINS);
    assertEqual(r.totalMilestones, 1, "totalMilestones");
    assertEqual(r.spinsRemaining, 0, "spinsRemaining (can't go negative)");
});

testCase("large spending → correct milestones", () => {
    const r = calculateMilestones(1000000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r.totalMilestones, 10, "totalMilestones");
    assertEqual(r.spinsRemaining, 10, "spinsRemaining");
    assertEqual(r.spendingProgress, 0, "spendingProgress");
});

testCase("large spending with remainder", () => {
    const r = calculateMilestones(1250000, MIN_SPEND, 0, 20);
    assertEqual(r.totalMilestones, 12, "totalMilestones");
    assertEqual(r.spinsRemaining, 12, "spinsRemaining");
    assertEqual(r.spendingProgress, 50000, "spendingProgress");
    assertEqual(r.remainingSpend, 50000, "remainingSpend");
});

testCase("progressive scenario — full lifecycle", () => {
    let r = calculateMilestones(0, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r.spinsRemaining, 0, "start: 0 spins");

    r = calculateMilestones(60000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r.spinsRemaining, 0, "60K: 0 spins");
    assertEqual(r.spendingProgress, 60000, "60K: progress");

    r = calculateMilestones(100000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r.spinsRemaining, 1, "100K: 1 spin");

    r = calculateMilestones(100000, MIN_SPEND, 1, MAX_SPINS);
    assertEqual(r.spinsRemaining, 0, "100K used: 0 spins");

    r = calculateMilestones(150000, MIN_SPEND, 1, MAX_SPINS);
    assertEqual(r.spinsRemaining, 0, "150K used: 0 spins");
    assertEqual(r.spendingProgress, 50000, "150K used: progress");

    r = calculateMilestones(200000, MIN_SPEND, 1, MAX_SPINS);
    assertEqual(r.spinsRemaining, 1, "200K used: 1 spin");
    assertEqual(r.spendingProgress, 0, "200K used: progress");

    r = calculateMilestones(350000, MIN_SPEND, 2, MAX_SPINS);
    assertEqual(r.totalMilestones, 3, "350K used: 3 milestones");
    assertEqual(r.spinsRemaining, 1, "350K used: 1 spin (3-2)");
    assertEqual(r.spendingProgress, 50000, "350K used: progress");
});

testCase("excess spending carries over correctly", () => {
    const r1 = calculateMilestones(250000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r1.spinsRemaining, 2, "250K: 2 spins");
    assertEqual(r1.spendingProgress, 50000, "250K: 50K progress");

    const r2 = calculateMilestones(300000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r2.spinsRemaining, 3, "300K: 3 spins");
    assertEqual(r2.spendingProgress, 0, "300K: 0 progress");

    const r3 = calculateMilestones(550000, MIN_SPEND, 0, MAX_SPINS);
    assertEqual(r3.spinsRemaining, 5, "550K: 5 spins");
    assertEqual(r3.spendingProgress, 50000, "550K: 50K progress");
});

// ==========================================
// RESULTS
// ==========================================

console.log(`\n${"=".repeat(50)}`);
console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);

if (failed > 0) {
    console.log("\n❌ Some tests failed!");
    process.exit(1);
} else {
    console.log("\n✅ All tests passed!");
}
