"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

type Address = {
    id: string;

    label: string | null;

    recipientName: string;

    phone: string;

    address: string;

    province: string | null;
    city: string | null;
    district: string | null;
    subdistrict: string | null;

    postalCode: string | null;

    provinceId: number | null;
    regencyId: number | null;
    districtId: number | null;
    villageId: number | null;

    rajaOngkirDestinationId: number | null;

    latitude: string | null;
    longitude: string | null;

    isDefault: boolean;
};

type AddressForm = {
    label: string;

    recipientName: string;
    phone: string;
    address: string;

    province: string;
    provinceId: string;

    city: string;
    cityId: string;

    district: string;
    districtId: string;

    subdistrict: string;
    subdistrictId: string;

    postalCode: string;

    rajaOngkirDestinationId: number | null;

    latitude: string;
    longitude: string;

    isDefault: boolean;
};

type Region = {
    id: number;
    name: string;
    zip_code?: string;
};

const emptyAddressForm: AddressForm = {
    label: "",

    recipientName: "",
    phone: "",
    address: "",

    province: "",
    provinceId: "",

    city: "",
    cityId: "",

    district: "",
    districtId: "",

    subdistrict: "",
    subdistrictId: "",

    postalCode: "",

    rajaOngkirDestinationId: null,

    latitude: "",
    longitude: "",

    isDefault: false,
};

type ProductData = {
    id: number;

    name: string;

    slug: string;

    image: string | null;
};

type VariantData = {
    id: number;

    name: string;

    image: string | null;

    price: number;

    weight: number;

    stock: number;
};

type BuyNowData = {
    product: ProductData;

    variant: VariantData;

    quantity: number;

    subtotal: number;

    totalWeight: number;

    addresses: Address[];

    store: {
        id: number;

        storeName: string;

        rajaOngkirDestinationId:
        number | null;
    };
};

type ShippingOption = {
    courier?: string;

    code?: string;

    service?: string;

    service_name?: string;

    etd?: string;

    estimation?: string;

    cost?: number;

    price?: number;

    shipping_cost?: number;
};

type Props = {
    productId: string;

    variantId: string;

    quantity: string;
};

