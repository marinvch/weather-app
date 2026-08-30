import { useEffect, useState, useCallback } from 'react';
import { Provider } from 'react-redux';
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
import { Button } from '@/shared/ui/button';
import { MapPin, Loader, Shield } from 'lucide-react';
import { registerServiceWorker, setupInstallPrompt } from '@/features/pwa/lib/serviceWorker';
import { getCurrentLocation, getLocationInfo, type LocationInfo } from '@/features/location/lib/geolocation';
import { getThemeStyle, getButtonClasses } from '@/shared/theme/profileThemes';
import type { Coordinates } from '@/shared/types/weather';

function WeatherApp() {
  const dispatch = useAppDispatch();
  const { profile, location, locationName } = useAppSelector((state) => state.userProfile);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationInfo, setLocationInfo] = useState<LocationInfo | null>(null);
  const [showEmergencyInfo, setShowEmergencyInfo] = useState(false);

  // Demo coordinates (Medenrudnik, Burgas, Bulgaria) if geolocation fails
  const defaultCoords: Coordinates = { latitude: 42.6967, longitude: 27.2695 };
  const currentCoords = location || defaultCoords;
  const currentLocationName = locationName || 'Medenrudnik, Burgas, Bulgaria';

  const requestLocation = useCallback(async () => {
    setIsLoadingLocation(true);
    setLocationError(null);

    try {
      const locationInfo = await getCurrentLocation();

      dispatch(setLocation(locationInfo.coordinates));
      dispatch(setLocationName(locationInfo.displayName));
      setLocationInfo(locationInfo);
      setLocationError(null);
    } catch (error) {
      console.error('Geolocation error:', error);
      setLocationError(error instanceof Error ? error.message : 'Failed to get your location');

      // Fallback to default location with basic info
      try {
        const fallbackInfo = await getLocationInfo({ latitude: 42.6967, longitude: 27.2695 });
        setLocationInfo(fallbackInfo);
      } catch (fallbackError) {
        console.error('Fallback location info failed:', fallbackError);
      }
    } finally {
      setIsLoadingLocation(false);
    }
  }, [dispatch]);

  useEffect(() => {
    // Auto-request location on first load
    if (!location) {
      requestLocation();
    } else if (!locationInfo) {
      // Get location info for current coordinates
      getLocationInfo(currentCoords).then(setLocationInfo).catch(console.error);
    }
  }, [location, requestLocation, currentCoords, locationInfo]);

  // Initialize service worker and PWA features
  useEffect(() => {
    const initializeServiceWorker = async () => {
      try {
        await registerServiceWorker();
        setupInstallPrompt();
        console.log('Weather App: Service worker and PWA features initialized');
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
    <div className={getThemeStyle(profile)}>
      {/* Header */}
      <header className={`border-b-2 border-gray-300 bg-white`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">Weather Pro</h1>
              <span className="text-sm text-gray-600">Advanced Weather Intelligence</span>
            </div>

            <div className="flex items-center gap-4">
              <OfflineIndicator />

              <ProfileSelector />

              <Button
                variant="outline"
                size="sm"
                onClick={requestLocation}
                disabled={isLoadingLocation}
                className={`flex items-center gap-2 ${getButtonClasses('secondary')}`}
              >
                {isLoadingLocation ? (
                  <Loader className="h-4 w-4 animate-spin" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                {isLoadingLocation ? 'Getting Location...' : 'Use My Location'}
              </Button>

              {locationInfo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEmergencyInfo(!showEmergencyInfo)}
                  className={`flex items-center gap-2 ${getButtonClasses('secondary')}`}
                >
                  <Shield className="h-4 w-4" />
                  Emergency
                </Button>
              )}
            </div>
          </div>

          {/* Location and Error Display */}
          <div className="mt-2 flex items-center justify-center sm:justify-start gap-2">
            <MapPin className="h-4 w-4 text-gray-600" />
            <span className="text-sm text-gray-700">{currentLocationName}</span>
            {locationError && (
              <span className="text-sm text-red-600">({locationError})</span>
            )}
            {locationInfo && (
              <span className="text-xs text-gray-500 ml-2">
                {currentCoords.latitude.toFixed(4)}, {currentCoords.longitude.toFixed(4)}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Emergency Info */}
      {showEmergencyInfo && locationInfo && (
        <div className="container mx-auto px-4 py-4">
          <EmergencyInfo
            emergencyNumbers={locationInfo.emergencyNumbers}
            profile={profile}
            locationName={locationInfo.displayName}
            countryCode={locationInfo.countryCode}
            coordinates={currentCoords}
          />
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {renderDashboard()}
      </main>

      {/* Footer */}
      <footer className={`border-t-2 border-gray-300 bg-white mt-12`}>
        <div className="container mx-auto px-4 py-6 text-center text-sm text-gray-600">
          <p>Weather data provided by Open-Meteo • Built with modern web technologies</p>
          <p className="mt-1">Designed for General Public, Marine, Mountain, and Agricultural professionals</p>
        </div>
      </footer>
    </div>
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
