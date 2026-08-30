import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { format } from 'date-fns';
import type { HourlyWeather, DailyWeather } from '../../types/weather';

interface WeatherChartProps {
  data: HourlyWeather | DailyWeather;
  type: 'temperature' | 'precipitation' | 'wind' | 'humidity';
  title: string;
  className?: string;
}

export function WeatherChart({ data, type, title, className }: WeatherChartProps) {
  // Transform data for charts
  const chartData = data.time.map((time, index) => {
    const baseData = {
      time: format(new Date(time), type === 'temperature' ? 'HH:mm' : 'MM/dd'),
      timestamp: time,
    };

    switch (type) {
      case 'temperature':
        return {
          ...baseData,
          temperature: 'temperature_2m' in data ? data.temperature_2m[index] :
            'temperature_2m_max' in data ? data.temperature_2m_max[index] : 0,
          minTemp: 'temperature_2m_min' in data ? data.temperature_2m_min[index] : undefined,
        };
      case 'precipitation':
        return {
          ...baseData,
          precipitation: 'precipitation' in data ? data.precipitation[index] :
            'precipitation_sum' in data ? data.precipitation_sum[index] : 0,
          probability: 'precipitation_probability' in data ? data.precipitation_probability[index] : undefined,
        };
      case 'wind':
        return {
          ...baseData,
          windSpeed: 'wind_speed_10m' in data ? data.wind_speed_10m[index] :
            'wind_speed_10m_max' in data ? data.wind_speed_10m_max[index] : 0,
          windDirection: 'wind_direction_10m' in data ? data.wind_direction_10m[index] : undefined,
        };
      case 'humidity':
        return {
          ...baseData,
          humidity: 'relative_humidity_2m' in data ? data.relative_humidity_2m[index] : 0,
        };
      default:
        return baseData;
    }
  });

  const renderChart = () => {
    switch (type) {
      case 'temperature':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12 }}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                labelFormatter={(value) => `Time: ${value}`}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(1)}°C`,
                  name === 'temperature' ? 'Temperature' : 'Min Temperature'
                ]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="temperature"
                stroke="#f59e0b"
                fill="#fef3c7"
                strokeWidth={2}
                name="Temperature"
              />
              {chartData.some(item => 'minTemp' in item && item.minTemp !== undefined) && (
                <Area
                  type="monotone"
                  dataKey="minTemp"
                  stroke="#3b82f6"
                  fill="#dbeafe"
                  strokeWidth={2}
                  name="Min Temperature"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'precipitation':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12 }}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                labelFormatter={(value) => `Time: ${value}`}
                formatter={(value: number, name: string) => [
                  name === 'precipitation' ? `${value.toFixed(1)}mm` : `${value}%`,
                  name === 'precipitation' ? 'Precipitation' : 'Probability'
                ]}
              />
              <Legend />
              <Bar
                dataKey="precipitation"
                fill="#3b82f6"
                name="Precipitation"
              />
              {chartData.some(item => 'probability' in item && item.probability !== undefined) && (
                <Line
                  type="monotone"
                  dataKey="probability"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Probability (%)"
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'wind':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12 }}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                labelFormatter={(value) => `Time: ${value}`}
                formatter={(value: number, name: string) => [
                  `${value.toFixed(1)} km/h`,
                  name === 'windSpeed' ? 'Wind Speed' : 'Wind Direction'
                ]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="windSpeed"
                stroke="#10b981"
                strokeWidth={2}
                name="Wind Speed"
              />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'humidity':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12 }}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
              <Tooltip
                labelFormatter={(value) => `Time: ${value}`}
                formatter={(value: number) => [`${value}%`, 'Humidity']}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="humidity"
                stroke="#8b5cf6"
                fill="#f3e8ff"
                strokeWidth={2}
                name="Humidity"
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return <div>Chart type not supported</div>;
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {renderChart()}
      </CardContent>
    </Card>
  );
}
