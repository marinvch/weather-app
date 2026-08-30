import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { WeatherCard } from '../WeatherCard/WeatherCard';
import { useGetBasicForecastQuery } from '../../store/api/weatherApi';
import { useAppSelector } from '../../store/hooks';
import type { Coordinates } from '../../types/weather';

interface GeneralDashboardProps {
  coordinates: Coordinates;
  locationName: string;
}

export function GeneralDashboard({ coordinates, locationName }: GeneralDashboardProps) {
  const units = useAppSelector((state) => state.userProfile.units);

  const {
    data: weatherData,
    isLoading,
    error,
  } = useGetBasicForecastQuery(coordinates);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading weather data...</p>
        </div>
      </div>
    );
  }

  if (error || !weatherData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-destructive">Failed to load weather data</p>
          <p className="text-sm text-muted-foreground">Please try again later</p>
        </div>
      </div>
    );
  }

  const currentWeather = weatherData.current;
  const hourlyData = weatherData.hourly;
  const dailyData = weatherData.daily;

  if (!currentWeather || !hourlyData || !dailyData) {
    return (
      <div className="flex items-center justify-center p-8">
        <p>Weather data incomplete</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Weather */}
      <div className="flex justify-center">
        <WeatherCard
          weather={currentWeather}
          location={locationName}
          profile="general"
          units={units}
        />
      </div>

      {/* Hourly Forecast */}
      <Card>
        <CardHeader>
          <CardTitle>24-Hour Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex overflow-x-auto space-x-4 pb-4">
            {hourlyData.time.slice(0, 24).map((time, index) => {
              const temp = hourlyData.temperature_2m[index];
              const precipitation = hourlyData.precipitation[index];
              const hour = new Date(time).getHours();

              return (
                <div key={time} className="flex-shrink-0 text-center min-w-[80px]">
                  <p className="text-sm text-muted-foreground">
                    {hour === 0 ? '12 AM' : hour <= 12 ? `${hour} AM` : `${hour - 12} PM`}
                  </p>
                  <p className="font-semibold text-lg">
                    {Math.round(temp)}°
                  </p>
                  <div className="h-2 w-full border rounded mt-1">
                    <div
                      className="h-full border-2 border-cyan-600 rounded"
                      style={{ width: `${Math.min(precipitation * 10, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {precipitation.toFixed(1)}mm
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Daily Forecast */}
      <Card>
        <CardHeader>
          <CardTitle>7-Day Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dailyData.time.map((date, index) => {
              const maxTemp = dailyData.temperature_2m_max[index];
              const minTemp = dailyData.temperature_2m_min[index];
              const precipitation = dailyData.precipitation_sum[index];
              const dayName = new Date(date).toLocaleDateString([], { weekday: 'short' });

              return (
                <div key={date} className="flex items-center justify-between py-2 border-b last:border-b-0">
                  <div className="flex-1">
                    <p className="font-medium">{dayName}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </p>
                  </div>

                  <div className="flex-1 text-center">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="font-semibold">{Math.round(maxTemp)}°</span>
                      <span className="text-muted-foreground">{Math.round(minTemp)}°</span>
                    </div>
                  </div>

                  <div className="flex-1 text-right">
                    <p className="text-sm">
                      {precipitation > 0 ? `${precipitation.toFixed(1)}mm` : 'No rain'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
