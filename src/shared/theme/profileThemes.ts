export type WeatherProfile = "general" | "marine" | "mountain" | "agriculture";

export interface ThemeConfig {
  background: string;
  textColor: string;
  cardBackground: string;
  borderColor: string;
  accentColor: string;
}

export const WEATHER_THEMES: Record<WeatherProfile, ThemeConfig> = {
  general: {
    background: "bg-white",
    textColor: "text-gray-900",
    cardBackground: "border-gray-300",
    borderColor: "border-gray-300",
    accentColor: "text-blue-600",
  },
  marine: {
    background: "bg-white",
    textColor: "text-gray-900",
    cardBackground: "border-cyan-300",
    borderColor: "border-cyan-300",
    accentColor: "text-cyan-600",
  },
  mountain: {
    background: "bg-white",
    textColor: "text-gray-900",
    cardBackground: "border-slate-300",
    borderColor: "border-slate-300",
    accentColor: "text-slate-600",
  },
  agriculture: {
    background: "bg-white",
    textColor: "text-gray-900",
    cardBackground: "border-green-300",
    borderColor: "border-green-300",
    accentColor: "text-green-600",
  },
};

export function getThemeClasses(profile: WeatherProfile): string {
  const theme = WEATHER_THEMES[profile];
  return `${theme.textColor} ${theme.cardBackground} ${theme.borderColor}`;
}

export function getThemeStyle(profile: WeatherProfile): string {
  const theme = WEATHER_THEMES[profile];
  return `min-h-screen ${theme.background}`;
}

export function getCardClasses(profile: WeatherProfile): string {
  const theme = WEATHER_THEMES[profile];
  return `${theme.borderColor} border-2 text-gray-900`;
}

export function getButtonClasses(
  variant: "primary" | "secondary" = "primary"
): string {
  if (variant === "primary") {
    return `border-2 border-gray-600 hover:border-gray-800 text-gray-700 hover:text-gray-900`;
  } else {
    return `border-2 border-gray-400 hover:border-gray-600 text-gray-600 hover:text-gray-800`;
  }
}
