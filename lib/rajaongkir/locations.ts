import { rajaOngkirFetch } from "./client";

export type RajaOngkirLocation = {
    id: number;
    name: string;
};

export async function getProvinces() {
    return rajaOngkirFetch<RajaOngkirLocation[]>(
        "/destination/province"
    );
}

export async function getCities(
    provinceId: number
) {
    return rajaOngkirFetch<RajaOngkirLocation[]>(
        `/destination/city/${provinceId}`
    );
}

export async function getDistricts(
    cityId: number
) {
    return rajaOngkirFetch<RajaOngkirLocation[]>(
        `/destination/district/${cityId}`
    );
}

export async function getSubdistricts(
    districtId: number
) {
    return rajaOngkirFetch<RajaOngkirLocation[]>(
        `/destination/sub-district/${districtId}`
    );
}