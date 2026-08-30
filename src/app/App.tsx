import { useEffect, useState, useCallback, useRef } from 'react';
import { Provider } from 'react-redux';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlaceIcon from '@mui/icons-material/Place';
import ShieldIcon from '@mui/icons-material/Shield';
import { store } from '@/store/store';
import { ProfileSelector } from '@/app/components/ProfileSelector';
import { GeneralDashboard } from '@/features/forecast/components/GeneralDashboard';
import { MarineDashboard } from '@/features/marine/components/MarineDashboard';
import { MountainDashboard } from '@/features/mountain/components/MountainDashboard';
import { AgriculturalDashboard } from '@/features/agriculture/components/AgriculturalDashboard';
import { OfflineIndicator } from '@/features/pwa/components/OfflineIndicator';
import { EmergencyInfo } from '@/features/location/components/EmergencyInfo';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setLocation, setLocationName } from '@/store/slices/userProfileSlice';
import { registerServiceWorker, setupInstallPrompt } from '@/features/pwa/lib/serviceWorker';
import { coordinatesKey, formatCoordinates } from '@/shared/lib/geo';
import { getCurrentLocation, getLocationInfo, type LocationInfo } from '@/features/location/lib/geolocation';
import type { Coordinates } from '@/shared/types/weather';

// Medenrudnik, Burgas — the fallback when geolocation is denied or times out.
// Module scope on purpose: as a literal inside the component it was a new
// object every render, which is what made the location effect loop.
const DEFAULT_COORDS: Coordinates = { latitude: 42.6967, longitude: 27.2695 };
const DEFAULT_LOCATION_NAME = 'Medenrudnik, Burgas, Bulgaria';

function WeatherApp() {
  const dispatch = useAppDispatch();
  const { profile, location, locationName } = useAppSelector((state) => state.userProfile);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [showEmergencyInfo, setShowEmergencyInfo] = useState(false);

  const currentCoords = location || DEFAULT_COORDS;
  const currentLocationName = locationName || DEFAULT_LOCATION_NAME;

  // Which coordinates we have already tried to reverse-geocode. A ref, not
  // state, because changing it must not trigger a render — and because a
  // failed lookup must not be retried forever.
  const geocodedFor = useRef<string | null>(null);

  const requestLocation = useCallback(async () => {
    setIsLoadingLocation(true);
    setLocationError(null);

    try {
      const info = await getCurrentLocation();

      dispatch(setLocation(info.coordinates));
      dispatch(setLocationName(info.displayName));
      setLocationInfo(info);
      setLocationError(null);
    } catch (error) {
      console.error('Geolocation error:', error);
      setLocationError(error instanceof Error ? error.message : 'Failed to get your location');

      // Fallback to the default location with basic info
      try {
        const fallbackInfo = await getLocationInfo(DEFAULT_COORDS);
        setLocationInfo(fallbackInfo);
      } catch (fallbackError) {
        console.error('Fallback location info failed:', fallbackError);
      }
    } finally {
      setIsLoadingLocation(false);
    }
  }, [dispatch]);

  useEffect(() => {
    // Auto-request location on first load.
    if (!location) {
      requestLocation();
      return;
    }

    // Resolve a display name for whatever coordinates we ended up with — once
    // per coordinate pair. This effect used to depend on `currentCoords`, which
    // was rebuilt as a fresh object literal on every render, so it re-ran on
    // every render and re-entered requestLocation each time: an unbounded loop
    // against the browser's geolocation and Nominatim, whose usage policy
    // forbids exactly that.
    const key = coordinatesKey(location);
    if (geocodedFor.current === key) return;
    geocodedFor.current = key;

    getLocationInfo(location).then(setLocationInfo).catch(console.error);
  }, [location, requestLocation]);

  useEffect(() => {
    const initializeServiceWorker = async () => {
      try {
        await registerServiceWorker();
        setupInstallPrompt();
      } catch (error) {
        console.error('Weather App: Failed to initialize service worker:', error);
      }
    };

    initializeServiceWorker();
  }, []);

  const renderDashboard = () => {
    const props = {
      coordinates: currentCoords,
      locationName: currentLocationName,
    };

    switch (profile) {
      case 'marine':
        return <MarineDashboard {...props} />;
      case 'mountain':
        return <MountainDashboard {...props} />;
      case 'agriculture':
        return <AgriculturalDashboard {...props} />;
      default:
        return <GeneralDashboard {...props} />;
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ flexWrap: 'wrap', gap: 2, py: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', flexGrow: 1 }}>
              <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }}>
                Weather Pro
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
                Weather that tells you what to do
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <OfflineIndicator />
              <ProfileSelector />

              <Button
                variant="outlined"
                size="small"
                onClick={requestLocation}
                disabled={isLoadingLocation}
                startIcon={
                  isLoadingLocation ? <CircularProgress size={16} /> : <MyLocationIcon />
                }
              >
                {isLoadingLocation ? 'Locating…' : 'Use my location'}
              </Button>

              {locationInfo && (
                <Button
                  variant="outlined"
                  color="error"
                  size="small"
                  startIcon={<ShieldIcon />}
                  onClick={() => setShowEmergencyInfo((open) => !open)}
                >
                  Emergency
                </Button>
              )}
            </Stack>
          </Toolbar>

          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', pb: 1.5, flexWrap: 'wrap' }}
          >
            <PlaceIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <Typography variant="body2">{currentLocationName}</Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {formatCoordinates(currentCoords)}
            </Typography>
            {locationError && (
              <Typography variant="caption" sx={{ color: 'error.main' }}>
                ({locationError})
              </Typography>
            )}
          </Stack>
        </Container>
      </AppBar>

      <Container maxWidth="lg" component="main" sx={{ flexGrow: 1, py: 3 }}>
        <Stack spacing={3}>
          {showEmergencyInfo && locationInfo && (
            <EmergencyInfo
              emergencyNumbers={locationInfo.emergencyNumbers}
              profile={profile}
              locationName={locationInfo.displayName}
              countryCode={locationInfo.countryCode}
            />
          )}

          {renderDashboard()}
        </Stack>
      </Container>

      <Divider />
      <Box component="footer" sx={{ py: 3 }}>
        <Container maxWidth="lg">
          <Typography variant="body2" align="center" sx={{ color: 'text.secondary' }}>
            Weather data from Open-Meteo. Built for people going outside.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <Provider store={store}>
      <WeatherApp />
    </Provider>
  );
}

export default App;
