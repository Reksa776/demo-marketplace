const BASE_URL =
    process.env.RAJAONGKIR_BASE_URL ||
    "https://rajaongkir.komerce.id/api/v1";

const API_KEY = process.env.RAJAONGKIR_API_KEY;

type RajaOngkirResponse<T = unknown> = {
    meta?: {
        message?: string;
        code?: number;
        status?: string;
    };
    data?: T;
};

export async function calculateDomesticCost({
    origin,
    destination,
    weight,
    courier,
}: {
    origin: number;
    destination: number;
    weight: number;
    courier?: string;
}) {
    if (!API_KEY) {
        throw new Error(
            "RAJAONGKIR_API_KEY belum diatur."
        );
    }

    const form = new URLSearchParams();

    form.append("origin", String(origin));
    form.append("destination", String(destination));
    form.append("weight", String(weight));
    form.append(
        "courier",
        courier ||
            "jne:sicepat:ide:sap:jnt:ninja:tiki:lion:anteraja:pos:ncs:rex:rpx:sentral:star:wahana:dse"
    );
    form.append("price", "lowest");

    const response = await fetch(
        `${BASE_URL}/calculate/domestic-cost`,
        {
            method: "POST",
            headers: {
                key: API_KEY,
                "Content-Type":
                    "application/x-www-form-urlencoded",
            },
            body: form.toString(),
            cache: "no-store",
        }
    );

    const text = await response.text();

    let json: RajaOngkirResponse;

    try {
        json = JSON.parse(text);
    } catch {
        console.error(
            "RAJAONGKIR RESPONSE:",
            text
        );

        throw new Error(
            "Response RajaOngkir bukan JSON."
        );
    }

    if (!response.ok) {
        throw new Error(
            json.meta?.message ||
                "Gagal mengambil ongkir."
        );
    }

    if (
        json.meta?.code &&
        json.meta.code >= 400
    ) {
        throw new Error(
            json.meta.message ||
                "Gagal mengambil ongkir."
        );
    }

    return json.data;
}