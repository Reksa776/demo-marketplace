// lib/fetchWithRetry.ts
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  { retries = 3, timeoutMs = 8000, delayMs = 500 } = {}
) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;

      // jangan retry kalau bukan network error (misal abort karena user cancel)
      const isNetworkError =
        err instanceof TypeError ||
        (err as any)?.cause?.code === "ETIMEDOUT" ||
        (err as any)?.cause?.code === "ECONNRESET";

      if (!isNetworkError || attempt === retries) break;

      await new Promise((r) => setTimeout(r, delayMs * (attempt + 1)));
    }
  }

  throw lastError;
}