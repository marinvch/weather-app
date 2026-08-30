import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import NotificationsIcon from "@mui/icons-material/Notifications";
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff";
import InstallMobileIcon from "@mui/icons-material/InstallMobile";
import { useOffline } from "@/features/pwa/hooks/useOffline";

interface OfflineIndicatorProps {
  /** Full panel with cache controls, rather than the header pill. */
  showDetails?: boolean;
}

export function OfflineIndicator({ showDetails = false }: OfflineIndicatorProps) {
  const {
    isOnline,
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
    return (
      <Chip
        size="small"
        variant="outlined"
        color={isOnline ? "success" : "error"}
        icon={isOnline ? <WifiIcon /> : <WifiOffIcon />}
        label={
          isOnline
            ? "Online"
            : cacheStatus && cacheStatus.totalCached > 0
              ? `Offline · ${cacheStatus.totalCached} cached`
              : "Offline"
        }
      />
    );
  }

  return (
    <Card>
      <CardHeader
        title="Offline and storage"
        slotProps={{ title: { variant: "h6", component: "h2" } }}
      />
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography variant="body2">Connection</Typography>
            <Chip
              size="small"
              color={isOnline ? "success" : "error"}
              icon={isOnline ? <WifiIcon /> : <WifiOffIcon />}
              label={isOnline ? "Online" : "Offline"}
            />
          </Stack>

          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography variant="body2">Service worker</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {isServiceWorkerActive ? "Active" : "Not active"}
            </Typography>
          </Stack>

          {cacheStatus && (
            <>
              <Stack
                direction="row"
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Typography variant="body2">Cached forecasts</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {cacheStatus.totalCached} ·{" "}
                  {formatCacheSize(cacheStatus.cacheSize)}
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Last updated {formatLastUpdated(cacheStatus.lastUpdated)}
              </Typography>
            </>
          )}

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => {
                refreshCacheStatus();
                requestSync();
              }}
            >
              Refresh
            </Button>

            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={clearCache}
            >
              Clear cache
            </Button>

            {isPushSupported && (
              <Button
                size="small"
                variant="outlined"
                startIcon={
                  isPushSubscribed ? (
                    <NotificationsOffIcon />
                  ) : (
                    <NotificationsIcon />
                  )
                }
                onClick={() =>
                  isPushSubscribed ? unsubscribeFromPush() : subscribeToPush()
                }
              >
                {isPushSubscribed ? "Mute alerts" : "Enable alerts"}
              </Button>
            )}

            {canInstall && (
              <Button
                size="small"
                variant="contained"
                startIcon={<InstallMobileIcon />}
                onClick={promptInstall}
              >
                Install app
              </Button>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
