/**
 * ==========================================
 * F26: BROADCAST IN-MEMORY QUEUE REMEDIATION
 * ==========================================
 *
 * Verifies the broadcast send flow now goes through the in-memory
 * NotificationQueue instead of blocking the HTTP request:
 *
 *  1. Send route pre-checks status (confirm-guard) BEFORE enqueueing.
 *  2. Send route returns immediately (queued: true) instead of awaiting
 *     the full send (which could block requests for minutes on large
 *     audiences due to 500ms/message rate-limit protection).
 *  3. A background worker (registered once) drains the queue and calls
 *     `sendBroadcast`, whose atomic CAS prevents duplicate sends.
 *  4. Behavioral check: the queue actually drains N jobs sequentially.
 *
 * Run: npx jest __tests__/p0/f26-queue-remediation.test.ts
 */

import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "fs";
import { resolve } from "path";
import { NotificationQueue } from "@/lib/notification/queue";

const repoRoot = process.cwd();

function readRepo(relativePath: string): string {
    return readFileSync(resolve(repoRoot, relativePath), "utf-8");
}

describe("F26: broadcast in-memory queue", () => {
    const sendRoute = readRepo("app/api/admin/broadcasts/[id]/send/route.ts");
    const broadcastCode = readRepo("lib/marketing/broadcast.ts");

    it("registers the broadcast worker on the queue", () => {
        expect(sendRoute).toContain("registerBroadcastQueueWorker");
        expect(broadcastCode).toContain("export function registerBroadcastQueueWorker");
        expect(broadcastCode).toContain("onProcess");
        expect(broadcastCode).toContain("await sendBroadcast");
    });

    it("no longer awaits sendBroadcast synchronously inside the request", () => {
        expect(sendRoute).not.toMatch(/await\s+sendBroadcast\s*\(/);
        expect(sendRoute).toMatch(/getNotificationQueue\(\)\.enqueue/);
    });

    it("returns immediately with queued acknowledgment", () => {
        expect(sendRoute).toContain('queued: true');
        expect(sendRoute).toContain("Proses pengiriman berjalan di latar belakang");
    });

    it("confirm-guards status before enqueueing (only DRAFT/SCHEDULED)", () => {
        expect(sendRoute).toContain("broadcast.status !== \"DRAFT\"");
        expect(sendRoute).toContain("SCHEDULED");
        expect(sendRoute).toContain("{ status: 409 }");
    });

    it("keeps the atomic CAS (dedupe) inside sendBroadcast", () => {
        expect(broadcastCode).toContain("$executeRaw");
        expect(broadcastCode).toContain("AND status IN ('DRAFT', 'SCHEDULED')");
    });
});

describe("F26: queue drains jobs (behavioral)", () => {
    function delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function waitFor(
        cond: () => boolean,
        timeoutMs = 3000
    ): Promise<void> {
        const start = Date.now();
        while (!cond()) {
            if (Date.now() - start > timeoutMs) {
                throw new Error("Timed out waiting for queue to drain");
            }
            await delay(10);
        }
    }

    it("drains N jobs sequentially in FIFO order", async () => {
        const seen: number[] = [];
        const queue = new NotificationQueue({
            processingDelayMs: 0,
            concurrency: 1,
        });

        queue.onProcess<{ broadcastId: number }>(async (payload) => {
            await delay(20);
            seen.push(payload.broadcastId);
        });

        queue.enqueue({ broadcastId: 1 }, { maxAttempts: 1 });
        queue.enqueue({ broadcastId: 2 }, { maxAttempts: 1 });
        queue.enqueue({ broadcastId: 3 }, { maxAttempts: 1 });

        await waitFor(() => queue.size === 0 && seen.length === 3);

        expect(seen).toEqual([1, 2, 3]);
    });

    it("does not process payloads if no worker is registered", async () => {
        const queue = new NotificationQueue({
            processingDelayMs: 0,
            concurrency: 1,
        });

        queue.enqueue({ broadcastId: 99 }, { maxAttempts: 1 });

        await delay(100);

        expect(queue.size).toBe(1);
        expect(queue.pending).toBe(1);
    });
});