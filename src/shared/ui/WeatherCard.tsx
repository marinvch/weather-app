import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { weatherCodes } from '@/shared/types/weather';
import type { CurrentWeather, UserProfile } from '@/shared/types/weather';

interface WeatherCardProps {
  weather: CurrentWeather;
  location: string;
  profile: UserProfile;
  units: 'metric' | 'imperial';
}

export function WeatherCard({ weather, location, profile, units }: WeatherCardProps) {
  const weatherInfo = weatherCodes[weather.weather_code] || {
    description: 'Unknown',
    icon: '❓'
  };

  const temperature = units === 'metric'
    ? `${Math.round(weather.temperature_2m)}°C`
    : `${Math.round(weather.temperature_2m * 9 / 5 + 32)}°F`;

  const windSpeed = units === 'metric'
    ? `${Math.round(weather.wind_speed_10m)} km/h`
    : `${Math.round(weather.wind_speed_10m * 0.621371)} mph`;

  const getWindDirection = (degrees: number) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return directions[Math.round(degrees / 22.5) % 16];
  };

  const getProfileSpecificData = () => {
    switch (profile) {
      case 'marine':
        return (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Wind</p>
              <p className="font-semibold">{windSpeed}</p>
              <p className="text-xs">{getWindDirection(weather.wind_direction_10m)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Humidity</p>
              <p className="font-semibold">{weather.relative_humidity_2m}%</p>
            </div>
          </div>
        );
      case 'mountain':
        return (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Wind</p>
              <p className="font-semibold">{windSpeed}</p>
              <p className="text-xs">{getWindDirection(weather.wind_direction_10m)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Visibility</p>
              <p className="font-semibold">{weather.is_day ? 'Day' : 'Night'}</p>
            </div>
          </div>
        );
      case 'agriculture':
        return (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Humidity</p>
              <p className="font-semibold">{weather.relative_humidity_2m}%</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Wind</p>
              <p className="font-semibold">{windSpeed}</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Humidity</p>
              <p className="font-semibold">{weather.relative_humidity_2m}%</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Wind</p>
              <p className="font-semibold">{windSpeed}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{location}</span>
          <span className="text-4xl">{weatherInfo.icon}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <p className="text-4xl font-bold mb-2">{temperature}</p>
          <p className="text-lg text-muted-foreground mb-4">{weatherInfo.description}</p>
          <p className="text-sm text-muted-foreground">
            {new Date(weather.time).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        </div>

        {getProfileSpecificData()}
      </CardContent>
    </Card>
  );
}
