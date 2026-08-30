import { Wifi, WifiOff, Download, Trash2, RefreshCw, Bell, BellOff, Smartphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Button } from '@/shared/ui/button';
import { useOffline } from '@/features/pwa/hooks/useOffline';

interface OfflineIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function OfflineIndicator({ className, showDetails = false }: OfflineIndicatorProps) {
  const {
    isOnline,
    isOffline,
    cacheStatus,
    clearCache,
    refreshCacheStatus,
    isServiceWorkerActive,
    requestSync,
    isPushSupported,
    isPushSubscribed,
    subscribeToPush,
    unsubscribeFromPush,
    canInstall,
    promptInstall,
    formatCacheSize,
    formatLastUpdated,
  } = useOffline();

  if (!showDetails) {
    // Simple indicator
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {isOnline ? (
          <>
            <Wifi className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-600">Online</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-600">Offline</span>
          </>
        )}
        {isServiceWorkerActive && cacheStatus && cacheStatus.totalCached > 0 && (
          <span className="text-xs text-gray-500">
            ({cacheStatus.totalCached} cached)
          </span>
        )}
      </div>
    );
  }

  // Detailed view
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-5 h-5 text-green-600" />
          ) : (
            <WifiOff className="w-5 h-5 text-red-600" />
          )}
          Connection Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Network Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm">Network:</span>
          <span className={`text-sm font-medium ${isOnline ? 'text-green-600' : 'text-red-600'
            }`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Service Worker Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm">Offline Support:</span>
          <span className={`text-sm font-medium ${isServiceWorkerActive ? 'text-green-600' : 'text-gray-500'
            }`}>
            {isServiceWorkerActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Cache Information */}
        {isServiceWorkerActive && cacheStatus && (
          <div className="space-y-2 p-3 border-2 border-gray-300 rounded-lg">
            <h4 className="text-sm font-medium">Cache Status</h4>

            <div className="flex items-center justify-between text-sm">
              <span>Cached locations:</span>
              <span>{cacheStatus.totalCached}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span>Cache size:</span>
              <span>{formatCacheSize(cacheStatus.cacheSize)}</span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span>Last updated:</span>
              <span>{formatLastUpdated(cacheStatus.lastUpdated)}</span>
            </div>

            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={refreshCacheStatus}
                className="flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={clearCache}
                className="flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </Button>

              {isOffline && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => requestSync()}
                  className="flex items-center gap-1"
                >
                  <Download className="w-3 h-3" />
                  Sync
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Push Notifications */}
        {isPushSupported && (
          <div className="space-y-2 p-3 border-2 border-gray-300 rounded-lg">
            <h4 className="text-sm font-medium">Weather Alerts</h4>

            <div className="flex items-center justify-between">
              <span className="text-sm">Push notifications:</span>
              <span className={`text-sm font-medium ${isPushSubscribed ? 'text-green-600' : 'text-gray-500'
                }`}>
                {isPushSubscribed ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={isPushSubscribed ? unsubscribeFromPush : subscribeToPush}
              className="flex items-center gap-1 w-full"
            >
              {isPushSubscribed ? (
                <>
                  <BellOff className="w-3 h-3" />
                  Disable Alerts
                </>
              ) : (
                <>
                  <Bell className="w-3 h-3" />
                  Enable Alerts
                </>
              )}
            </Button>
          </div>
        )}

        {/* PWA Installation */}
        {canInstall && (
          <div className="space-y-2 p-3 border rounded-lg">
            <h4 className="text-sm font-medium">Install App</h4>
            <p className="text-sm text-muted-foreground">
              Install the Weather App for a better offline experience.
            </p>

            <Button
              size="sm"
              onClick={promptInstall}
              className="flex items-center gap-1 w-full"
            >
              <Smartphone className="w-3 h-3" />
              Install App
            </Button>
          </div>
        )}

        {/* Offline Notice */}
        {isOffline && (
          <div className="p-3 border-2 border-yellow-600 rounded-lg">
            <h4 className="text-sm font-medium text-yellow-800">Offline Mode</h4>
            <p className="text-sm text-yellow-700 mt-1">
              You're viewing cached weather data. Connect to the internet for fresh updates.
            </p>
          </div>
        )}

        {/* No Cache Warning */}
        {isOffline && (!cacheStatus || cacheStatus.totalCached === 0) && (
          <div className="p-3 border-2 border-red-600 rounded-lg">
            <h4 className="text-sm font-medium text-red-800">No Cached Data</h4>
            <p className="text-sm text-red-700 mt-1">
              No weather data available offline. Connect to the internet to load and cache weather information.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
