import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { WeatherMap } from '../WeatherMap/WeatherMap';
import { useGetMarineDataQuery } from '../../store/api/marineApi';
import { useGetBasicForecastQuery } from '../../store/api/weatherApi';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setLocation, setLocationName } from '../../store/slices/userProfileSlice';
import { Waves, Wind, Thermometer, Navigation, Map } from 'lucide-react';
import { getButtonClasses } from '../../utils/themes';
import type { Coordinates } from '../../types/weather';

interface MarineDashboardProps {
  coordinates: Coordinates;
  locationName: string;
}

export function MarineDashboard({ coordinates, locationName }: MarineDashboardProps) {
  const units = useAppSelector((state) => state.userProfile.units);
  const dispatch = useAppDispatch();
  const [showMap, setShowMap] = useState(false);

  // Coastal test locations with good marine data
  const testLocations = [
    { name: "Santander, Spain", coords: { latitude: 43.7696, longitude: -11.4550 } },
    { name: "Baltic Sea, Germany", coords: { latitude: 54.5445, longitude: 10.2275 } },
    { name: "Gibraltar, Mediterranean", coords: { latitude: 36.1408, longitude: -5.3536 } },
    { name: "Miami Beach, FL", coords: { latitude: 25.7617, longitude: -80.1918 } }
  ];

  const switchToLocation = (name: string, coords: Coordinates) => {
    dispatch(setLocation(coords));
    dispatch(setLocationName(name));
  };

  const handleLocationSelect = (coords: Coordinates, name: string) => {
    dispatch(setLocation(coords));
    dispatch(setLocationName(name));
  };

  // Helper function for wind direction
  const getDirectionText = (degrees: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(degrees / 22.5) % 16];
  };

  const {
    data: marineData,
    isLoading: marineLoading,
    error: marineError,
  } = useGetMarineDataQuery(coordinates);

  // Debug logging
  console.log('Marine API Debug:', {
    coordinates,
    marineData,
    marineError,
    marineLoading
  });

  const {
    data: weatherData,
    isLoading: weatherLoading,
    error: weatherError,
  } = useGetBasicForecastQuery(coordinates);

  if (marineLoading || weatherLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-8 h-8 mx-auto mb-4 border-b-2 rounded-full animate-spin border-cyan-600"></div>
          <p>Loading marine conditions...</p>
        </div>
      </div>
    );
  }

  // If both marine and weather data fail, show error
  if ((marineError || !marineData) && (weatherError || !weatherData)) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="space-y-4 text-center">
          <p className="text-destructive">Failed to load weather data</p>
          <p className="text-sm text-muted-foreground">Please check your connection and try again</p>
        </div>
      </div>
    );
  }

  // If marine data fails but weather data is available, show marine analysis with weather data
  if ((marineError || !marineData) && weatherData) {
    console.log('Marine data unavailable, showing fallback:', marineError);
    return (
      <div className="space-y-6">
        {/* Marine Analysis with Weather Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Waves className="w-5 h-5 text-cyan-600" />
              Marine Conditions for {locationName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-8 space-y-4 text-center">
              <div className="text-6xl text-yellow-600">⚠️</div>
              <p className="text-lg font-semibold">Limited Marine Data Available</p>
              <p className="text-muted-foreground">
                This location may be inland or have limited marine coverage.
              </p>
              <p className="text-sm text-muted-foreground">
                Try one of these coastal locations for full marine data:
              </p>
              <div className="grid grid-cols-1 gap-2 mt-4 md:grid-cols-2">
                {testLocations.map((location) => (
                  <Button
                    key={location.name}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => switchToLocation(location.name, location.coords)}
                  >
                    📍 {location.name}
                  </Button>
                ))}
              </div>
              <div className="mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => setShowMap(!showMap)}
                >
                  <Map className="w-4 h-4" />
                  {showMap ? 'Hide Map' : 'Show Interactive Map'}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Click locations above or use the map to test marine conditions at coastal areas
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Weather Conditions for Marine Activities */}
        <Card>
          <CardHeader>
            <CardTitle>Weather Conditions for Marine Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="p-4 text-center border rounded-lg">
                <Thermometer className="w-6 h-6 mx-auto mb-2 text-cyan-600" />
                <p className="text-sm text-muted-foreground">Temperature</p>
                <p className="text-xl font-semibold">
                  {weatherData.current && units === 'metric'
                    ? `${Math.round(weatherData.current.temperature_2m)}°C`
                    : weatherData.current
                      ? `${Math.round(weatherData.current.temperature_2m * 9 / 5 + 32)}°F`
                      : 'N/A'
                  }
                </p>
              </div>

              <div className="p-4 text-center border rounded-lg">
                <Wind className="w-6 h-6 mx-auto mb-2 text-cyan-600" />
                <p className="text-sm text-muted-foreground">Wind Speed</p>
                <p className="text-xl font-semibold">
                  {weatherData.current && units === 'metric'
                    ? `${Math.round(weatherData.current.wind_speed_10m)} km/h`
                    : weatherData.current
                      ? `${Math.round(weatherData.current.wind_speed_10m * 0.621371)} mph`
                      : 'N/A'
                  }
                </p>
                <p className="text-xs text-muted-foreground">
                  {weatherData.current ? getDirectionText(weatherData.current.wind_direction_10m) : 'N/A'}
                </p>
              </div>

              <div className="p-4 text-center border rounded-lg">
                <Navigation className="w-6 h-6 mx-auto mb-2 text-cyan-600" />
                <p className="text-sm text-muted-foreground">Humidity</p>
                <p className="text-xl font-semibold">
                  {weatherData.current ? `${weatherData.current.relative_humidity_2m}%` : 'N/A'}
                </p>
              </div>

              <div className="p-4 text-center border rounded-lg">
                <Waves className="w-6 h-6 mx-auto mb-2 text-cyan-600" />
                <p className="text-sm text-muted-foreground">Precipitation</p>
                <p className="text-xl font-semibold">
                  {weatherData.current ? `${weatherData.current.precipitation || 0} mm` : 'N/A'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Marine Safety Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Marine Activity Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {weatherData.aiAnalysis && (
                <div className="p-4 border rounded-lg">
                  <p className="mb-2 font-medium">AI Analysis</p>
                  <p className="text-foreground">{weatherData.aiAnalysis.recommendation}</p>
                  {weatherData.aiAnalysis.profileSpecificTips.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {weatherData.aiAnalysis.profileSpecificTips.map((tip, index) => (
                        <li key={index} className="text-sm text-muted-foreground">• {tip}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 mt-4 md:grid-cols-2">
                <div className="p-3 border rounded">
                  <p className="font-medium">Wind Conditions</p>
                  <p className="text-sm text-muted-foreground">
                    {weatherData.current && weatherData.current.wind_speed_10m > 25
                      ? "Strong winds - caution advised"
                      : weatherData.current && weatherData.current.wind_speed_10m > 15
                        ? "Moderate winds - suitable for experienced mariners"
                        : weatherData.current
                          ? "Light winds - good conditions"
                          : "Wind data unavailable"
                    }
                  </p>
                </div>

                <div className="p-3 border rounded">
                  <p className="font-medium">Visibility</p>
                  <p className="text-sm text-muted-foreground">
                    {weatherData.current ? (weatherData.current.is_day ? "Daylight conditions" : "Night conditions") : "Visibility data unavailable"}
                    {weatherData.current && weatherData.current.cloud_cover && weatherData.current.cloud_cover > 80 && " - Overcast"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Interactive Map */}
        {showMap && (
          <WeatherMap
            coordinates={coordinates}
            locationName={locationName}
            onLocationSelect={handleLocationSelect}
            className="mb-6"
          />
        )}

        {/* Suggestion to try coastal location */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2 text-center">
              <p className="text-sm font-medium">💡 Pro Tip</p>
              <p className="text-xs text-muted-foreground">
                For detailed marine conditions, try selecting a coastal location on the map
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If we have marine data, process it
  if (!marineData) {
    return null; // This should never happen due to earlier checks, but TypeScript needs it
  }

  const currentHour = new Date().getHours();
  const currentIndex = Math.min(currentHour, marineData.hourly.time.length - 1);

  const currentConditions = {
    waveHeight: marineData.hourly.wave_height[currentIndex],
    waveDirection: marineData.hourly.wave_direction[currentIndex],
    wavePeriod: marineData.hourly.wave_period[currentIndex],
    seaTemp: marineData.hourly.sea_surface_temperature[currentIndex],
    currentVelocity: marineData.hourly.ocean_current_velocity[currentIndex],
    currentDirection: marineData.hourly.ocean_current_direction[currentIndex],
  };

  const getSeaCondition = (waveHeight: number | null) => {
    if (waveHeight == null) return { text: 'No Data', color: 'text-gray-500' };
    if (waveHeight < 0.5) return { text: 'Calm', color: 'text-green-600' };
    if (waveHeight < 1.0) return { text: 'Slight', color: 'text-yellow-600' };
    if (waveHeight < 2.0) return { text: 'Moderate', color: 'text-orange-600' };
    if (waveHeight < 4.0) return { text: 'Rough', color: 'text-red-600' };
    return { text: 'Very Rough', color: 'text-red-800' };
  };

  const seaCondition = getSeaCondition(currentConditions.waveHeight);

  return (
    <div className="space-y-6">
      {/* Map Toggle Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          className={`flex items-center gap-2 ${getButtonClasses('secondary')}`}
          onClick={() => setShowMap(!showMap)}
        >
          <Map className="w-4 h-4" />
          {showMap ? 'Hide Map' : 'Show Map'}
        </Button>
      </div>

      {/* Interactive Map */}
      {showMap && (
        <WeatherMap
          coordinates={coordinates}
          locationName={locationName}
          onLocationSelect={handleLocationSelect}
          className="mb-6"
        />
      )}

      {/* Current Marine Conditions */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2 text-sm">
            <Waves className="w-4 h-4 text-cyan-600" /> Wave Height
          </div>
          <p className="text-2xl font-bold">
            {currentConditions.waveHeight != null ? `${currentConditions.waveHeight.toFixed(1)}m` : 'N/A'}
          </p>
          <p className={`text-sm ${seaCondition.color}`}>{seaCondition.text}</p>
        </div>
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2 text-sm">
            <Navigation className="w-4 h-4 text-cyan-600" /> Wave Direction
          </div>
          <p className="text-2xl font-bold">
            {currentConditions.waveDirection != null ? getDirectionText(currentConditions.waveDirection) : 'N/A'}
          </p>
          <p className="text-sm text-muted-foreground">
            {currentConditions.waveDirection != null ? `${Math.round(currentConditions.waveDirection)}°` : 'N/A'}
          </p>
        </div>
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2 text-sm">
            <Thermometer className="w-4 h-4 text-cyan-600" /> Sea Temperature
          </div>
          <p className="text-2xl font-bold">
            {currentConditions.seaTemp != null
              ? units === 'metric'
                ? `${Math.round(currentConditions.seaTemp)}°C`
                : `${Math.round(currentConditions.seaTemp * 9 / 5 + 32)}°F`
              : 'N/A'
            }
          </p>
        </div>
        <div className="p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2 text-sm">
            <Wind className="w-4 h-4 text-cyan-600" /> Current
          </div>
          <p className="text-2xl font-bold">
            {currentConditions.currentVelocity != null
              ? units === 'metric'
                ? `${currentConditions.currentVelocity.toFixed(1)} km/h`
                : `${(currentConditions.currentVelocity * 0.621371).toFixed(1)} mph`
              : 'N/A'
            }
          </p>
          <p className="text-sm text-muted-foreground">
            {currentConditions.currentDirection != null ? getDirectionText(currentConditions.currentDirection) : 'N/A'}
          </p>
        </div>
      </div>

      {/* Marine Forecast */}
      <Card>
        <CardHeader>
          <CardTitle>Marine Forecast (24 Hours)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="flex pb-4 space-x-4 min-w-max">
              {marineData?.hourly.time.slice(0, 24).map((time, index) => {
                const waveHeight = marineData.hourly.wave_height[index];
                const seaTemp = marineData.hourly.sea_surface_temperature[index];
                const hour = new Date(time).getHours();

                return (
                  <div key={time} className="text-center min-w-[100px] space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {hour === 0 ? '12 AM' : hour <= 12 ? `${hour} AM` : `${hour - 12} PM`}
                    </p>

                    <div className="space-y-1">
                      <p className="font-semibold">
                        {waveHeight != null ? `${waveHeight.toFixed(1)}m` : 'N/A'}
                      </p>
                      <div className={`w-2 h-8 mx-auto rounded border-2 ${waveHeight == null ? 'border-gray-300' :
                        waveHeight < 0.5 ? 'border-green-500' :
                          waveHeight < 1.0 ? 'border-yellow-500' :
                            waveHeight < 2.0 ? 'border-orange-500' : 'border-red-500'
                        }`} style={{ height: `${waveHeight != null ? Math.min(waveHeight * 20, 60) : 20}px` }} />
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {seaTemp != null ? `${Math.round(seaTemp)}°` : 'N/A'}
                    </p>
                  </div>
                );
              }) || []}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weather Conditions for Marine */}
      {weatherData?.current && (
        <Card>
          <CardHeader>
            <CardTitle>Weather Conditions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Temperature</p>
                <p className="text-xl font-semibold">
                  {units === 'metric'
                    ? `${Math.round(weatherData.current.temperature_2m)}°C`
                    : `${Math.round(weatherData.current.temperature_2m * 9 / 5 + 32)}°F`
                  }
                </p>
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">Wind Speed</p>
                <p className="text-xl font-semibold">
                  {units === 'metric'
                    ? `${Math.round(weatherData.current.wind_speed_10m)} km/h`
                    : `${Math.round(weatherData.current.wind_speed_10m * 0.621371)} mph`
                  }
                </p>
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">Wind Direction</p>
                <p className="text-xl font-semibold">
                  {getDirectionText(weatherData.current.wind_direction_10m)}
                </p>
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">Humidity</p>
                <p className="text-xl font-semibold">{weatherData.current.relative_humidity_2m}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
