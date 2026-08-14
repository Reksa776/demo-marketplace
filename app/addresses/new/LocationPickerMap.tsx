"use client";

import { useEffect } from "react";

import {
    MapContainer,
    Marker,
    TileLayer,
    useMap,
    useMapEvents,
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type Location = {
    lat: number;
    lng: number;
};

const markerIcon = new L.Icon({
    iconUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",

    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

function MapClickHandler({
    onChange,
}: {
    onChange: (location: Location) => void;
}) {
    useMapEvents({
        click(event) {
            onChange({
                lat: event.latlng.lat,
                lng: event.latlng.lng,
            });
        },
    });

    return null;
}

function MapCenter({
    location,
}: {
    location: Location;
}) {
    const map = useMap();

    useEffect(() => {
        map.flyTo(
            [location.lat, location.lng],
            map.getZoom()
        );
    }, [location.lat, location.lng, map]);

    return null;
}

type LocationPickerMapProps = {
    location: Location;
    onChange: (location: Location) => void;
};

export default function LocationPickerMap({
    location,
    onChange,
}: LocationPickerMapProps) {
    return (
        <MapContainer
            center={[location.lat, location.lng]}
            zoom={15}
            scrollWheelZoom={true}
            className="h-[400px] w-full"
        >
            <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapClickHandler onChange={onChange} />

            <MapCenter location={location} />

            <Marker
                position={[location.lat, location.lng]}
                icon={markerIcon}
                draggable={true}
                eventHandlers={{
                    dragend: (event) => {
                        const marker = event.target;
                        const position = marker.getLatLng();

                        onChange({
                            lat: position.lat,
                            lng: position.lng,
                        });
                    },
                }}
            />
        </MapContainer>
    );
}