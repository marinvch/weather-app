import { formatCoordinates, normalizeCoordinates } from '@/shared/lib/geo';
import type { Coordinates } from '@/shared/types/weather';

export interface LocationInfo {
  coordinates: Coordinates;
  city: string;
  country: string;
  region?: string;
  countryCode: string;
  displayName: string;
  emergencyNumbers: EmergencyNumbers;
}

export interface EmergencyNumbers {
  police: string;
  medical: string;
  fire: string;
  maritime?: string;
  mountain?: string;
  general: string;
}

// Emergency numbers by country code
const EMERGENCY_NUMBERS: Record<string, EmergencyNumbers> = {
  US: {
    police: "911",
    medical: "911",
    fire: "911",
    maritime: "911 / Coast Guard 16 (VHF)",
    mountain: "911",
    general: "911",
  },
  GB: {
    police: "999",
    medical: "999",
    fire: "999",
    maritime: "999 / Coastguard 16 (VHF)",
    mountain: "999 / Mountain Rescue",
    general: "999",
  },
  ES: {
    police: "091",
    medical: "061",
    fire: "080",
    maritime: "112 / Salvamento Marítimo",
    mountain: "112 / Guardia Civil GREIM",
    general: "112",
  },
  DE: {
    police: "110",
    medical: "112",
    fire: "112",
    maritime: "112 / DGzRS",
    mountain: "112 / Bergwacht",
    general: "112",
  },
  FR: {
    police: "17",
    medical: "15",
    fire: "18",
    maritime: "112 / CROSS",
    mountain: "112 / PGHM",
    general: "112",
  },
  IT: {
    police: "113",
    medical: "118",
    fire: "115",
    maritime: "112 / Capitaneria di Porto",
    mountain: "112 / Soccorso Alpino",
    general: "112",
  },
  GR: {
    police: "100",
    medical: "166",
    fire: "199",
    maritime: "108 / Coast Guard",
    mountain: "112 / EMAK",
    general: "112",
  },
  AU: {
    police: "000",
    medical: "000",
    fire: "000",
    maritime: "000 / Marine Rescue",
    mountain: "000 / SES",
    general: "000",
  },
  CA: {
    police: "911",
    medical: "911",
    fire: "911",
    maritime: "911 / Coast Guard 16 (VHF)",
    mountain: "911",
    general: "911",
  },
  JP: {
    police: "110",
    medical: "119",
    fire: "119",
    maritime: "118 / Coast Guard",
    mountain: "110",
    general: "110",
  },
  BG: {
    police: "166",
    medical: "150",
    fire: "160",
    maritime: "112 / Border Police Maritime",
    mountain: "112 / Mountain Rescue Service",
    general: "112",
  },
  // Default for unknown countries
  DEFAULT: {
    police: "112",
    medical: "112",
    fire: "112",
    maritime: "112",
    mountain: "112",
    general: "112",
  },
};

