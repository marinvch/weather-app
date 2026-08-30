import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import { weatherCodes } from "@/shared/types/weather";
import type { CurrentWeather, UserProfile } from "@/shared/types/weather";

interface WeatherCardProps {
  weather: CurrentWeather;
  location: string;
  profile: UserProfile;
  units: "metric" | "imperial";
}

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

/** A labelled figure in the card's lower row. */
function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Box sx={{ textAlign: "center", flex: 1 }}>
      <Typography variant="body2" sx={{ color: "text.secondary" }}>
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 600 }}>
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}

export function WeatherCard({
  weather,
  location,
  profile,
  units,
}: WeatherCardProps) {
  const weatherInfo = weatherCodes[weather.weather_code] || {
    description: "Unknown",
    icon: "❓",
  };

  // Open-Meteo is always queried in metric; this is the only place in the app
  // that converts.
  const temperature =
    units === "metric"
      ? `${Math.round(weather.temperature_2m)}°C`
      : `${Math.round((weather.temperature_2m * 9) / 5 + 32)}°F`;

  const windSpeed =
    units === "metric"
      ? `${Math.round(weather.wind_speed_10m)} km/h`
      : `${Math.round(weather.wind_speed_10m * 0.621371)} mph`;

  const windDirection = COMPASS[Math.round(weather.wind_direction_10m / 22.5) % 16];

  const humidity = `${weather.relative_humidity_2m}%`;

  // Marine and mountain readers care about wind direction and light; the others
  // are better served by humidity first.
  const metrics =
    profile === "marine"
      ? [
          { label: "Wind", value: windSpeed, sub: windDirection },
          { label: "Humidity", value: humidity },
        ]
      : profile === "mountain"
        ? [
            { label: "Wind", value: windSpeed, sub: windDirection },
            { label: "Visibility", value: weather.is_day ? "Day" : "Night" },
          ]
        : [
            { label: "Humidity", value: humidity },
            { label: "Wind", value: windSpeed },
          ];

  return (
    <Card sx={{ width: "100%", maxWidth: 448 }}>
      <CardContent>
        <Stack
          direction="row"
          sx={{ alignItems: "center", justifyContent: "space-between", mb: 2 }}
        >
          <Typography variant="h6" component="h2">
            {location}
          </Typography>
          <Box component="span" sx={{ fontSize: "2.25rem", lineHeight: 1 }}>
            {weatherInfo.icon}
          </Box>
        </Stack>

        <Stack spacing={0.5} sx={{ alignItems: "center" }}>
          <Typography variant="h2" sx={{ fontWeight: 700 }}>
            {temperature}
          </Typography>
          <Typography variant="h6" sx={{ color: "text.secondary" }}>
            {weatherInfo.description}
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {new Date(weather.time).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Typography>
        </Stack>

        <Stack direction="row" sx={{ mt: 3 }}>
          {metrics.map((m) => (
            <Metric key={m.label} {...m} />
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
