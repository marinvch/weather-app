import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { MapPin, Layers } from 'lucide-react';
import type { Coordinates } from '../../types/weather';

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
        const { lat, lng } = e.latlng;

        try {
          // Enhanced reverse geocoding with better zoom level
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1&accept-language=en`,
            {
              headers: {
                'User-Agent': 'WeatherApp/1.0'
              }
            }
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
              locationName = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            }

            onLocationSelect({ latitude: lat, longitude: lng }, locationName);
          } else {
            onLocationSelect({ latitude: lat, longitude: lng }, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
          }
        } catch (error) {
          console.error('Error with reverse geocoding:', error);
          onLocationSelect({ latitude: lat, longitude: lng }, `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
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
      .bindPopup(`<b>${locationName}</b><br/>Lat: ${coordinates.latitude.toFixed(4)}<br/>Lng: ${coordinates.longitude.toFixed(4)}`)
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
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Weather Map
          </CardTitle>

          <Button
            size="sm"
            variant="outline"
            onClick={centerOnLocation}
            className="flex items-center gap-1"
          >
            <MapPin className="w-3 h-3" />
            Center
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Weather Layer Controls - Windy style */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Weather Layers</div>
          <div className="flex flex-wrap gap-2">
            {weatherLayers.map((layer) => (
              <Button
                key={layer.id}
                size="sm"
                variant={layer.active ? "default" : "outline"}
                onClick={() => toggleWeatherLayer(layer.id)}
                className={`flex items-center gap-1 transition-all`}
              >
                {layer.icon}
                {layer.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Map Container */}
        <div className="relative h-96 w-full rounded-xl overflow-hidden border-2 border-gray-200 shadow-lg">
          <div ref={mapRef} className="h-full w-full" />

          {/* Controls Overlay */}
          <div className="absolute top-4 left-4 border-2 border-gray-600 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md text-sm">
            <div className="font-medium text-gray-800">🗺️ Interactive Weather Map</div>
            <div className="text-gray-600 text-xs">Click anywhere to select location</div>
          </div>

          {/* Active Layers Indicator */}
          {weatherLayers.some(layer => layer.active) && (
            <div className="absolute top-4 right-4 border-2 border-gray-600 backdrop-blur-sm px-3 py-2 rounded-lg shadow-md text-gray-800 text-sm">
              <div className="font-medium">Weather Data Active</div>
              <div className="text-muted-foreground text-xs">
                {weatherLayers.filter(layer => layer.active).length} layer(s) shown
              </div>
            </div>
          )}

          {/* Zoom to Location Button */}
          <div className="absolute bottom-4 right-4">
            <Button
              size="sm"
              onClick={centerOnLocation}
              className="border-2 border-gray-800 text-gray-800 shadow-lg flex items-center gap-1 hover:border-cyan-600 hover:text-cyan-600"
            >
              <MapPin className="w-3 h-3" />
              My Location
            </Button>
          </div>
        </div>

        {/* Current Location Info - Enhanced */}
        <div className="p-4 rounded-lg border-2 border-gray-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <div className="font-medium text-gray-800">📍 Current Location</div>
              <div className="text-gray-600">{locationName}</div>
            </div>
            <div>
              <div className="font-medium text-gray-800">🌐 Coordinates</div>
              <div className="text-gray-600 font-mono">
                {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
              </div>
            </div>
          </div>
        </div>

        {/* Instructions */}
        {onLocationSelect && (
          <div className="text-sm border p-3 rounded-lg">
            <div className="font-medium mb-1">💡 How to use this map:</div>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>• <strong>Click anywhere</strong> on the map to select a new weather location</li>
              <li>• <strong>Toggle weather layers</strong> above to see precipitation, temperature, wind, etc.</li>
              <li>• <strong>Use layer control</strong> (top-right of map) to switch between Satellite, Terrain, etc.</li>
              <li>• <strong>Zoom and pan</strong> to explore different regions</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
