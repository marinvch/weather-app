import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { formatCoordinates, normalizeCoordinates } from '@/shared/lib/geo';
import type { Coordinates } from '@/shared/types/weather';

// Fix for default markers in Leaflet with Webpack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface WeatherMapProps {
  coordinates: Coordinates;
  locationName: string;
  onLocationSelect?: (coords: Coordinates, name: string) => void;
  className?: string;
}

interface WeatherLayer {
  id: string;
  name: string;
  icon: React.ReactNode;
  url: string;
  active: boolean;
}

export function WeatherMap({ coordinates, locationName, onLocationSelect, className }: WeatherMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const weatherLayersRef = useRef<Map<string, L.TileLayer>>(new Map());

  const [weatherLayers, setWeatherLayers] = useState<WeatherLayer[]>([
    // Temporarily removed weather overlays as OpenWeatherMap demo tiles don't work
    // Future enhancement: Integrate with Windy API or other working tile provider
  ]);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [coordinates.latitude, coordinates.longitude],
      zoom: 8,
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
    });

    // Add multiple base map options (Windy-style)
    const baseMaps = {
      'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      }),
      'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles © Esri',
        maxZoom: 18,
      }),
      'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenTopoMap contributors',
        maxZoom: 17,
      }),
    };

    // Add default base layer
    baseMaps['OpenStreetMap'].addTo(map);

    // Add layer control
    L.control.layers(baseMaps).addTo(map);

    // Custom map styles
    const mapContainer = mapRef.current;
    if (mapContainer) {
      mapContainer.style.borderRadius = '12px';
      mapContainer.style.overflow = 'hidden';
    }

    // Add click handler for location selection
    if (onLocationSelect) {
      map.on('click', async (e) => {
        // Leaflet's LatLng is WGS 84, same as everything downstream — but a map
        // dragged past the antimeridian reports longitudes outside ±180, which
        // Nominatim and Open-Meteo both reject. Wrap at the boundary.
        const picked = normalizeCoordinates({
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
        });
        const { latitude: lat, longitude: lng } = picked;

        try {
          // Enhanced reverse geocoding with better zoom level.
          // No custom headers, deliberately — see features/location/lib/
          // geolocation.ts. A `User-Agent` here made the request non-simple,
          // triggering a CORS preflight Nominatim rejects, so every map click
          // fell through to the raw-coordinate fallback below.
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&accept-language=en`
          );

          if (response.ok) {
            const data = await response.json();
            const address = data.address || {};

            // Better location name extraction
            const city = address.village || address.town || address.city || address.municipality || address.hamlet;
            const region = address.state || address.county || address.province;
            const country = address.country;

            let locationName = '';
            if (city && country) {
              locationName = region ? `${city}, ${region}, ${country}` : `${city}, ${country}`;
            } else {
              locationName = data.display_name || formatCoordinates(picked);
            }

            onLocationSelect(picked, locationName);
          } else {
            onLocationSelect(picked, formatCoordinates(picked));
          }
        } catch (error) {
          console.error('Error with reverse geocoding:', error);
          onLocationSelect(picked, formatCoordinates(picked));
        }
      });
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [coordinates.latitude, coordinates.longitude, onLocationSelect]);

  // Update map center and marker when coordinates change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const newLatLng = new L.LatLng(coordinates.latitude, coordinates.longitude);

    // Update map center
    map.setView(newLatLng, map.getZoom());

    // Remove existing marker
    if (markerRef.current) {
      map.removeLayer(markerRef.current);
    }

    // Add new marker
    const marker = L.marker(newLatLng)
      .addTo(map)
      .bindPopup(`<b>${locationName}</b><br/>${formatCoordinates(coordinates)}`)
      .openPopup();

    markerRef.current = marker;
  }, [coordinates, locationName]);

  // Toggle weather layer
  const toggleWeatherLayer = (layerId: string) => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const layersMap = weatherLayersRef.current;

    setWeatherLayers(prev => prev.map(layer => {
      if (layer.id === layerId) {
        const isActive = !layer.active;

        if (isActive) {
          // Use demo layer - in production you'd use real API key
          const weatherLayer = L.tileLayer(layer.url, {
            attribution: '© OpenWeatherMap',
            opacity: 0.7,
            maxZoom: 18,
          });

          weatherLayer.addTo(map);
          layersMap.set(layerId, weatherLayer);
        } else {
          const existingLayer = layersMap.get(layerId);
          if (existingLayer) {
            map.removeLayer(existingLayer);
            layersMap.delete(layerId);
          }
        }

        return { ...layer, active: isActive };
      }
      return layer;
    }));
  };

  // Fit map to current location
  const centerOnLocation = () => {
    if (!mapInstanceRef.current) return;

    mapInstanceRef.current.setView(
      [coordinates.latitude, coordinates.longitude],
      12
    );
  };

  return (
    <Card className={className}>
      <CardHeader
        title="Weather map"
        slotProps={{ title: { variant: 'h6', component: 'h2' } }}
        action={
          <Button
            size="small"
            variant="outlined"
            startIcon={<MyLocationIcon />}
            onClick={centerOnLocation}
          >
            Centre
          </Button>
        }
      />

      <CardContent>
        <Stack spacing={2}>
          {/*
            Empty today: the OpenWeatherMap demo overlay tiles were removed and
            no replacement provider is wired in, so this renders nothing rather
            than an empty control strip.
          */}
          {weatherLayers.length > 0 && (
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
              {weatherLayers.map((layer) => (
                <Button
                  key={layer.id}
                  size="small"
                  variant={layer.active ? 'contained' : 'outlined'}
                  onClick={() => toggleWeatherLayer(layer.id)}
                >
                  {layer.name}
                </Button>
              ))}
            </Stack>
          )}

          <Box
            sx={{
              position: 'relative',
              height: 384,
              width: '100%',
              borderRadius: 2,
              overflow: 'hidden',
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Box ref={mapRef} sx={{ height: '100%', width: '100%' }} />

            {onLocationSelect && (
              // zIndex 400 clears Leaflet's own panes, which sit at 200-400.
              <Paper
                elevation={2}
                sx={{ position: 'absolute', top: 12, left: 12, px: 1.5, py: 1, zIndex: 400 }}
              >
                <Typography variant="caption">
                  Click anywhere to choose a location
                </Typography>
              </Paper>
            )}

            <Box sx={{ position: 'absolute', bottom: 12, right: 12, zIndex: 400 }}>
              <Button
                size="small"
                variant="contained"
                startIcon={<MyLocationIcon />}
                onClick={centerOnLocation}
              >
                My location
              </Button>
            </Box>
          </Box>

          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: '1 1 200px' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Location
              </Typography>
              <Typography variant="body2">{locationName}</Typography>
            </Box>
            <Box sx={{ flex: '1 1 200px' }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Coordinates
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {formatCoordinates(coordinates)}
              </Typography>
            </Box>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
