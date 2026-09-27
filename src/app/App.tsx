import { useEffect, useState, useCallback, useRef } from 'react';
import { Provider } from 'react-redux';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import PlaceIcon from '@mui/icons-material/Place';
import { store } from '@/store/store';
import { HeaderControls } from '@/app/components/HeaderControls';
import { ThemeModeSync } from '@/app/components/ThemeModeControl';
import { PROFILES, profileFromSearch } from '@/app/profiles';
import { AirQualityPanel } from '@/features/airquality/components/AirQualityPanel';
import { AlertsPanel } from '@/features/alerts/components/AlertsPanel';
import { InstallPrompt } from '@/features/pwa/components/InstallPrompt';
import { UpdatePrompt } from '@/features/pwa/components/UpdatePrompt';
import { EmergencyInfo } from '@/features/location/components/EmergencyInfo';
import { LocationSearch } from '@/features/location/components/LocationSearch';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { setLocation, setLocationName, setProfile } from '@/store/slices/userProfileSlice';
import { registerServiceWorker, setupInstallPrompt } from '@/features/pwa/lib/serviceWorker';
import { coordinatesKey, formatCoordinates } from '@/shared/lib/geo';
import { getCurrentLocation, getLocationInfo, type LocationInfo } from '@/features/location/lib/geolocation';
import { WeatherMap } from '@/shared/ui/WeatherMap';
import { SectionErrorBoundary } from '@/shared/ui/SectionErrorBoundary';
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

  /**
   * A place chosen deliberately — searched for, or picked from the saved list.
   * The coordinate is the location; the name travels with it as display text
   * and is kept as given rather than being re-resolved, because the user
   * recognises the name they picked.
   */
  const selectPlace = useCallback(
    (place: { latitude: number; longitude: number; name: string }) => {
      dispatch(setLocation({ latitude: place.latitude, longitude: place.longitude }));
      dispatch(setLocationName(place.name));
      setLocationError(null);
    },
    [dispatch],
  );

  useEffect(() => {
    // Auto-request location on first load. A location restored from the last
    // visit counts as having one, so a returning user is not re-prompted for
    // the geolocation permission before they have asked for anything.
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
    // `?profile=marine` — the PWA shortcuts in public/manifest.json land here.
    // Read once on boot, after the persisted profile, so a shortcut wins over
    // whatever the last visit left behind. An unrecognised value is ignored.
    const requested = profileFromSearch(window.location.search);
    if (requested) dispatch(setProfile(requested));
  }, [dispatch]);

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

  // The profile registry is the single source of truth: one entry per persona
  // carries its label, its icon and its dashboard, so there is no switch here
  // to fall out of step with the selector.
  const { Dashboard } = PROFILES[profile];

  // A new place or a new lens is a fresh start for every section: a panel
  // that crashed on the last coordinate gets another chance on this one.
  const resetKeys = [coordinatesKey(currentCoords), profile];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <ThemeModeSync />

      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ gap: 1, py: 1, minHeight: { xs: 56 } }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline', flexGrow: 1, minWidth: 0 }}>
              <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }} noWrap>
                Weather Pro
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', display: { xs: 'none', lg: 'block' } }}>
                Weather that tells you what to do
              </Typography>
            </Stack>

            <HeaderControls
              coordinates={currentCoords}
              locationName={currentLocationName}
              onSelectFavorite={selectPlace}
              onRequestLocation={requestLocation}
              isLoadingLocation={isLoadingLocation}
              emergencyAvailable={Boolean(locationInfo)}
              emergencyOpen={showEmergencyInfo}
              onToggleEmergency={() => setShowEmergencyInfo((open) => !open)}
            />
          </Toolbar>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{ alignItems: { xs: 'stretch', sm: 'center' }, pb: 1.5 }}
          >
            <Box sx={{ width: { xs: '100%', sm: 320 }, flexShrink: 0 }}>
              <LocationSearch onSelect={selectPlace} fullWidth />
            </Box>

            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0, flexWrap: 'wrap' }}>
              <PlaceIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="body2" noWrap>{currentLocationName}</Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {formatCoordinates(currentCoords)}
              </Typography>
              {locationError && (
                <Typography variant="caption" sx={{ color: 'error.main' }}>
                  ({locationError})
                </Typography>
              )}
            </Stack>
          </Stack>
        </Container>
      </AppBar>

      <Container maxWidth="lg" component="main" sx={{ flexGrow: 1, py: 3 }}>
        <Stack spacing={3}>
          {showEmergencyInfo && locationInfo && (
            <SectionErrorBoundary section="Emergency numbers" resetKeys={resetKeys}>
              <EmergencyInfo
                emergencyNumbers={locationInfo.emergencyNumbers}
                profile={profile}
                locationName={locationInfo.displayName}
                countryCode={locationInfo.countryCode}
              />
            </SectionErrorBoundary>
          )}

          {/* Alerts first, above everything: a severe-weather warning below
              the fold is not a warning. Passing coordinates is what makes the
              panel derive alerts and fill the slice — without them it only
              reads a slice nothing writes to. */}
          <SectionErrorBoundary section="Alerts" resetKeys={resetKeys}>
            <AlertsPanel coordinates={currentCoords} />
          </SectionErrorBoundary>

          {/* The map is part of the page, not a disclosure behind a button. It
              is the graphical form of the place named in the header, so it sits
              with the location context, above the readings it describes. */}
          <SectionErrorBoundary section="Weather map" resetKeys={resetKeys}>
            <WeatherMap
              coordinates={currentCoords}
              locationName={currentLocationName}
              onLocationSelect={(coordinates, name) =>
                selectPlace({ ...coordinates, name })
              }
            />
          </SectionErrorBoundary>

          <SectionErrorBoundary section={PROFILES[profile].label} resetKeys={resetKeys}>
            <Dashboard coordinates={currentCoords} locationName={currentLocationName} />
          </SectionErrorBoundary>

          {/* Air quality is persona-neutral, so it is mounted for all four
              lenses rather than scoped to one dashboard: UV is a working
              exposure number for mariners and mountaineers on open ground, and
              pollen is agronomic data. */}
          <SectionErrorBoundary section="Air quality" resetKeys={resetKeys}>
            <AirQualityPanel coordinates={currentCoords} />
          </SectionErrorBoundary>
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

      {/* Both render nothing until the browser says there is something to
          offer, so they are mounted unconditionally rather than gated. */}
      <UpdatePrompt />
      <InstallPrompt />
    </Box>
  );
}

function App() {
  return (
    <Provider store={store}>
      {/* Last resort, for a crash in the header itself. Every section below
          it has its own boundary, so this should not normally be what catches. */}
      <SectionErrorBoundary section="Weather Pro">
        <WeatherApp />
      </SectionErrorBoundary>
    </Provider>
  );
}

export default App;
