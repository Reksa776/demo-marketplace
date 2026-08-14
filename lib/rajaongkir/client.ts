// lib/rajaongkir/client.ts

const RAJAONGKIR_BASE_URL =
    process.env.RAJAONGKIR_BASE_URL ||
    "https://rajaongkir.komerce.id/api/v1";

const RAJAONGKIR_API_KEY = process.env.RAJAONGKIR_API_KEY;

if (!RAJAONGKIR_API_KEY) {
    console.warn("RAJAONGKIR_API_KEY belum diset");
}

export async function rajaOngkirFetch<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const response = await fetch(
        `${RAJAONGKIR_BASE_URL}${endpoint}`,
        {
            ...options,
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                key: RAJAONGKIR_API_KEY || "",
                ...options.headers,
            },
            cache: "no-store",
        }
    );

    if (!response.ok) {
        const errorText = await response.text();

        throw new Error(
            `RajaOngkir API Error ${response.status}: ${errorText}`
        );
    }

    const data = await response.json();

    return data;
}