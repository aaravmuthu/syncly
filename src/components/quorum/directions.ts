export function directionsUrl(v: {
  title: string;
  lat: number | null;
  lon: number | null;
  address?: string | null;
}) {
  if (v.lat != null && v.lon != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${v.lat},${v.lon}`;
  }
  const q = encodeURIComponent([v.title, v.address].filter(Boolean).join(" "));
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}
