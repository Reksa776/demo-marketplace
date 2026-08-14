import { fetchWithRetry } from "./fetchWithRetry";

const RAJAONGKIR_BASE_URL =
    process.env.RAJAONGKIR_BASE_URL ||
    "https://rajaongkir.komerce.id/api/v1";

const RAJAONGKIR_API_KEY =
    process.env.RAJAONGKIR_API_KEY;

type RajaOngkirResponse<T = unknown> = {
    meta?: {
        message?: string;
        code?: number;
        status?: string;
    };
    data?: T;
};

export async function rajaOngkirFetch<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    if (!RAJAONGKIR_API_KEY) {
        throw new Error(
            "RAJAONGKIR_API_KEY belum diatur."
        );
    }

    const response = await fetchWithRetry(
        `${RAJAONGKIR_BASE_URL}${endpoint}`,
        {
            ...options,
            headers: {
                "Content-Type": "application/json",
                key: RAJAONGKIR_API_KEY,
                ...(options.headers || {}),
            },
            cache: "no-store",
        }
    );

    const text = await response.text();

    let json: RajaOngkirResponse<T>;

    try {
        json = JSON.parse(text);
    } catch {
        throw new Error(
            "Response RajaOngkir bukan JSON."
        );
    }

    if (!response.ok) {
        throw new Error(
            json.meta?.message ||
                "Request RajaOngkir gagal."
        );
    }

    if (
        json.meta?.code &&
        json.meta.code >= 400
    ) {
        throw new Error(
            json.meta.message ||
                "Request RajaOngkir gagal."
        );
    }

    return json.data as T;
}