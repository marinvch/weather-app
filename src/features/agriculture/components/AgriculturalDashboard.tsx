import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { useAgronomicData } from '@/features/agriculture/hooks/useAgronomicData';
import { useGetSoilDataQuery } from '@/features/agriculture/api/agricultureApi';
import { useAppSelector } from '@/store/hooks';
import { Wheat, Droplets, Thermometer, Wind, AlertTriangle, Snowflake } from 'lucide-react';
import type { Coordinates } from '@/shared/types/weather';

interface AgriculturalDashboardProps {
  coordinates: Coordinates;
  locationName: string;
}

export function AgriculturalDashboard({ coordinates }: AgriculturalDashboardProps) {
  const units = useAppSelector((state) => state.userProfile.units);

  const {
    data: agronomicData,
    isLoading: agronomicLoading,
    error: agronomicError,
  } = useAgronomicData(coordinates);

  const {
    data: soilData,
    isLoading: soilLoading,
  } = useGetSoilDataQuery(coordinates);

  if (agronomicLoading || soilLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 mx-auto mb-4"></div>
          <p>Loading agricultural data...</p>
        </div>
      </div>
    );
  }

  if (agronomicError || !agronomicData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-destructive">Failed to load agricultural data</p>
          <p className="text-sm text-muted-foreground">Please try again later</p>
        </div>
      </div>
    );
  }

  const current = agronomicData.current;
  const hourly = agronomicData.hourly;

  if (!current || !hourly) {
    return (
      <div className="flex items-center justify-center p-8">
        <p>Agricultural data incomplete</p>
      </div>
    );
  }

  // Helper functions for agricultural analysis
  const getSoilMoistureCondition = (moisture: number) => {
    if (moisture < 10) return { text: 'Very Dry', color: 'text-red-600', advice: 'Immediate irrigation needed' };
    if (moisture < 20) return { text: 'Dry', color: 'text-orange-600', advice: 'Consider irrigation' };
    if (moisture < 40) return { text: 'Adequate', color: 'text-yellow-600', advice: 'Monitor closely' };
    if (moisture < 60) return { text: 'Good', color: 'text-green-600', advice: 'Optimal for most crops' };
    return { text: 'Saturated', color: 'text-blue-600', advice: 'Risk of waterlogging' };
  };

  const getFrostRisk = (temp: number) => {
    if (temp > 5) return { risk: 'None', color: 'text-green-600', advice: 'No frost risk' };
    if (temp > 2) return { risk: 'Low', color: 'text-yellow-600', advice: 'Monitor temperature' };
    if (temp > 0) return { risk: 'Moderate', color: 'text-orange-600', advice: 'Prepare frost protection' };
    return { risk: 'High', color: 'text-red-600', advice: 'Immediate frost protection needed' };
  };

  const getGrowingConditions = (temp: number, humidity: number, soilMoisture: number) => {
    let score = 0;

    // Temperature factor (optimal range 15-25°C)
    if (temp >= 15 && temp <= 25) score += 3;
    else if (temp >= 10 && temp <= 30) score += 2;
    else if (temp >= 5 && temp <= 35) score += 1;

    // Humidity factor (optimal range 40-70%)
    if (humidity >= 40 && humidity <= 70) score += 2;
    else if (humidity >= 30 && humidity <= 80) score += 1;

    // Soil moisture factor
    if (soilMoisture >= 30 && soilMoisture <= 60) score += 3;
    else if (soilMoisture >= 20 && soilMoisture <= 70) score += 2;
    else if (soilMoisture >= 10 && soilMoisture <= 80) score += 1;

    if (score >= 7) return { condition: 'Excellent', color: 'text-green-600' };
    if (score >= 5) return { condition: 'Good', color: 'text-yellow-600' };
    if (score >= 3) return { condition: 'Fair', color: 'text-orange-600' };
    return { condition: 'Poor', color: 'text-red-600' };
  };

  // Current conditions
  const currentSoilMoisture = current.soil_moisture_0_1cm || 0;
  const currentSoilTemp = current.soil_temperature_0cm || 0;
  const soilCondition = getSoilMoistureCondition(currentSoilMoisture);
  const frostRisk = getFrostRisk(current.temperature_2m);
  const growingConditions = getGrowingConditions(current.temperature_2m, current.relative_humidity_2m, currentSoilMoisture);

  return (
    <div className="space-y-6">
      {/* Current Agricultural Conditions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 text-center">
          <div className="flex items-center gap-2 justify-center text-sm mb-2">
            <Thermometer className="h-4 w-4 text-yellow-600" /> Air Temperature
          </div>
          <p className="text-2xl font-bold">
            {units === 'metric'
              ? `${Math.round(current.temperature_2m)}°C`
              : `${Math.round(current.temperature_2m * 9 / 5 + 32)}°F`
            }
          </p>
          <p className="text-sm text-muted-foreground">
            Soil: {Math.round(currentSoilTemp)}°C
          </p>
        </div>

        <div className="p-4 text-center">
          <div className="flex items-center gap-2 justify-center text-sm mb-2">
            <Droplets className="h-4 w-4 text-yellow-600" /> Soil Moisture
          </div>
          <p className="text-2xl font-bold">{currentSoilMoisture.toFixed(1)}%</p>
          <p className={`text-sm ${soilCondition.color}`}>{soilCondition.text}</p>
        </div>

        <div className="p-4 text-center">
          <div className="flex items-center gap-2 justify-center text-sm mb-2">
            <Snowflake className="h-4 w-4 text-yellow-600" /> Frost Risk
          </div>
          <p className={`text-2xl font-bold ${frostRisk.color}`}>{frostRisk.risk}</p>
          <p className="text-sm text-muted-foreground">Tonight</p>
        </div>
        <div className="p-4 text-center">
          <div className="flex items-center gap-2 justify-center text-sm mb-2">
            <Wheat className="h-4 w-4 text-yellow-600" /> Growing Conditions
          </div>
          <p className={`text-2xl font-bold ${growingConditions.color}`}>
            {growingConditions.condition}
          </p>
          <p className="text-sm text-muted-foreground">Overall</p>
        </div>
      </div>

      {/* Agricultural Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            Agricultural Alerts & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 border rounded-lg">
              <div className="flex items-start gap-3">
                <Droplets className={`h-5 w-5 mt-0.5 ${soilCondition.color}`} />
                <div>
                  <p className="font-medium">Soil Moisture</p>
                  <p className="text-sm text-muted-foreground">{soilCondition.advice}</p>
                </div>
              </div>
            </div>

            <div className="p-3 border rounded-lg">
              <div className="flex items-start gap-3">
                <Snowflake className={`h-5 w-5 mt-0.5 ${frostRisk.color}`} />
                <div>
                  <p className="font-medium">Frost Protection</p>
                  <p className="text-sm text-muted-foreground">{frostRisk.advice}</p>
                </div>
              </div>
            </div>

            {current.wind_speed_10m && current.wind_speed_10m > 30 && (
              <div className="p-3 border rounded-lg">
                <div className="flex items-start gap-3">
                  <Wind className="h-5 w-5 mt-0.5 text-orange-600" />
                  <div>
                    <p className="font-medium">High Wind Warning</p>
                    <p className="text-sm text-muted-foreground">
                      Strong winds may damage crops and affect spraying operations
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Soil Conditions Detail */}
      {soilData && (
        <Card>
          <CardHeader>
            <CardTitle>Soil Profile Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Soil Temperature (°C)</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Surface (0cm)</span>
                    <span className="font-medium">{currentSoilTemp.toFixed(1)}°</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Shallow (6cm)</span>
                    <span className="font-medium">
                      {(soilData.hourly.soil_temperature_6cm?.[0] || 0).toFixed(1)}°
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Root zone (18cm)</span>
                    <span className="font-medium">
                      {(soilData.hourly.soil_temperature_18cm?.[0] || 0).toFixed(1)}°
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Soil Moisture (%)</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Surface (0-1cm)</span>
                    <span className="font-medium">{currentSoilMoisture.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Shallow (1-3cm)</span>
                    <span className="font-medium">
                      {(soilData.hourly.soil_moisture_1_3cm?.[0] || 0).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Root zone (3-9cm)</span>
                    <span className="font-medium">
                      {(soilData.hourly.soil_moisture_3_9cm?.[0] || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hourly Agricultural Forecast */}
      <Card>
        <CardHeader>
          <CardTitle>Agricultural Forecast (24 Hours)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="flex space-x-4 pb-4 min-w-max">
              {hourly.time.slice(0, 24).map((time, index) => {
                const temp = hourly.temperature_2m[index];
                const precipitation = hourly.precipitation?.[index] || 0;
                const soilMoisture = hourly.soil_moisture_0_1cm?.[index] || 0;
                const hour = new Date(time).getHours();
                const frostRiskHour = getFrostRisk(temp);

                return (
                  <div key={time} className="text-center min-w-[100px] space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {hour === 0 ? '12 AM' : hour <= 12 ? `${hour} AM` : `${hour - 12} PM`}
                    </p>

                    <p className="font-semibold text-lg">
                      {Math.round(temp)}°
                    </p>

                    <div className="flex flex-col items-center space-y-1">
                      <Droplets className="h-3 w-3 text-blue-500" />
                      <p className="text-xs">{soilMoisture.toFixed(0)}%</p>
                    </div>

                    {precipitation > 0 && (
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 border-2 border-cyan-600 rounded-full" />
                        <p className="text-xs">{precipitation.toFixed(1)}mm</p>
                      </div>
                    )}

                    {frostRiskHour.risk !== 'None' && (
                      <div className="flex flex-col items-center">
                        <Snowflake className={`h-3 w-3 ${frostRiskHour.color}`} />
                        <p className="text-xs">{frostRiskHour.risk}</p>
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
