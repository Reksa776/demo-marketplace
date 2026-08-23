/**
 * ==========================================
 * NOTIFICATION QUEUE
 * ==========================================
 *
 * Simple in-memory queue untuk Phase 1.
 *
 * Limitations:
 * - Jobs hilang jika server restart
 * - Tidak ada persistence
 * - Tidak ada distributed processing
 *
 * Untuk production, gunakan:
 * - BullMQ + Redis
 * - Atau database-backed queue
 *
 * Phase 1: in-memory cukup untuk
 * testing dan development.
 */

type QueueJob = {
    id: string;
    payload: unknown;
    attempt: number;
    maxAttempts: number;
    delayMs: number;
    enqueuedAt: Date;
};

type ProcessFunction<T> = (
    payload: T
) => Promise<void>;

type QueueOptions = {
    /**
     * Delay antar job dalam ms.
     * Default: 100ms
     */
    processingDelayMs?: number;

    /**
     * Max concurrent jobs.
     * Default: 1
     */
    concurrency?: number;
};

export class NotificationQueue {
    private queue: QueueJob[] = [];
    private processing = false;
    private processFn: ProcessFunction<any> | null = null;
    private options: Required<QueueOptions>;
    private jobCounter = 0;

    constructor(options: QueueOptions = {}) {
        this.options = {
            processingDelayMs:
                options.processingDelayMs ?? 100,
            concurrency: options.concurrency ?? 1,
        };
    }

    /**
     * Register handler untuk memproses job.
     */
    onProcess<T>(
        fn: ProcessFunction<T>
    ): void {
        this.processFn = fn;
    }

    /**
     * Tambah job ke queue.
     *
     * Job akan diproses secara async
     * oleh worker loop.
     */
    enqueue<T>(
        payload: T,
        options?: {
            delayMs?: number;
            maxAttempts?: number;
        }
    ): string {
        this.jobCounter++;

        const jobId = `job_${Date.now()}_${this.jobCounter}`;

        const job: QueueJob = {
            id: jobId,
            payload,
            attempt: 1,
            maxAttempts: options?.maxAttempts ?? 3,
            delayMs: options?.delayMs ?? 0,
            enqueuedAt: new Date(),
        };

        this.queue.push(job);

        console.log(
            `[QUEUE] Job ${jobId} enqueued | ` +
                `Queue size: ${this.queue.length}`
        );

        /**
         * Trigger processing loop.
         */
        this.scheduleProcessing();

        return jobId;
    }

    /**
     * Mulai processing loop.
     */
    private scheduleProcessing(): void {
        if (this.processing) {
            return;
        }

        this.processing = true;
        this.processNext();
    }

    /**
     * Proses job berikutnya.
     */
    private async processNext(): Promise<void> {
        if (this.queue.length === 0) {
            this.processing = false;
            return;
        }

        if (!this.processFn) {
            this.processing = false;
            return;
        }

        const job = this.queue.shift();

        if (!job) {
            this.processing = false;
            return;
        }

        /**
         * Skip delayed jobs — put back to queue.
         */
        const elapsed =
            Date.now() - job.enqueuedAt.getTime();

        if (elapsed < job.delayMs) {
            this.queue.unshift(job);
            setTimeout(
                () => this.processNext(),
                job.delayMs - elapsed
            );
            return;
        }

        try {
            console.log(
                `[QUEUE] Processing job ${job.id} | ` +
                    `Attempt ${job.attempt}/${job.maxAttempts}`
            );

            await this.processFn(job.payload);

            console.log(
                `[QUEUE] Job ${job.id} completed`
            );
        } catch (error) {
            console.error(
                `[QUEUE] Job ${job.id} failed:`,
                error
            );

            /**
             * Retry if we haven't exceeded max attempts.
             */
            if (job.attempt < job.maxAttempts) {
                job.attempt++;

                /**
                 * Exponential backoff:
                 * attempt 2 → 1s
                 * attempt 3 → 2s
                 */
                const backoffMs =
                    1000 * Math.pow(2, job.attempt - 2);

                job.delayMs = backoffMs;

                this.queue.push(job);

                console.log(
                    `[QUEUE] Job ${job.id} will retry in ${backoffMs}ms | ` +
                        `Attempt ${job.attempt}/${job.maxAttempts}`
                );
            } else {
                console.error(
                    `[QUEUE] Job ${job.id} permanently failed after ${job.maxAttempts} attempts`
                );
            }
        }

        /**
         * Schedule next job.
         */
        setTimeout(
            () => this.processNext(),
            this.options.processingDelayMs
        );
    }

    /**
     * Get queue size.
     */
    get size(): number {
        return this.queue.length;
    }

    /**
     * Get pending jobs count.
     */
    get pending(): number {
        return this.queue.filter(
            (j) => j.delayMs <= 0
        ).length;
    }
}

/**
 * Singleton queue instance.
 * Digunakan di seluruh aplikasi.
 */
let globalQueue: NotificationQueue | null = null;

export function getNotificationQueue(): NotificationQueue {
    if (!globalQueue) {
        globalQueue = new NotificationQueue({
            processingDelayMs: 100,
            concurrency: 1,
        });
    }

    return globalQueue;
}
