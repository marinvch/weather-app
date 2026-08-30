import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { AIAnalysisComponent } from '../AIAnalysis/AIAnalysisComponent';
import { WeatherChart } from '../WeatherChart/WeatherChart';
import { WeatherMap } from '../WeatherMap/WeatherMap';
import { OfflineIndicator } from '../OfflineIndicator/OfflineIndicator';
import { useGetBasicForecastQuery, useGetHistoricalWeatherQuery } from '../../store/api/weatherApi';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setLocation, setLocationName } from '../../store/slices/userProfileSlice';
import { TrendingUp, Brain, BarChart3, MapIcon, Calendar } from 'lucide-react';
import { format, subDays } from 'date-fns';
import type { Coordinates } from '../../types/weather';

interface GeneralDashboardProps {
  coordinates: Coordinates;
  locationName: string;
}

export function GeneralDashboard({ coordinates, locationName }: GeneralDashboardProps) {
  const dispatch = useAppDispatch();
  const units = useAppSelector((state) => state.userProfile.units);

  const [activeTab, setActiveTab] = useState<'current' | 'analysis' | 'charts' | 'map' | 'historical'>('current');

  // Current weather data
  const {
    data: weatherData,
    isLoading,
    error,
  } = useGetBasicForecastQuery(coordinates);

  // Historical data (last 7 days)
  const endDate = format(new Date(), 'yyyy-MM-dd');
  const startDate = format(subDays(new Date(), 7), 'yyyy-MM-dd');

  const {
    data: historicalData,
    isLoading: isHistoricalLoading,
  } = useGetHistoricalWeatherQuery({
    ...coordinates,
    startDate,
    endDate,
  });

  const handleLocationSelect = (newCoords: Coordinates, newLocationName: string) => {
    dispatch(setLocation(newCoords));
    dispatch(setLocationName(newLocationName));
  };

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
        <div className="text-center space-y-4">
          <p className="text-destructive">Failed to load weather data</p>
          <p className="text-sm text-muted-foreground">Please check your connection and try again</p>
          <OfflineIndicator showDetails={true} className="max-w-md mx-auto" />
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

  const tabButtons = [
    { key: 'current' as const, label: 'Current', icon: TrendingUp },
    { key: 'analysis' as const, label: 'AI Analysis', icon: Brain },
    { key: 'charts' as const, label: 'Charts', icon: BarChart3 },
    { key: 'map' as const, label: 'Map', icon: MapIcon },
    { key: 'historical' as const, label: 'Historical', icon: Calendar },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'current':
        return (
          <div className="grid gap-6">
            {/* Current Weather Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Temperature</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round(currentWeather.temperature_2m)}°{units === 'imperial' ? 'F' : 'C'}
                  </div>
                  <p className="text-xs text-muted-foreground">Current temperature</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Feels Like</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round(currentWeather.temperature_2m)}°{units === 'imperial' ? 'F' : 'C'}
                  </div>
                  <p className="text-xs text-muted-foreground">Apparent temperature</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Humidity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentWeather.relative_humidity_2m}%</div>
                  <p className="text-xs text-muted-foreground">Relative humidity</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Wind Speed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {currentWeather.wind_speed_10m} {units === 'imperial' ? 'mph' : 'km/h'}
                  </div>
                  <p className="text-xs text-muted-foreground">Direction: {currentWeather.wind_direction_10m}°</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Precipitation</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentWeather.precipitation || 0} mm</div>
                  <p className="text-xs text-muted-foreground">Current precipitation</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Cloud Cover</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{currentWeather.cloud_cover}%</div>
                  <p className="text-xs text-muted-foreground">Sky coverage</p>
                </CardContent>
              </Card>
            </div>

            {/* 7-Day Forecast */}
            <Card>
              <CardHeader>
                <CardTitle>7-Day Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
                  {dailyData.time.slice(0, 7).map((day, index) => (
                    <div key={day} className="text-center p-3 border rounded">
                      <div className="font-medium text-sm">
                        {format(new Date(day), 'EEE')}
                      </div>
                      <div className="text-xs text-gray-500 mb-2">
                        {format(new Date(day), 'MMM d')}
                      </div>
                      <div className="text-lg font-bold">
                        {Math.round(dailyData.temperature_2m_max[index])}°
                      </div>
                      <div className="text-sm text-gray-600">
                        {Math.round(dailyData.temperature_2m_min[index])}°
                      </div>
                      {dailyData.precipitation_sum[index] > 0 && (
                        <div className="text-xs text-blue-600 mt-1">
                          {dailyData.precipitation_sum[index]}mm
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'analysis':
        return (
          <div className="grid gap-6">
            {weatherData.aiAnalysis && (
              <AIAnalysisComponent analysis={weatherData.aiAnalysis} />
            )}

            {/* Quick Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <div>
                      <div className="font-medium">Today's High</div>
                      <div className="text-2xl font-bold">
                        {Math.round(dailyData.temperature_2m_max[0])}°{units === 'imperial' ? 'F' : 'C'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-blue-600" />
                    <div>
                      <div className="font-medium">Confidence</div>
                      <div className="text-2xl font-bold">
                        {weatherData.aiAnalysis?.confidence || 0}%
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-purple-600" />
                    <div>
                      <div className="font-medium">Risk Level</div>
                      <div className={`text-2xl font-bold capitalize ${weatherData.aiAnalysis?.riskLevel === 'low' ? 'text-green-600' :
                        weatherData.aiAnalysis?.riskLevel === 'medium' ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                        {weatherData.aiAnalysis?.riskLevel || 'Unknown'}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );

      case 'charts':
        return (
          <div className="grid gap-6">
            <WeatherChart
              data={hourlyData}
              type="temperature"
              title="24-Hour Temperature Trend"
            />

            <WeatherChart
              data={hourlyData}
              type="precipitation"
              title="Precipitation Forecast"
            />

            <div className="grid gap-6 md:grid-cols-2">
              <WeatherChart
                data={hourlyData}
                type="wind"
                title="Wind Speed"
              />

              <WeatherChart
                data={hourlyData}
                type="humidity"
                title="Humidity Levels"
              />
            </div>
          </div>
        );

      case 'map':
        return (
          <div className="grid gap-6">
            <WeatherMap
              coordinates={coordinates}
              locationName={locationName}
              onLocationSelect={handleLocationSelect}
            />
          </div>
        );

      case 'historical':
        return (
          <div className="grid gap-6">
            {isHistoricalLoading ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Loading historical data...</p>
                </CardContent>
              </Card>
            ) : historicalData ? (
              <Card>
                <CardHeader>
                  <CardTitle>7-Day Temperature History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {historicalData.daily.time.map((date, index) => {
                      const maxTemp = historicalData.daily.temperature_2m_max[index];
                      const minTemp = historicalData.daily.temperature_2m_min[index];
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
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-gray-500">Historical data unavailable</p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Location Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{locationName}</CardTitle>
              <p className="text-muted-foreground">
                {coordinates.latitude.toFixed(4)}, {coordinates.longitude.toFixed(4)}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">
                {Math.round(currentWeather.temperature_2m)}°{units === 'imperial' ? 'F' : 'C'}
              </div>
              <p className="text-sm text-muted-foreground">
                {format(new Date(), 'MMM d, yyyy • h:mm a')}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        {tabButtons.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant={activeTab === key ? "default" : "outline"}
            onClick={() => setActiveTab(key)}
            className="flex items-center gap-2"
          >
            <Icon className="w-4 h-4" />
            {label}
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
}