export async function getCurrentLocation(): Promise<LocationInfo> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        // The Geolocation API is WGS 84 by specification, same as everything
        // downstream — see @/shared/lib/geo. Normalizing is a no-op here and
        // is kept so the boundary is explicit.
        const coords = normalizeCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });

        try {
          const locationInfo = await getLocationInfo(coords);
          resolve(locationInfo);
        } catch {
          // Fallback to basic coordinates if reverse geocoding fails
          resolve({
            coordinates: coords,
            city: "Unknown",
            country: "Unknown",
            countryCode: "DEFAULT",
            displayName: formatCoordinates(coords),
            emergencyNumbers: EMERGENCY_NUMBERS.DEFAULT,
          });
        }
      },
      (error) => {
        reject(new Error(`Failed to get your location: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      }
    );
  });
}

export async function getLocationInfo(
  input: Coordinates
): Promise<LocationInfo> {
  // Nominatim's `lat`/`lon` are WGS 84 and it rejects out-of-range values, so
  // a point dragged past the antimeridian on the map is wrapped here.
  const coordinates = normalizeCoordinates(input);

  try {
    // Use Nominatim (OpenStreetMap) free reverse geocoding service
    // No custom headers, deliberately. This used to send a User-Agent, which
    // browsers forbid scripts from setting — and including it made the request
    // non-simple, triggering a CORS preflight that Nominatim rejects. The fetch
    // failed every time and the caller quietly fell back to raw coordinates, so
    // reverse geocoding never actually worked in the browser.
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coordinates.latitude}&lon=${coordinates.longitude}&zoom=10&addressdetails=1&accept-language=en`
    );

    if (!response.ok) {
      throw new Error("Geocoding service unavailable");
    }

    const data = await response.json();

    // Extract location information with better handling for Bulgaria
    const address = data.address || {};

    // Better city detection for Bulgaria and other countries
    const city =
      address.city ||
      address.town ||
      address.municipality ||
      address.village ||
      address.suburb ||
      address.hamlet ||
      "Unknown";

    const country = address.country || "Unknown";
    const region =
      address.state || address.province || address.region || address.county;
    const countryCode = address.country_code?.toUpperCase() || "DEFAULT";

    // Create display name with better formatting
    let displayName = "";
    if (city !== "Unknown" && country !== "Unknown") {
      displayName = region
        ? `${city}, ${region}, ${country}`
        : `${city}, ${country}`;
    } else {
      displayName = data.display_name || formatCoordinates(coordinates);
    }

    // Get emergency numbers for the country
    const emergencyNumbers =
      EMERGENCY_NUMBERS[countryCode] || EMERGENCY_NUMBERS.DEFAULT;

    return {
      coordinates,
      city,
      country,
      region,
      countryCode,
      displayName,
      emergencyNumbers,
    };
  } catch (err) {
    console.error("Reverse geocoding failed:", err);

    // Fallback response
    return {
      coordinates,
      city: "Unknown",
      country: "Unknown",
      countryCode: "DEFAULT",
      displayName: formatCoordinates(coordinates),
      emergencyNumbers: EMERGENCY_NUMBERS.DEFAULT,
    };
  }
}

export function getEmergencyNumber(
  countryCode: string,
  type: keyof EmergencyNumbers
): string {
  const numbers = EMERGENCY_NUMBERS[countryCode] || EMERGENCY_NUMBERS.DEFAULT;
  return numbers[type] || numbers.general;
}

export function isCoastalLocation(coordinates: Coordinates): boolean {
  // Simple heuristic - in a real app you'd use a proper coastal detection service
  // This is a basic check for known coastal areas
  const { latitude, longitude } = coordinates;

  // Check if near major coastlines (very basic implementation)
  // Mediterranean
  if (latitude >= 30 && latitude <= 46 && longitude >= -6 && longitude <= 36)
    return true;
  // Atlantic European coast
  if (latitude >= 36 && latitude <= 71 && longitude >= -25 && longitude <= 5)
    return true;
  // US East coast
  if (latitude >= 25 && latitude <= 45 && longitude >= -85 && longitude <= -65)
    return true;
  // US West coast
  if (
    latitude >= 32 &&
    latitude <= 49 &&
    longitude >= -125 &&
    longitude <= -115
  )
    return true;
  // Australian coast
  if (
    latitude >= -45 &&
    latitude <= -10 &&
    longitude >= 110 &&
    longitude <= 155
  )
    return true;

  return false;
}

export function isMountainousLocation(coordinates: Coordinates): boolean {
  // Simple heuristic for mountainous regions
  const { latitude, longitude } = coordinates;

  // Alps
  if (latitude >= 45 && latitude <= 48 && longitude >= 5 && longitude <= 17)
    return true;
  // Pyrenees
  if (latitude >= 42 && latitude <= 43 && longitude >= -2 && longitude <= 3)
    return true;
  // Rocky Mountains
  if (
    latitude >= 31 &&
    latitude <= 49 &&
    longitude >= -115 &&
    longitude <= -102
  )
    return true;
  // Himalayas
  if (latitude >= 27 && latitude <= 35 && longitude >= 73 && longitude <= 95)
    return true;
  // Andes
  if (latitude >= -55 && latitude <= 12 && longitude >= -81 && longitude <= -66)
    return true;

  return false;
}
