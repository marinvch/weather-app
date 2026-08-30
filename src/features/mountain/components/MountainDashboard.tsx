import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { useMountainForecast } from '@/features/mountain/hooks/useMountainForecast';
import { useAppSelector } from '@/store/hooks';
import { Mountain, Wind, Snowflake, AlertTriangle, Eye, Thermometer } from 'lucide-react';
import type { Coordinates } from '@/shared/types/weather';

interface MountainDashboardProps {
  coordinates: Coordinates;
  locationName: string;
}

export function MountainDashboard({ coordinates }: MountainDashboardProps) {
  const units = useAppSelector((state) => state.userProfile.units);

  const {
    data: weatherData,
    isLoading,
    error,
  } = useMountainForecast(coordinates);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p>Loading mountain conditions...</p>
        </div>
      </div>
    );
  }

  if (error || !weatherData || !weatherData.current || !weatherData.hourly) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-destructive">Failed to load mountain weather data</p>
          <p className="text-sm text-muted-foreground">Please try again later</p>
        </div>
      </div>
    );
  }

  const current = weatherData.current;
  const hourly = weatherData.hourly;

  // Helper functions
  const getWindCondition = (speed: number) => {
    if (speed < 20) return { text: 'Calm', color: 'text-green-600', risk: 'low' };
    if (speed < 40) return { text: 'Breezy', color: 'text-yellow-600', risk: 'medium' };
    if (speed < 60) return { text: 'Windy', color: 'text-orange-600', risk: 'high' };
    return { text: 'Dangerous', color: 'text-red-600', risk: 'extreme' };
  };

  const getVisibilityCondition = (weatherCode: number) => {
    if ([45, 48].includes(weatherCode)) return { text: 'Poor (Fog)', color: 'text-red-600' };
    if ([51, 53, 55, 61, 63, 65].includes(weatherCode)) return { text: 'Reduced (Rain)', color: 'text-yellow-600' };
    if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return { text: 'Poor (Snow)', color: 'text-orange-600' };
    return { text: 'Good', color: 'text-green-600' };
  };

  const getAvalancheRisk = (temp: number, windSpeed: number, weatherCode: number) => {
    let risk = 0;

    // Temperature factor
    if (temp > -2 && temp < 2) risk += 2; // Rapid warming/cooling
    if (temp > 0) risk += 1; // Above freezing

    // Wind factor  
    if (windSpeed > 40) risk += 2;
    if (windSpeed > 60) risk += 1;

    // Precipitation factor
    if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) risk += 2; // Snow
    if ([61, 63, 65].includes(weatherCode) && temp < 5) risk += 1; // Rain on snow

    if (risk <= 2) return { level: 'Low', color: 'text-green-600', description: 'Generally safe conditions' };
    if (risk <= 4) return { level: 'Moderate', color: 'text-yellow-600', description: 'Use caution on steep slopes' };
    if (risk <= 6) return { level: 'High', color: 'text-orange-600', description: 'Avoid steep terrain' };
    return { level: 'Extreme', color: 'text-red-600', description: 'Travel not recommended' };
  };

  const wind10m = getWindCondition(current.wind_speed_10m || 0);
  const wind80m = getWindCondition(current.wind_speed_80m || 0);
  const wind120m = getWindCondition(current.wind_speed_120m || 0);
  const visibility = getVisibilityCondition(current.weather_code);
  const avalancheRisk = getAvalancheRisk(current.temperature_2m, current.wind_speed_10m || 0, current.weather_code);

  return (
    <div className="space-y-6">
      {/* Current Mountain Conditions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 text-center">
          <div className="flex items-center gap-2 justify-center text-sm mb-2">
            <Thermometer className="h-4 w-4 text-green-600" /> Temperature
          </div>
          <p className="text-2xl font-bold">
            {units === 'metric'
              ? `${Math.round(current.temperature_2m)}°C`
              : `${Math.round(current.temperature_2m * 9 / 5 + 32)}°F`
            }
          </p>
          <p className="text-sm text-muted-foreground">
            Feels like {Math.round(current.temperature_2m - 2)}°
          </p>
        </div>

        <div className="p-4 text-center">
          <div className="flex items-center gap-2 justify-center text-sm mb-2">
            <Wind className="h-4 w-4 text-green-600" /> Wind (Surface)
          </div>
          <p className="text-2xl font-bold">
            {units === 'metric'
              ? `${Math.round(current.wind_speed_10m || 0)} km/h`
              : `${Math.round((current.wind_speed_10m || 0) * 0.621371)} mph`
            }
          </p>
          <p className={`text-sm ${wind10m.color}`}>{wind10m.text}</p>
        </div>

        <div className="p-4 text-center">
          <div className="flex items-center gap-2 justify-center text-sm mb-2">
            <Eye className="h-4 w-4 text-green-600" /> Visibility
          </div>
          <p className={`text-2xl font-bold ${visibility.color}`}>
            {visibility.text.split(' ')[0]}
          </p>
          <p className="text-sm text-muted-foreground">
            {visibility.text.includes('(') ? visibility.text.split('(')[1].replace(')', '') : 'Clear conditions'}
          </p>
        </div>
      </div>      {/* Wind at Different Altitudes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mountain className="h-5 w-5 text-green-600" />
            Wind at Altitude
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 border rounded-lg">
              <div>
                <p className="font-medium">Surface (10m)</p>
                <p className="text-sm text-muted-foreground">Base conditions</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {units === 'metric'
                    ? `${Math.round(current.wind_speed_10m || 0)} km/h`
                    : `${Math.round((current.wind_speed_10m || 0) * 0.621371)} mph`
                  }
                </p>
                <p className={`text-sm ${wind10m.color}`}>{wind10m.text}</p>
              </div>
            </div>

            <div className="flex justify-between items-center p-3 border rounded-lg">
              <div>
                <p className="font-medium">Mid-altitude (80m)</p>
                <p className="text-sm text-muted-foreground">Ridge conditions</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {units === 'metric'
                    ? `${Math.round(current.wind_speed_80m || 0)} km/h`
                    : `${Math.round((current.wind_speed_80m || 0) * 0.621371)} mph`
                  }
                </p>
                <p className={`text-sm ${wind80m.color}`}>{wind80m.text}</p>
              </div>
            </div>

            <div className="flex justify-between items-center p-3 border rounded-lg">
              <div>
                <p className="font-medium">High altitude (120m)</p>
                <p className="text-sm text-muted-foreground">Peak conditions</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {units === 'metric'
                    ? `${Math.round(current.wind_speed_120m || 0)} km/h`
                    : `${Math.round((current.wind_speed_120m || 0) * 0.621371)} mph`
                  }
                </p>
                <p className={`text-sm ${wind120m.color}`}>{wind120m.text}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Avalanche Risk Assessment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Avalanche Risk Assessment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-4 h-4 rounded-full ${avalancheRisk.level === 'Low' ? 'bg-green-600' :
                  avalancheRisk.level === 'Moderate' ? 'bg-yellow-600' :
                    avalancheRisk.level === 'High' ? 'bg-orange-600' : 'bg-red-600'
                  }`} />
                <span className={`font-semibold text-lg ${avalancheRisk.color}`}>
                  {avalancheRisk.level}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                {avalancheRisk.description}
              </p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Temperature</p>
                  <p className="text-muted-foreground">{Math.round(current.temperature_2m)}°C</p>
                </div>
                <div>
                  <p className="font-medium">Wind Speed</p>
                  <p className="text-muted-foreground">{Math.round(current.wind_speed_10m || 0)} km/h</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hourly Mountain Forecast */}
      <Card>
        <CardHeader>
          <CardTitle>Mountain Forecast (24 Hours)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="flex space-x-4 pb-4 min-w-max">
              {hourly.time.slice(0, 24).map((time, index) => {
                const temp = hourly.temperature_2m[index];
                const windSpeed = hourly.wind_speed_10m[index];
                const precipitation = hourly.precipitation?.[index] || 0;
                const hour = new Date(time).getHours();
                const windCondition = getWindCondition(windSpeed);

                return (
                  <div key={time} className="text-center min-w-[100px] space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {hour === 0 ? '12 AM' : hour <= 12 ? `${hour} AM` : `${hour - 12} PM`}
                    </p>

                    <p className="font-semibold text-lg">
                      {Math.round(temp)}°
                    </p>

                    <div className="flex flex-col items-center">
                      <Wind className={`h-4 w-4 ${windCondition.color}`} />
                      <p className="text-xs">{Math.round(windSpeed)} km/h</p>
                    </div>

                    {precipitation > 0 && (
                      <div className="flex flex-col items-center">
                        <Snowflake className="h-4 w-4 text-blue-500" />
                        <p className="text-xs">{precipitation.toFixed(1)}mm</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
