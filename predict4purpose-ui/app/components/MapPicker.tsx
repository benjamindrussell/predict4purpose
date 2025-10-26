"use client";
import { MapContainer, TileLayer, Marker, useMapEvents, Circle } from "react-leaflet";
import * as L from "leaflet";
import { useEffect, useMemo, useState } from "react";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

type LatLng = { lat: number; lng: number };

function resolveImageUrl(img: unknown): string {
  if (typeof img === "string") return img;
  if (img && typeof (img as any).src === "string") return (img as any).src as string;
  return "";
}

function useDefaultIconFix() {
  useEffect(() => {
    // Ensure default marker icons load correctly in Next.js by explicitly
    // providing the resolved asset URLs from the Leaflet package.
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: resolveImageUrl(markerIcon2x),
      iconUrl: resolveImageUrl(markerIcon),
      shadowUrl: resolveImageUrl(markerShadow),
    });
  }, []);
}

function ClickHandler({ onClick }: { onClick: (pos: LatLng) => void }) {
  useMapEvents({
    click(e: L.LeafletMouseEvent) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function MapPicker({
  value,
  onChange,
  radiusMeters = 5000,
}: {
  value: LatLng | null;
  onChange: (pos: LatLng) => void;
  radiusMeters?: number;
}) {
  useDefaultIconFix();
  const [center, setCenter] = useState<LatLng>({ lat: 20, lng: 0 });

  const explicitIcon = useMemo(
    () =>
      L.icon({
        // Use a custom red pin SVG in public/ to override the default blue marker
        iconRetinaUrl: "/marker-pin-red.svg",
        iconUrl: "/marker-pin-red.svg",
        shadowUrl: resolveImageUrl(markerShadow),
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        tooltipAnchor: [16, -28],
        shadowSize: [41, 41],
      }),
    []
  );

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {}
      );
    }
  }, []);

  const position = value ?? center;
  // Draw a distance circle around the selected point for visual feedback

  return (
    <MapContainer
      center={[position.lat, position.lng]}
      zoom={value ? 10 : 2}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onClick={onChange} />
      {value && (
        <>
          <Circle
            center={[value.lat, value.lng]}
            radius={radiusMeters}
            pathOptions={{ color: "var(--red)", fillColor: "var(--pink)", fillOpacity: 0.15 }}
          />
          <Marker position={[value.lat, value.lng]} icon={explicitIcon} />
        </>
      )}
    </MapContainer>
  );
}


