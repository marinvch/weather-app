# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

# Weather Pro - Advanced Weather Intelligence

A sophisticated multi-profile weather application built with React, TypeScript, Redux Toolkit, and modern web technologies. Features AI-powered intelligent alerts, historical data analysis, interactive maps, comprehensive data visualization, and robust offline functionality.

## 🚀 Features

### 🎯 Multi-Profile Architecture

- **General Public**: Standard weather forecasts with intelligent recommendations
- **Mariners**: Marine conditions, wave analysis, fishing recommendations, tide information
- **Mountaineers**: Avalanche risk assessment, altitude-specific conditions, visibility forecasts
- **Agronomists**: Soil conditions, frost warnings, irrigation recommendations, planting guidance

### 🧠 AI-Powered Analysis

- Intelligent weather analysis with confidence scores
- Risk level assessment (low/medium/high)
- Profile-specific recommendations and tips
- Activity timing suggestions
- Real-time condition analysis

### 📊 Advanced Data Visualization

- Interactive weather charts (temperature, precipitation, wind, humidity)
- Historical trend analysis
- Multi-format chart support (area, bar, line charts)
- Responsive data visualization with Recharts
- 7-day forecast visualization

### 🗺️ Interactive Weather Maps

- Free OpenStreetMap integration with Leaflet
- Click-to-select location functionality
- Weather overlay layers (precipitation, temperature, wind, lightning)
- Real-time location updates
- Reverse geocoding for location names

### 📱 Progressive Web App (PWA)

- **Offline Functionality**: Service Worker with intelligent caching
- **Push Notifications**: Weather alerts and updates
- **Installable**: Add to home screen on mobile/desktop
- **Background Sync**: Auto-updates when connection restored
- **Cache Management**: Smart weather data caching with expiry

### 🌐 Offline Capabilities

- **Service Worker**: Custom implementation for weather API caching
- **Cache Strategy**: Network-first with intelligent fallback
- **Offline Indicator**: Real-time connection status
- **Data Persistence**: 5-minute cache expiry for fresh data
- **Background Updates**: Automatic sync when online

### 🔔 Smart Notifications

- Push notification support
- Weather alert subscriptions
- App update notifications
- Background sync status

## 🛠️ Technical Stack

### Frontend

- **React 18+** with TypeScript
- **Redux Toolkit** + RTK Query for state management
- **TailwindCSS v3** for styling
- **Shadcn UI** components with design tokens
- **Vite** for build tooling and development

### Data Visualization

- **Recharts** for interactive charts and graphs
- **date-fns** for date formatting and manipulation
- **Lucide React** for consistent iconography

### Maps & Location

- **Leaflet** for interactive maps
- **OpenStreetMap** for free map tiles
- **Nominatim** for reverse geocoding
- **Geolocation API** for user location

### APIs & Data

- **Open-Meteo APIs** (free, no API key required)
  - General weather forecast
  - Marine weather data
  - Historical weather data
  - Agricultural soil data
- **Weather layer overlays** (OpenWeatherMap format)

### PWA & Offline

- **Service Worker** with custom caching strategy
- **Web App Manifest** for PWA installation
- **Push Notifications API**
- **Background Sync API**
- **Cache API** for offline storage

## 🏗️ Architecture

### State Management

```
Redux Store:
├── weatherApi (RTK Query)
├── marineApi (RTK Query)
├── agriculturalApi (RTK Query)
├── userProfile (coordinates, profile, units)
├── preferences (theme, notifications)
└── alerts (active alerts, thresholds)
```

### Component Structure

```
src/
├── components/
│   ├── Dashboard/          # Profile-specific dashboards
│   ├── WeatherCard/        # Weather data display
│   ├── WeatherChart/       # Data visualization
│   ├── WeatherMap/         # Interactive maps
│   ├── AIAnalysis/         # AI recommendations
│   ├── OfflineIndicator/   # Connection status
│   └── ui/                 # Reusable UI components
├── store/
│   ├── api/               # RTK Query endpoints
│   └── slices/            # Redux state slices
├── hooks/
│   └── useOffline.ts      # Offline functionality hook
├── utils/
│   └── serviceWorker.ts   # PWA utilities
└── types/
    └── weather.ts         # TypeScript definitions
```

### API Integration Pattern

Each profile uses dedicated RTK Query endpoints with AI analysis:

```typescript
// Enhanced API responses with AI analysis
transformResponse: (response: WeatherResponse) => ({
  ...response,
  aiAnalysis: generateAnalysis(response)
})
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd weather-app

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Development

```bash
# Run development server with hot reload
npm run dev

# TypeScript type checking
npm run build

# Linting
npm run lint
```

## 📱 Usage

### Profile Selection

1. Select your user profile (General, Marine, Mountain, Agriculture)
2. Grant location permission or click on map to select location
3. View profile-specific weather data and AI recommendations

### Offline Mode

1. The app automatically caches weather data
2. Works offline with last cached data
3. Updates automatically when connection restored
4. View cache status in offline indicator

### PWA Installation

1. Visit the app in a modern browser
2. Look for "Install App" prompt or button
3. Add to home screen for native-like experience
4. Enable push notifications for weather alerts

### Weather Maps

1. Click the "Map" tab in any dashboard
2. Toggle weather layer overlays (requires API key for full functionality)
3. Click anywhere on map to select new location
4. View real-time weather conditions

## 🔧 Configuration

### Environment Variables

Create a `.env` file for optional configurations:

```env
# Optional: VAPID keys for push notifications
VITE_VAPID_PUBLIC_KEY=your_vapid_public_key

# Optional: OpenWeatherMap API key for weather overlays
VITE_OPENWEATHER_API_KEY=your_api_key
```

### Service Worker Customization

Modify `public/sw.js` to adjust:

- Cache expiry times (default: 5 minutes)
- Cached resource patterns
- Background sync behavior
- Push notification handling

## 🧪 Testing

### Manual Testing Scenarios

1. **Offline Functionality**: Disconnect network and verify cached data access
2. **PWA Installation**: Test install prompt and home screen icon
3. **Location Services**: Test geolocation and manual location selection
4. **Profile Switching**: Verify data updates when changing profiles
5. **Charts & Visualization**: Test different chart types and data ranges

### Cache Testing

1. Load weather data online
2. Go offline using browser dev tools
3. Refresh page and verify cached data loads
4. Check offline indicator shows correct status

## 🔄 Deployment

### Static Hosting (Recommended)

Deploy to Vercel, Netlify, or similar:

```bash
npm run build
# Upload dist/ folder to hosting provider
```

### Custom Server

```bash
npm run build
npx serve dist
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Open-Meteo** for free weather APIs
- **OpenStreetMap** for free map data
- **Nominatim** for geocoding services
- **Recharts** for data visualization
- **Leaflet** for interactive maps
- **Shadcn UI** for component library

## 🔮 Future Enhancements

- Weather radar integration
- Satellite imagery overlay
- Advanced weather alerts
- Social sharing features
- Weather station data integration
- Machine learning predictions
- Multi-language support
- Dark mode theme

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