/*
 * ==========================================
 * AUTO RETRY HELPER
 * ==========================================
 *
 * Dipakai untuk semua request yang rawan
 * kena ETIMEDOUT / fetch failed dari upstream
 * (RajaOngkir, dll). Ketika gagal, function
 * ini otomatis coba lagi dengan delay yang
 * makin lama (exponential-ish backoff),
 * sambil ngasih tau UI lewat onRetry supaya
 * bisa nampilin status "mencoba lagi...".
 *
 * Kalau semua percobaan gagal, error terakhir
 * akan di-throw supaya caller bisa nampilin
 * toast + tombol retry manual.
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    options?: {
        retries?: number;
        delayMs?: number;
        onRetry?: (attempt: number, totalRetries: number) => void;
    }
): Promise<T> {
    const retries = options?.retries ?? 6;
    const delayMs = options?.delayMs ?? 1000;

    let lastError: unknown;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            if (attempt === retries) {
                break;
            }

            options?.onRetry?.(attempt, retries);

            // backoff makin lama tiap percobaan (1s, 2s, 3s, ...)
            await new Promise((resolve) =>
                setTimeout(resolve, delayMs * attempt)
            );
        }
    }

    throw lastError;
}

export default function BuyNowPage({
    productId,
    variantId,
    quantity,
}: Props) {
    const router = useRouter();

    const [loading, setLoading] =
        useState(true);

    const [loadError, setLoadError] =
        useState<string | null>(null);

    const [loadRetrying, setLoadRetrying] =
        useState(false);

    const [data, setData] =
        useState<BuyNowData | null>(null);

    /*
     * ==========================================
     * ADDRESS
     * ==========================================
     */

    const [selectedAddress, setSelectedAddress] =
        useState("");

    const [showAddressForm, setShowAddressForm] =
        useState(false);

    const [savingAddress, setSavingAddress] =
        useState(false);

    const [addressForm, setAddressForm] =
        useState<AddressForm>({
            ...emptyAddressForm,
        });

    /*
     * ==========================================
     * REGION
     * ==========================================
     */

    const [provinces, setProvinces] =
        useState<Region[]>([]);

    const [cities, setCities] =
        useState<Region[]>([]);

    const [districts, setDistricts] =
        useState<Region[]>([]);

    const [subdistricts, setSubdistricts] =
        useState<Region[]>([]);

    const [loadingProvinces, setLoadingProvinces] =
        useState(false);

    const [provincesRetrying, setProvincesRetrying] =
        useState(false);

    const [loadingCities, setLoadingCities] =
        useState(false);

    const [citiesRetrying, setCitiesRetrying] =
        useState(false);

    const [loadingDistricts, setLoadingDistricts] =
        useState(false);

    const [districtsRetrying, setDistrictsRetrying] =
        useState(false);

    const [loadingSubdistricts, setLoadingSubdistricts] =
        useState(false);

    const [subdistrictsRetrying, setSubdistrictsRetrying] =
        useState(false);

    const [loadingDestination, setLoadingDestination] =
        useState(false);

    const [destinationRetrying, setDestinationRetrying] =
        useState(false);

    /*
     * ==========================================
     * SHIPPING
     * ==========================================
     */

    const [shippingOptions, setShippingOptions] =
        useState<ShippingOption[]>([]);

    const [selectedShipping, setSelectedShipping] =
        useState<ShippingOption | null>(null);

    const [loadingShipping, setLoadingShipping] =
        useState(false);

    const [shippingRetrying, setShippingRetrying] =
        useState(false);

    /*
     * ==========================================
     * PAYMENT
     * ==========================================
     */

    const [paymentMethod, setPaymentMethod] =
        useState<
            | "COD"
            | "BANK_TRANSFER"
            | "E_WALLET"
            | "QRIS"
        >("COD");

    const [creatingOrder, setCreatingOrder] =
        useState(false);
    /*
 * ==========================================
 * MIDTRANS SNAP.JS
 * ==========================================
 */

    const [snapReady, setSnapReady] =
        useState(false);

    const [snapLoading, setSnapLoading] =
        useState(true);

    useEffect(() => {
        let script =
            document.getElementById(
                "midtrans-snap"
            ) as HTMLScriptElement | null;

        /*
         * Kalau Snap.js sudah ada
         */
        if (
            script &&
            (window as any).snap
        ) {
            setSnapReady(true);
            setSnapLoading(false);
            return;
        }

        /*
         * Kalau script belum ada,
         * buat script baru.
         */

        if (!script) {
            script =
                document.createElement(
                    "script"
                );

            script.id =
                "midtrans-snap";

            script.src =
                process.env
                    .NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
                    ? process.env
                        .MIDTRANS_IS_PRODUCTION ===
                        "false"
                        ? "https://app.midtrans.com/snap/snap.js"
                        : "https://app.sandbox.midtrans.com/snap/snap.js"
                    : "";

            script.setAttribute(
                "data-client-key",
                process.env
                    .NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ||
                ""
            );

            script.async = true;

            document.body.appendChild(
                script
            );
        }

        const handleLoad = () => {
            if (
                (window as any).snap
            ) {
                setSnapReady(true);
            }

            setSnapLoading(false);
        };

        const handleError = () => {
            console.error(
                "MIDTRANS SNAP.JS GAGAL DIMUAT."
            );

            setSnapReady(false);
            setSnapLoading(false);
        };

        script.addEventListener(
            "load",
            handleLoad
        );

        script.addEventListener(
            "error",
            handleError
        );

        /*
         * Kalau ternyata script sudah
         * selesai loading sebelum listener
         * dipasang.
         */

        if (
            (window as any).snap
        ) {
            setSnapReady(true);
            setSnapLoading(false);
        }

        return () => {
            script?.removeEventListener(
                "load",
                handleLoad
            );

            script?.removeEventListener(
                "error",
                handleError
            );
        };
    }, []);

    useEffect(() => {
        if (
            !addressForm.provinceId ||
            !addressForm.cityId ||
            !addressForm.districtId ||
            !addressForm.subdistrictId
        ) {
            return;
        }

        if (
            !addressForm.province ||
            !addressForm.city ||
            !addressForm.district ||
            !addressForm.subdistrict
        ) {
            return;
        }

        loadRajaOngkirDestination();
    }, [
        addressForm.provinceId,
        addressForm.cityId,
        addressForm.districtId,
        addressForm.subdistrictId,
    ]);

    async function handleCityChange(
        cityId: string
    ) {
        const city =
            cities.find(
                (item) =>
                    String(item.id) ===
                    cityId
            );

        setAddressForm((prev) => ({
            ...prev,

            cityId,

            city:
                city?.name ?? "",

            districtId: "",
            district: "",

            subdistrictId: "",
            subdistrict: "",

            postalCode: "",

            rajaOngkirDestinationId:
                null,
        }));

        setDistricts([]);
        setSubdistricts([]);

        if (!cityId) {
            return;
        }

        try {
            setLoadingDistricts(true);
            setDistrictsRetrying(false);

            const result = await withRetry(
                () => loadRegions("district", cityId),
                {
                    onRetry: () => setDistrictsRetrying(true),
                }
            );

            setDistricts(result);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Gagal mengambil kecamatan."
            );
        } finally {
            setLoadingDistricts(false);
            setDistrictsRetrying(false);
        }
    }
    async function handleProvinceChange(
        provinceId: string
    ) {
        const province = provinces.find(
            (item) =>
                String(item.id) === provinceId
        );

        setAddressForm((prev) => ({
            ...prev,

            provinceId,

            province:
                province?.name ?? "",

            cityId: "",
            city: "",

            districtId: "",
            district: "",

            subdistrictId: "",
            subdistrict: "",

            postalCode: "",

            rajaOngkirDestinationId: null,
        }));

        setCities([]);
        setDistricts([]);
        setSubdistricts([]);

        if (!provinceId) {
            return;
        }

        try {
            setLoadingCities(true);
            setCitiesRetrying(false);

            const result = await withRetry(
                () => loadRegions("city", provinceId),
                {
                    onRetry: () => setCitiesRetrying(true),
                }
            );

            setCities(result);
        } catch (error) {
            console.error(
                "BUY NOW LOAD CITIES ERROR:",
                error
            );

            toast.error(
                error instanceof Error
                    ? error.message
                    : "Gagal mengambil kota."
            );
        } finally {
            setLoadingCities(false);
            setCitiesRetrying(false);
        }
    }
    async function handleSubdistrictChange(
        subdistrictId: string
    ) {
        const subdistrict =
            subdistricts.find(
                (item) =>
                    String(item.id) ===
                    subdistrictId
            );

        if (!subdistrict) {
            return;
        }

        setAddressForm((prev) => ({
            ...prev,

            subdistrictId,

            subdistrict:
                subdistrict.name,

            postalCode:
                subdistrict.zip_code ??
                "",

            rajaOngkirDestinationId:
                null,
        }));
    }

    async function handleDistrictChange(
        districtId: string
    ) {
        const district =
            districts.find(
                (item) =>
                    String(item.id) ===
                    districtId
            );

        setAddressForm((prev) => ({
            ...prev,

            districtId,

            district:
                district?.name ?? "",

            subdistrictId: "",
            subdistrict: "",

            postalCode: "",

            rajaOngkirDestinationId:
                null,
        }));

        setSubdistricts([]);

        if (!districtId) {
            return;
        }

        try {
            setLoadingSubdistricts(true);
            setSubdistrictsRetrying(false);

            const result = await withRetry(
                () => loadRegions("subdistrict", districtId),
                {
                    onRetry: () => setSubdistrictsRetrying(true),
                }
            );

            setSubdistricts(result);
        } catch (error) {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Gagal mengambil kelurahan."
            );
        } finally {
            setLoadingSubdistricts(false);
            setSubdistrictsRetrying(false);
        }
    }

    async function loadRajaOngkirDestination() {
        if (
            !addressForm.provinceId ||
            !addressForm.cityId ||
            !addressForm.districtId ||
            !addressForm.subdistrictId
        ) {
            return;
        }

        if (
            !addressForm.province ||
            !addressForm.city ||
            !addressForm.district ||
            !addressForm.subdistrict
        ) {
            return;
        }

        try {
            setLoadingDestination(true);
            setDestinationRetrying(false);

            const destinationId = await withRetry(
                async () => {
                    const params =
                        new URLSearchParams();

                    params.set(
                        "provinceId",
                        addressForm.provinceId
                    );

                    params.set(
                        "cityId",
                        addressForm.cityId
                    );

                    params.set(
                        "districtId",
                        addressForm.districtId
                    );

                    params.set(
                        "subdistrictId",
                        addressForm.subdistrictId
                    );

                    params.set(
                        "province",
                        addressForm.province
                    );

                    params.set(
                        "city",
                        addressForm.city
                    );

                    params.set(
                        "district",
                        addressForm.district
                    );

                    params.set(
                        "subdistrict",
                        addressForm.subdistrict
                    );

                    if (addressForm.postalCode) {
                        params.set(
                            "postalCode",
                            addressForm.postalCode
                        );
                    }

                    const response =
                        await fetch(
                            `/api/rajaongkir/destination?${params.toString()}`,
                            {
                                cache: "no-store",
                            }
                        );

                    const result =
                        await response.json();

                    if (
                        !response.ok ||
                        !result.success
                    ) {
                        throw new Error(
                            result.message ||
                            "Destination RajaOngkir tidak ditemukan."
                        );
                    }

                    const id =
                        Number(
                            result.data
                                ?.rajaOngkirDestinationId
                        );

                    if (
                        !Number.isInteger(id) ||
                        id <= 0
                    ) {
                        throw new Error(
                            "Destination RajaOngkir yang diterima tidak valid."
                        );
                    }

                    return id;
                },
                {
                    onRetry: () => setDestinationRetrying(true),
                }
            );

            setAddressForm((prev) => ({
                ...prev,

                rajaOngkirDestinationId:
                    destinationId,
            }));
        } catch (error) {
            console.error(
                "BUY NOW LOAD DESTINATION ERROR:",
                error
            );

            setAddressForm((prev) => ({
                ...prev,
                rajaOngkirDestinationId:
                    null,
            }));

            toast.error(
                error instanceof Error
                    ? error.message
                    : "Gagal mencari destination RajaOngkir."
            );
        } finally {
            setLoadingDestination(false);
            setDestinationRetrying(false);
        }
    }

    async function loadRegions(
        type:
            | "province"
            | "city"
            | "district"
            | "subdistrict",
        id?: string
    ): Promise<Region[]> {
        const params = new URLSearchParams();

        params.set("type", type);

        if (id) {
            params.set("id", id);
        }

        const response = await fetch(
            `/api/rajaongkir/regions?${params.toString()}`,
            {
                cache: "no-store",
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message ||
                "Gagal mengambil data wilayah."
            );
        }

        return Array.isArray(result.data)
            ? result.data
            : [];
    }

    /*
     * ==========================================
     * LOAD BUY NOW
     * ==========================================
     */

    async function loadBuyNow() {
        try {
            setLoading(true);
            setLoadError(null);
            setLoadRetrying(false);

            const checkoutData = await withRetry(
                async () => {
                    const params = new URLSearchParams();

                    params.set("productId", productId);
                    params.set("variantId", variantId);
                    params.set("quantity", quantity);

                    const response = await fetch(
                        `/api/buy-now?${params.toString()}`,
                        {
                            method: "GET",
                            cache: "no-store",
                        }
                    );

                    const contentType =
                        response.headers.get(
                            "content-type"
                        ) || "";

                    let result: any = null;

                    if (
                        contentType.includes(
                            "application/json"
                        )
                    ) {
                        result =
                            await response.json();
                    } else {
                        const text =
                            await response.text();

                        console.error(
                            "BUY NOW NON JSON RESPONSE:",
                            {
                                status: response.status,
                                statusText:
                                    response.statusText,
                                text,
                            }
                        );

                        throw new Error(
                            text ||
                            `API Buy Now gagal (${response.status} ${response.statusText})`
                        );
                    }

                    if (
                        !response.ok ||
                        !result?.success
                    ) {
                        throw new Error(
                            result?.message ||
                            `Gagal mengambil data Buy Now (${response.status}).`
                        );
                    }

                    return result.data as BuyNowData;
                },
                {
                    onRetry: () => setLoadRetrying(true),
                }
            );

            setData(checkoutData);

            const defaultAddress =
                checkoutData.addresses.find(
                    (item) =>
                        item.isDefault
                );

            if (defaultAddress) {
                setSelectedAddress(
                    defaultAddress.id
                );
            } else if (
                checkoutData.addresses.length >
                0
            ) {
                setSelectedAddress(
                    checkoutData.addresses[0].id
                );
            }
        } catch (error) {
            console.error(
                "LOAD BUY NOW ERROR:",
                error
            );

            const message =
                error instanceof Error
                    ? error.message
                    : "Gagal mengambil data Buy Now.";

            setLoadError(message);

            toast.error(message);
        } finally {
            setLoading(false);
            setLoadRetrying(false);
        }
    }
    async function loadProvinces() {
        try {
            setLoadingProvinces(true);
            setProvincesRetrying(false);

            const result = await withRetry(
                () => loadRegions("province"),
                {
                    onRetry: () => setProvincesRetrying(true),
                }
            );

            setProvinces(result);
        } catch (error) {
            console.error(
                "BUY NOW LOAD PROVINCES ERROR:",
                error
            );

            toast.error(
                error instanceof Error
                    ? error.message
                    : "Gagal mengambil provinsi."
            );
        } finally {
            setLoadingProvinces(false);
            setProvincesRetrying(false);
        }
    }

    async function saveAddress() {
        if (
            !addressForm.recipientName.trim()
        ) {
            toast.error(
                "Nama penerima wajib diisi."
            );
            return;
        }

        if (!addressForm.phone.trim()) {
            toast.error(
                "Nomor HP wajib diisi."
            );
            return;
        }

        if (!addressForm.address.trim()) {
            toast.error(
                "Alamat lengkap wajib diisi."
            );
            return;
        }

        if (!addressForm.provinceId) {
            toast.error(
                "Pilih provinsi."
            );
            return;
        }

        if (!addressForm.cityId) {
            toast.error(
                "Pilih kota/kabupaten."
            );
            return;
        }

        if (!addressForm.districtId) {
            toast.error(
                "Pilih kecamatan."
            );
            return;
        }

        if (!addressForm.subdistrictId) {
            toast.error(
                "Pilih kelurahan/desa."
            );
            return;
        }

        if (loadingDestination) {
            toast.error(
                "Sedang mencari Destination RajaOngkir. Tunggu sebentar."
            );
            return;
        }

        if (
            !addressForm.rajaOngkirDestinationId ||
            addressForm.rajaOngkirDestinationId <= 0
        ) {
            toast.error(
                "Destination RajaOngkir belum ditemukan."
            );
            return;
        }

        if (!addressForm.postalCode.trim()) {
            toast.error(
                "Kode pos belum tersedia."
            );
            return;
        }

        try {
            setSavingAddress(true);

            const result = await withRetry(async () => {
                const response =
                    await fetch(
                        "/api/addresses",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body: JSON.stringify({
                                label:
                                    addressForm.label.trim() ||
                                    null,

                                recipientName:
                                    addressForm.recipientName.trim(),

                                phone:
                                    addressForm.phone.trim(),

                                address:
                                    addressForm.address.trim(),

                                province:
                                    addressForm.province,

                                city:
                                    addressForm.city,

                                district:
                                    addressForm.district,

                                subdistrict:
                                    addressForm.subdistrict,

                                postalCode:
                                    addressForm.postalCode,

                                provinceId:
                                    Number(
                                        addressForm.provinceId
                                    ),

                                regencyId:
                                    Number(
                                        addressForm.cityId
                                    ),

                                districtId:
                                    Number(
                                        addressForm.districtId
                                    ),

                                villageId:
                                    Number(
                                        addressForm.subdistrictId
                                    ),

                                rajaOngkirDestinationId:
                                    Number(
                                        addressForm.rajaOngkirDestinationId
                                    ),

                                latitude:
                                    addressForm.latitude
                                        ? Number(
                                            addressForm.latitude
                                        )
                                        : null,

                                longitude:
                                    addressForm.longitude
                                        ? Number(
                                            addressForm.longitude
                                        )
                                        : null,

                                isDefault:
                                    addressForm.isDefault,
                            }),
                        }
                    );

                const json =
                    await response.json();

                if (
                    !response.ok ||
                    !json.success
                ) {
                    throw new Error(
                        json.message ||
                        "Gagal menyimpan alamat."
                    );
                }

                return json;
            }, { retries: 3 });

            toast.success(
                "Alamat berhasil disimpan."
            );

            setShowAddressForm(false);

            setAddressForm({
                ...emptyAddressForm,
            });

            /*
             * Reload Buy Now supaya address
             * baru masuk ke data.addresses.
             */
            await loadBuyNow();

            /*
             * Otomatis pilih alamat yang baru dibuat.
             */
            const savedAddress =
                result.data ??
                result.address;

            if (savedAddress?.id) {
                setSelectedAddress(
                    savedAddress.id
                );
            }
        } catch (error) {
            console.error(
                "BUY NOW SAVE ADDRESS ERROR:",
                error
            );

            toast.error(
                error instanceof Error
                    ? error.message
                    : "Gagal menyimpan alamat."
            );
        } finally {
            setSavingAddress(false);
        }
    }



    useEffect(() => {
        loadBuyNow();
        loadProvinces();
    }, [
        productId,
        variantId,
        quantity,
    ]);

    /*
     * ==========================================
     * SHIPPING
     * ==========================================
     */

    async function loadShippingCost() {
        if (!data) {
            return;
        }

        if (!selectedAddress) {
            setShippingOptions([]);
            setSelectedShipping(null);
            return;
        }

        const address =
            data.addresses.find(
                (item) =>
                    item.id ===
                    selectedAddress
            );

        if (!address) {
            return;
        }

        const origin = Number(
            data.store
                .rajaOngkirDestinationId
        );

        const destination =
            Number(
                address.rajaOngkirDestinationId
            );

        if (
            !Number.isInteger(origin) ||
            origin <= 0
        ) {
            toast.error(
                "Destination toko belum dikonfigurasi."
            );

            return;
        }

        if (
            !Number.isInteger(
                destination
            ) ||
            destination <= 0
        ) {
            toast.error(
                "Destination alamat belum tersedia."
            );

            return;
        }

        const weight = Math.max(
            Math.ceil(
                Number(
                    data.totalWeight
                )
            ),
            1
        );

        try {
            setLoadingShipping(true);
            setShippingRetrying(false);

            setShippingOptions([]);

            setSelectedShipping(null);

            const options = await withRetry(
                async () => {
                    const response =
                        await fetch(
                            "/api/buy-now/shipping",
                            {
                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json",
                                },

                                body: JSON.stringify({
                                    origin,

                                    destination,

                                    weight,

                                    courier:
                                        "jne:jnt:sicepat",

                                    price:
                                        "lowest",
                                }),

                                cache: "no-store",
                            }
                        );

                    const result =
                        await response.json();

                    if (
                        !response.ok ||
                        !result.success
                    ) {
                        throw new Error(
                            result.message ||
                            "Gagal mengambil ongkir."
                        );
                    }

                    return Array.isArray(
                        result.data
                    )
                        ? result.data
                        : [];
                },
                {
                    onRetry: () => setShippingRetrying(true),
                }
            );

            setShippingOptions(
                options
            );

            if (
                options.length === 0
            ) {
                toast.error(
                    "Tidak ada layanan pengiriman."
                );
            }
        } catch (error) {
            console.error(
                "BUY NOW SHIPPING ERROR:",
                error
            );

            setShippingOptions([]);

            setSelectedShipping(null);

            toast.error(
                error instanceof Error
                    ? error.message
                    : "Gagal mengambil ongkir."
            );
        } finally {
            setLoadingShipping(false);
            setShippingRetrying(false);
        }
    }

    useEffect(() => {
        if (!data) {
            return;
        }

        loadShippingCost();
    }, [
        data,
        selectedAddress,
    ]);

    /*
     * ==========================================
     * SHIPPING COST
     * ==========================================
     */

    const shippingCost = useMemo(() => {
        if (!selectedShipping) {
            return 0;
        }

        return Number(
            selectedShipping.cost ??
            selectedShipping.price ??
            selectedShipping.shipping_cost ??
            0
        );
    }, [
        selectedShipping,
    ]);

    const grandTotal = useMemo(() => {
        if (!data) {
            return 0;
        }

        return (
            data.subtotal +
            shippingCost
        );
    }, [
        data,
        shippingCost,
    ]);

    /*
 * ==========================================
 * CREATE ORDER / PAYMENT
 * ==========================================
 */

    async function createOrder() {
        if (!data) {
            return;
        }

        if (!selectedAddress) {
            toast.error(
                "Pilih alamat pengiriman."
            );

            return;
        }

        if (!selectedShipping) {
            toast.error(
                "Pilih pengiriman."
            );

            return;
        }

        /*
         * ==========================================
         * COD
         * ==========================================
         */

        if (
            paymentMethod ===
            "COD"
        ) {
            try {
                setCreatingOrder(true);

                const response =
                    await fetch(
                        "/api/buy-now",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    productId:
                                        Number(
                                            productId
                                        ),

                                    variantId:
                                        Number(
                                            variantId
                                        ),

                                    quantity:
                                        Number(
                                            quantity
                                        ),

                                    addressId:
                                        selectedAddress,

                                    shipping:
                                        selectedShipping,

                                    paymentMethod:
                                        "COD",
                                }),
                        }
                    );

                const result =
                    await response.json();

                if (
                    !response.ok ||
                    !result.success
                ) {
                    throw new Error(
                        result.message ||
                        "Gagal membuat pesanan."
                    );
                }

                const order =
                    result.data;

                if (!order?.id) {
                    throw new Error(
                        "Order berhasil dibuat tetapi ID order tidak ditemukan."
                    );
                }

                toast.success(
                    "Pesanan berhasil dibuat."
                );

                window.location.href =
                    `/checkout/success?order=${order.id}`;
            } catch (error) {
                console.error(
                    "BUY NOW COD ERROR:",
                    error
                );

                toast.error(
                    error instanceof Error
                        ? error.message
                        : "Gagal membuat pesanan."
                );
            } finally {
                setCreatingOrder(false);
            }

            return;
        }

        /*
         * ==========================================
         * MIDTRANS
         * ==========================================
         */

        if (!snapReady) {
            toast.error(
                snapLoading
                    ? "Pembayaran sedang dimuat. Tunggu sebentar."
                    : "Midtrans belum siap. Silakan refresh halaman."
            );

            return;
        }

        try {
            setCreatingOrder(true);

            /*
             * ==========================================
             * CREATE MIDTRANS TRANSACTION
             * ==========================================
             */

            const paymentResponse =
                await fetch(
                    "/api/buy-now/midtrans",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json",
                        },

                        body:
                            JSON.stringify({
                                productId:
                                    Number(
                                        productId
                                    ),

                                variantId:
                                    Number(
                                        variantId
                                    ),

                                quantity:
                                    Number(
                                        quantity
                                    ),

                                addressId:
                                    selectedAddress,

                                shipping:
                                    selectedShipping,

                                paymentMethod:
                                    paymentMethod,
                            }),
                    }
                );

            const paymentResult =
                await paymentResponse.json();

            if (
                !paymentResponse.ok ||
                !paymentResult.success
            ) {
                throw new Error(
                    paymentResult.message ||
                    "Gagal membuat pembayaran Midtrans."
                );
            }

            const paymentData =
                paymentResult.data;

            /*
             * ==========================================
             * TOKEN WAJIB
             * ==========================================
             */

            if (
                !paymentData?.token
            ) {
                console.error(
                    "MIDTRANS TOKEN TIDAK ADA:",
                    paymentData
                );

                throw new Error(
                    "Token pembayaran Midtrans tidak ditemukan."
                );
            }

            /*
             * ==========================================
             * SNAP
             * ==========================================
             */

            const snap =
                (window as any).snap;

            if (!snap) {
                throw new Error(
                    "Snap.js Midtrans belum tersedia."
                );
            }

            /*
             * ==========================================
             * BUKA TRANSPARENT PAYMENT
             * ==========================================
             *
             * PENTING:
             *
             * JANGAN:
             *
             * window.location.href =
             * paymentData.redirectUrl
             *
             * Karena itu akan membawa user
             * ke halaman hosted Midtrans.
             *
             * Kita gunakan snap.pay()
             * supaya payment muncul sebagai
             * modal/transparan di halaman
             * Buy Now.
             */

            snap.pay(
                paymentData.token,
                {
                    /*
                     * ==================================
                     * SUCCESS
                     * ==================================
                     */

                    onSuccess: (
                        result: any
                    ) => {
                        console.log(
                            "MIDTRANS SUCCESS:",
                            result
                        );

                        toast.success(
                            "Pembayaran berhasil."
                        );

                        router.push(
                            `/checkout/payment-finish?payment=${encodeURIComponent(
                                paymentData.paymentReference
                            )}&status=success`
                        );
                    },

                    /*
                     * ==================================
                     * PENDING
                     * ==================================
                     */

                    onPending: (
                        result: any
                    ) => {
                        console.log(
                            "MIDTRANS PENDING:",
                            result
                        );

                        toast(
                            "Pembayaran sedang menunggu penyelesaian."
                        );

                        router.push(
                            `/checkout/payment-finish?payment=${encodeURIComponent(
                                paymentData.paymentReference
                            )}&status=pending`
                        );
                    },

                    /*
                     * ==================================
                     * ERROR
                     * ==================================
                     */

                    onError: (
                        result: any
                    ) => {
                        console.error(
                            "MIDTRANS ERROR:",
                            result
                        );

                        toast.error(
                            "Pembayaran gagal."
                        );

                        setCreatingOrder(
                            false
                        );
                    },

                    /*
                     * ==================================
                     * CLOSE / X
                     * ==================================
                     *
                     * PENTING:
                     *
                     * JANGAN redirect.
                     *
                     * User tetap berada di
                     * halaman Buy Now.
                     */

                    onClose: () => {
                        console.log(
                            "MIDTRANS SNAP DITUTUP USER."
                        );

                        toast(
                            "Pembayaran ditutup."
                        );

                        setCreatingOrder(
                            false
                        );
                    },
                }
            );
        } catch (error) {
            console.error(
                "BUY NOW MIDTRANS ERROR:",
                error
            );

            toast.error(
                error instanceof Error
                    ? error.message
                    : "Gagal membuat pembayaran Midtrans."
            );

            setCreatingOrder(false);
        }
    }

    /*
     * ==========================================
     * LOADING
     * ==========================================
     */

    if (loading) {
        return (
            <main className="min-h-screen bg-gray-50 px-4 py-8">
                <div className="mx-auto max-w-6xl">
                    <div className="rounded-3xl border bg-white p-8 text-center">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-rose-600 border-t-transparent" />

                        <p className="mt-4 font-medium">
                            Memuat Buy Now...
                        </p>

                        {loadRetrying && (
                            <p className="mt-1 text-sm text-gray-500">
                                Koneksi lambat, mencoba lagi...
                            </p>
                        )}
                    </div>
                </div>
            </main>
        );
    }

    if (!data) {
        return (
            <main className="min-h-screen bg-gray-50 px-4 py-8">
                <div className="mx-auto max-w-6xl">
                    <div className="rounded-3xl border bg-white p-8 text-center">
                        <p className="font-medium">
                            {loadError ||
                                "Data produk tidak ditemukan."}
                        </p>

                        <button
                            type="button"
                            onClick={() => loadBuyNow()}
                            className="mt-4 rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
                        >
                            Coba Lagi
                        </button>
                    </div>
                </div>
            </main>
        );
    }

    const address =
        data.addresses.find(
            (item) =>
                item.id ===
                selectedAddress
        );

    /*
     * ==========================================
     * UI
     * ==========================================
     */

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
            <div className="mx-auto max-w-6xl">

                {/* HEADER */}

                <div className="mb-8">
                    <Link
                        href={`/products/${data.product.slug}`}
                        className="text-sm text-gray-500 hover:text-gray-900"
                    >
                        ← Kembali ke Produk
                    </Link>

                    <h1 className="mt-3 text-3xl font-bold text-gray-900">
                        Beli Sekarang
                    </h1>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1fr_380px]">

                    <div className="space-y-6">

                        {/* PRODUCT */}

                        <section className="rounded-3xl border border-gray-200 bg-white p-6">

                            <h2 className="text-lg font-bold">
                                Produk
                            </h2>

                            <div className="mt-5 flex gap-4">

                                <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gray-100">

                                    {(
                                        data.variant
                                            .image ||
                                        data.product
                                            .image
                                    ) && (
                                            <img
                                                src={
                                                    data.variant
                                                        .image ||
                                                    data.product
                                                        .image ||
                                                    ""
                                                }
                                                alt={
                                                    data.product
                                                        .name
                                                }
                                                className="h-full w-full object-cover"
                                            />
                                        )}

                                </div>

                                <div className="min-w-0 flex-1">

                                    <h3 className="font-bold text-gray-900">
                                        {
                                            data.product
                                                .name
                                        }
                                    </h3>

                                    <p className="mt-1 text-sm text-gray-500">
                                        {
                                            data.variant
                                                .name
                                        }
                                    </p>

                                    <p className="mt-2 text-sm">
                                        {data.quantity} × Rp{" "}
                                        {data.variant.price.toLocaleString(
                                            "id-ID"
                                        )}
                                    </p>

                                    <p className="mt-1 text-xs text-gray-400">
                                        Berat{" "}
                                        {data.totalWeight.toLocaleString(
                                            "id-ID"
                                        )}{" "}
                                        gram
                                    </p>

                                </div>

                                <div className="font-bold">
                                    Rp{" "}
                                    {data.subtotal.toLocaleString(
                                        "id-ID"
                                    )}
                                </div>

                            </div>

                        </section>

                        {/* ADDRESS */}

                        <section className="rounded-3xl border border-gray-200 bg-white p-6">

                            <div className="flex items-center justify-between gap-3">

                                <div>
                                    <h2 className="text-lg font-bold">
                                        Alamat Pengiriman
                                    </h2>

                                    <p className="mt-1 text-sm text-gray-500">
                                        Pilih alamat tujuan.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setAddressForm({
                                            ...emptyAddressForm,
                                        });

                                        setShowAddressForm(true);
                                    }}
                                    className="text-sm font-semibold text-rose-600 hover:text-rose-700"
                                >
                                    + Tambah Alamat
                                </button>

                            </div>

                            {data.addresses.length === 0 ? (
                                <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-6 text-center">
                                    <p className="font-medium">
                                        Belum ada alamat
                                    </p>

                                    <p className="mt-1 text-sm text-gray-500">
                                        Tambahkan alamat terlebih dahulu.
                                    </p>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAddressForm({
                                                ...emptyAddressForm,
                                            });

                                            setShowAddressForm(true);
                                        }}
                                        className="mt-4 inline-block rounded-xl bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white"
                                    >
                                        + Tambah Alamat
                                    </button>
                                </div>
                            ) : (
                                <div className="mt-5 space-y-3">

                                    {data.addresses.map(
                                        (
                                            item
                                        ) => (
                                            <button
                                                key={
                                                    item.id
                                                }
                                                type="button"
                                                onClick={() =>
                                                    setSelectedAddress(
                                                        item.id
                                                    )
                                                }
                                                className={`w-full rounded-2xl border p-4 text-left transition ${selectedAddress ===
                                                    item.id
                                                    ? "border-rose-500 bg-rose-50"
                                                    : "border-gray-200 hover:border-gray-300"
                                                    }`}
                                            >

                                                <div className="flex items-start justify-between gap-4">

                                                    <div>

                                                        <div className="flex flex-wrap items-center gap-2 font-semibold">

                                                            {
                                                                item.recipientName
                                                            }

                                                            {item.label && (
                                                                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600">
                                                                    {
                                                                        item.label
                                                                    }
                                                                </span>
                                                            )}

                                                        </div>

                                                        <div className="mt-1 text-sm text-gray-500">
                                                            {
                                                                item.phone
                                                            }
                                                        </div>

                                                        <div className="mt-3 text-sm leading-6 text-gray-700">
                                                            {
                                                                item.address
                                                            }

                                                            <br />

                                                            {
                                                                item.subdistrict
                                                            }
                                                            ,{" "}
                                                            {
                                                                item.district
                                                            }
                                                            ,{" "}
                                                            {
                                                                item.city
                                                            }
                                                            ,{" "}
                                                            {
                                                                item.province
                                                            }

                                                            {item.postalCode &&
                                                                ` ${item.postalCode}`}
                                                        </div>

                                                    </div>

                                                    {item.isDefault && (
                                                        <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white">
                                                            Utama
                                                        </span>
                                                    )}

                                                </div>

                                            </button>
                                        )
                                    )}

                                </div>
                            )}
                            {showAddressForm && (
                                <div className="mt-5 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h3 className="font-bold text-gray-900">
                                                Tambah Alamat Baru
                                            </h3>

                                            <p className="mt-1 text-sm text-gray-500">
                                                Isi alamat lengkap untuk pengiriman.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowAddressForm(false)
                                            }
                                            className="text-sm text-gray-500 hover:text-gray-900"
                                        >
                                            Batal
                                        </button>
                                    </div>

                                    <div className="mt-5 grid gap-4">

                                        {/* LABEL */}

                                        <div>
                                            <label className="text-sm font-medium">
                                                Label Alamat
                                            </label>

                                            <input
                                                value={addressForm.label}
                                                onChange={(e) =>
                                                    setAddressForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            label: e.target.value,
                                                        })
                                                    )
                                                }
                                                placeholder="Rumah / Kantor"
                                                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-rose-500"
                                            />
                                        </div>

                                        {/* NAMA */}

                                        <div>
                                            <label className="text-sm font-medium">
                                                Nama Penerima
                                            </label>

                                            <input
                                                value={
                                                    addressForm.recipientName
                                                }
                                                onChange={(e) =>
                                                    setAddressForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            recipientName:
                                                                e.target.value,
                                                        })
                                                    )
                                                }
                                                placeholder="Nama penerima"
                                                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-rose-500"
                                            />
                                        </div>

                                        {/* PHONE */}

                                        <div>
                                            <label className="text-sm font-medium">
                                                Nomor HP
                                            </label>

                                            <input
                                                value={addressForm.phone}
                                                onChange={(e) =>
                                                    setAddressForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            phone: e.target.value,
                                                        })
                                                    )
                                                }
                                                placeholder="08xxxxxxxxxx"
                                                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-rose-500"
                                            />
                                        </div>

                                        {/* ADDRESS */}

                                        <div>
                                            <label className="text-sm font-medium">
                                                Alamat Lengkap
                                            </label>

                                            <textarea
                                                value={
                                                    addressForm.address
                                                }
                                                onChange={(e) =>
                                                    setAddressForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            address:
                                                                e.target.value,
                                                        })
                                                    )
                                                }
                                                rows={3}
                                                placeholder="Nama jalan, nomor rumah, RT/RW, dll."
                                                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-rose-500"
                                            />
                                        </div>

                                        {/* PROVINCE */}

                                        <div>
                                            <label className="text-sm font-medium">
                                                Provinsi
                                            </label>

                                            <select
                                                value={
                                                    addressForm.provinceId
                                                }
                                                onChange={(e) =>
                                                    handleProvinceChange(
                                                        e.target.value
                                                    )
                                                }
                                                disabled={
                                                    loadingProvinces
                                                }
                                                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-rose-500"
                                            >
                                                <option value="">
                                                    {loadingProvinces
                                                        ? provincesRetrying
                                                            ? "Mencoba lagi..."
                                                            : "Memuat provinsi..."
                                                        : "Pilih provinsi"}
                                                </option>

                                                {provinces.map(
                                                    (item) => (
                                                        <option
                                                            key={item.id}
                                                            value={item.id}
                                                        >
                                                            {item.name}
                                                        </option>
                                                    )
                                                )}
                                            </select>

                                            {!loadingProvinces &&
                                                provinces.length === 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => loadProvinces()}
                                                        className="mt-1 text-xs font-semibold text-rose-600 hover:text-rose-700"
                                                    >
                                                        Gagal memuat provinsi, coba lagi
                                                    </button>
                                                )}
                                        </div>

                                        {/* CITY */}

                                        <div>
                                            <label className="text-sm font-medium">
                                                Kota / Kabupaten
                                            </label>

                                            <select
                                                value={
                                                    addressForm.cityId
                                                }
                                                onChange={(e) =>
                                                    handleCityChange(
                                                        e.target.value
                                                    )
                                                }
                                                disabled={
                                                    !addressForm.provinceId ||
                                                    loadingCities
                                                }
                                                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-rose-500"
                                            >
                                                <option value="">
                                                    {loadingCities
                                                        ? citiesRetrying
                                                            ? "Mencoba lagi..."
                                                            : "Memuat kota..."
                                                        : "Pilih kota/kabupaten"}
                                                </option>

                                                {cities.map(
                                                    (item) => (
                                                        <option
                                                            key={item.id}
                                                            value={item.id}
                                                        >
                                                            {item.name}
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                        </div>

                                        {/* DISTRICT */}

                                        <div>
                                            <label className="text-sm font-medium">
                                                Kecamatan
                                            </label>

                                            <select
                                                value={
                                                    addressForm.districtId
                                                }
                                                onChange={(e) =>
                                                    handleDistrictChange(
                                                        e.target.value
                                                    )
                                                }
                                                disabled={
                                                    !addressForm.cityId ||
                                                    loadingDistricts
                                                }
                                                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-rose-500"
                                            >
                                                <option value="">
                                                    {loadingDistricts
                                                        ? districtsRetrying
                                                            ? "Mencoba lagi..."
                                                            : "Memuat kecamatan..."
                                                        : "Pilih kecamatan"}
                                                </option>

                                                {districts.map(
                                                    (item) => (
                                                        <option
                                                            key={item.id}
                                                            value={item.id}
                                                        >
                                                            {item.name}
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                        </div>

                                        {/* SUBDISTRICT */}

                                        <div>
                                            <label className="text-sm font-medium">
                                                Kelurahan / Desa
                                            </label>

                                            <select
                                                value={
                                                    addressForm.subdistrictId
                                                }
                                                onChange={(e) =>
                                                    handleSubdistrictChange(
                                                        e.target.value
                                                    )
                                                }
                                                disabled={
                                                    !addressForm.districtId ||
                                                    loadingSubdistricts
                                                }
                                                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-rose-500"
                                            >
                                                <option value="">
                                                    {loadingSubdistricts
                                                        ? subdistrictsRetrying
                                                            ? "Mencoba lagi..."
                                                            : "Memuat kelurahan..."
                                                        : "Pilih kelurahan/desa"}
                                                </option>

                                                {subdistricts.map(
                                                    (item) => (
                                                        <option
                                                            key={item.id}
                                                            value={item.id}
                                                        >
                                                            {item.name}
                                                        </option>
                                                    )
                                                )}
                                            </select>
                                        </div>

                                        {/* POSTAL CODE */}

                                        <div>
                                            <label className="text-sm font-medium">
                                                Kode Pos
                                            </label>

                                            <input
                                                value={
                                                    addressForm.postalCode
                                                }
                                                onChange={(e) =>
                                                    setAddressForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            postalCode:
                                                                e.target.value,
                                                        })
                                                    )
                                                }
                                                placeholder="Kode pos"
                                                className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-rose-500"
                                            />
                                        </div>

                                        {/* DESTINATION */}

                                        <div className="rounded-xl bg-white p-4">
                                            <div className="text-xs text-gray-500">
                                                RajaOngkir Destination
                                            </div>

                                            <div className="mt-1 font-semibold">
                                                {loadingDestination
                                                    ? destinationRetrying
                                                        ? "Mencoba lagi..."
                                                        : "Mencari destination..."
                                                    : addressForm.rajaOngkirDestinationId
                                                        ? `ID ${addressForm.rajaOngkirDestinationId}`
                                                        : "Belum ditemukan"}
                                            </div>
                                        </div>

                                        {/* DEFAULT */}

                                        <label className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    addressForm.isDefault
                                                }
                                                onChange={(e) =>
                                                    setAddressForm(
                                                        (prev) => ({
                                                            ...prev,
                                                            isDefault:
                                                                e.target.checked,
                                                        })
                                                    )
                                                }
                                            />

                                            <span className="text-sm">
                                                Jadikan alamat utama
                                            </span>
                                        </label>

                                        {/* SAVE */}

                                        <button
                                            type="button"
                                            onClick={saveAddress}
                                            disabled={
                                                savingAddress ||
                                                loadingDestination
                                            }
                                            className="w-full rounded-xl bg-rose-600 px-5 py-3 font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                                        >
                                            {savingAddress
                                                ? "Menyimpan..."
                                                : loadingDestination
                                                    ? "Mencari lokasi..."
                                                    : "Simpan Alamat"}
                                        </button>
                                    </div>
                                </div>
                            )}

                        </section>

                        {/* SHIPPING */}

                        <section className="rounded-3xl border border-gray-200 bg-white p-6">

                            <div className="flex items-center justify-between">

                                <div>
                                    <h2 className="text-lg font-bold">
                                        Pilih Pengiriman
                                    </h2>

                                    <p className="mt-1 text-sm text-gray-500">
                                        Pilih kurir dan layanan.
                                    </p>
                                </div>

                                {loadingShipping && (
                                    <span className="text-sm text-gray-500">
                                        {shippingRetrying
                                            ? "Mencoba lagi..."
                                            : "Menghitung..."}
                                    </span>
                                )}

                            </div>

                            {selectedAddress &&
                                !loadingShipping &&
                                shippingOptions.length ===
                                0 && (
                                    <div className="mt-5 rounded-2xl bg-gray-50 p-5 text-sm text-gray-500">
                                        <p>Tidak ada layanan pengiriman.</p>

                                        <button
                                            type="button"
                                            onClick={() => loadShippingCost()}
                                            className="mt-2 text-xs font-semibold text-rose-600 hover:text-rose-700"
                                        >
                                            Coba lagi
                                        </button>
                                    </div>
                                )}

                            {shippingOptions.length >
                                0 && (
                                    <div className="mt-5 space-y-3">

                                        {shippingOptions.map(
                                            (
                                                option,
                                                index
                                            ) => {
                                                const cost =
                                                    Number(
                                                        option.cost ??
                                                        option.price ??
                                                        option.shipping_cost ??
                                                        0
                                                    );

                                                const courier =
                                                    option.courier ??
                                                    option.code ??
                                                    "";

                                                const service =
                                                    option.service ??
                                                    option.service_name ??
                                                    "";

                                                const etd =
                                                    option.etd ??
                                                    option.estimation ??
                                                    "";

                                                const selected =
                                                    selectedShipping ===
                                                    option;

                                                return (
                                                    <button
                                                        key={`${courier}-${service}-${index}`}
                                                        type="button"
                                                        onClick={() =>
                                                            setSelectedShipping(
                                                                option
                                                            )
                                                        }
                                                        className={`w-full rounded-2xl border p-4 text-left transition ${selected
                                                            ? "border-rose-500 bg-rose-50"
                                                            : "border-gray-200 hover:border-gray-300"
                                                            }`}
                                                    >

                                                        <div className="flex items-center justify-between gap-4">

                                                            <div>

                                                                <div className="font-bold uppercase">
                                                                    {
                                                                        courier
                                                                    }
                                                                </div>

                                                                <div className="mt-1 text-sm font-medium">
                                                                    {
                                                                        service
                                                                    }
                                                                </div>

                                                                {etd && (
                                                                    <div className="mt-1 text-xs text-gray-500">
                                                                        Estimasi{" "}
                                                                        {
                                                                            etd
                                                                        }{" "}
                                                                        hari
                                                                    </div>
                                                                )}

                                                            </div>

                                                            <div className="font-bold">
                                                                Rp{" "}
                                                                {cost.toLocaleString(
                                                                    "id-ID"
                                                                )}
                                                            </div>

                                                        </div>

                                                    </button>
                                                );
                                            }
                                        )}

                                    </div>
                                )}

                        </section>

                        {/* PAYMENT */}

                        <section className="rounded-3xl border border-gray-200 bg-white p-6">

                            <h2 className="text-lg font-bold">
                                Metode Pembayaran
                            </h2>

                            <div className="mt-5 space-y-3">

                                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border p-4">

                                    <input
                                        type="radio"
                                        name="payment"
                                        checked={
                                            paymentMethod ===
                                            "COD"
                                        }
                                        onChange={() =>
                                            setPaymentMethod(
                                                "COD"
                                            )
                                        }
                                    />

                                    <div>
                                        <div className="font-semibold">
                                            COD
                                        </div>

                                        <div className="text-sm text-gray-500">
                                            Bayar saat barang diterima.
                                        </div>
                                    </div>

                                </label>

                                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border p-4">

                                    <input
                                        type="radio"
                                        name="payment"
                                        checked={
                                            paymentMethod ===
                                            "BANK_TRANSFER"
                                        }
                                        onChange={() =>
                                            setPaymentMethod(
                                                "BANK_TRANSFER"
                                            )
                                        }
                                    />

                                    <div>
                                        <div className="font-semibold">
                                            Bank Transfer
                                        </div>

                                        <div className="text-sm text-gray-500">
                                            Pembayaran melalui Midtrans.
                                        </div>
                                    </div>

                                </label>

                                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border p-4">

                                    <input
                                        type="radio"
                                        name="payment"
                                        checked={
                                            paymentMethod ===
                                            "E_WALLET"
                                        }
                                        onChange={() =>
                                            setPaymentMethod(
                                                "E_WALLET"
                                            )
                                        }
                                    />

                                    <div>
                                        <div className="font-semibold">
                                            E-Wallet
                                        </div>

                                        <div className="text-sm text-gray-500">
                                            GoPay / ShopeePay melalui Midtrans.
                                        </div>
                                    </div>

                                </label>

                                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border p-4">

                                    <input
                                        type="radio"
                                        name="payment"
                                        checked={
                                            paymentMethod ===
                                            "QRIS"
                                        }
                                        onChange={() =>
                                            setPaymentMethod(
                                                "QRIS"
                                            )
                                        }
                                    />

                                    <div>
                                        <div className="font-semibold">
                                            QRIS
                                        </div>

                                        <div className="text-sm text-gray-500">
                                            Bayar menggunakan QRIS melalui Midtrans.
                                        </div>
                                    </div>

                                </label>

                            </div>

                        </section>

                    </div>

                    {/* SUMMARY */}

                    <aside className="h-fit rounded-3xl border border-gray-200 bg-white p-6 lg:sticky lg:top-6">

                        <h2 className="text-lg font-bold">
                            Ringkasan
                        </h2>

                        <div className="mt-5 space-y-4 text-sm">

                            <div className="flex justify-between">
                                <span className="text-gray-500">
                                    Produk
                                </span>

                                <span className="font-medium">
                                    Rp{" "}
                                    {data.subtotal.toLocaleString(
                                        "id-ID"
                                    )}
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-500">
                                    Berat
                                </span>

                                <span className="font-medium">
                                    {data.totalWeight.toLocaleString(
                                        "id-ID"
                                    )}{" "}
                                    gram
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-500">
                                    Ongkir
                                </span>

                                <span className="font-medium">
                                    {selectedShipping
                                        ? `Rp ${shippingCost.toLocaleString(
                                            "id-ID"
                                        )}`
                                        : "Belum dipilih"}
                                </span>
                            </div>

                            <div className="border-t pt-4">

                                <div className="flex justify-between">

                                    <span className="font-bold">
                                        Total
                                    </span>

                                    <span className="text-xl font-bold text-rose-600">
                                        Rp{" "}
                                        {grandTotal.toLocaleString(
                                            "id-ID"
                                        )}
                                    </span>

                                </div>

                            </div>

                        </div>

                        <button
                            type="button"
                            onClick={createOrder}
                            disabled={
                                creatingOrder ||
                                snapLoading ||
                                !address ||
                                !selectedShipping
                            }
                            className="mt-6 w-full rounded-xl bg-rose-600 px-5 py-3 font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                        >
                            {creatingOrder
                                ? "Memproses..."
                                : !address
                                    ? "Pilih Alamat"
                                    : !selectedShipping
                                        ? "Pilih Pengiriman"
                                        : paymentMethod === "COD"
                                            ? "Buat Pesanan"
                                            : snapLoading
                                                ? "Memuat Pembayaran..."
                                                : "Bayar Sekarang"}
                        </button>

                    </aside>

                </div>
            </div>
        </main>
    );
}