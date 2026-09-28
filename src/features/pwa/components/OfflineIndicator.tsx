import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
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
    isInstalled,
    promptInstall,
    formatCacheSize,
    formatLastUpdated,
  } = useOffline();

  const cachedCount = cacheStatus?.totalCached ?? 0;

  if (!showDetails) {
    const label = isOnline
      ? "Online"
      : cachedCount > 0
        ? `Offline · ${cachedCount} cached`
        : "Offline";

    const explanation = isOnline
      ? isServiceWorkerActive
        ? `Live data. ${cachedCount} response${cachedCount === 1 ? "" : "s"} kept for offline use.`
        : "Live data. Offline support is not active on this device yet."
      : cachedCount > 0
        ? `Showing saved data, last updated ${formatLastUpdated(cacheStatus?.lastUpdated ?? 0).toLowerCase()}.`
        : "No connection and nothing saved for this location yet.";

    return (
      <Tooltip title={explanation}>
        {/* role=status so a screen reader hears the change without stealing focus. */}
        <Chip
          role="status"
          aria-live="polite"
          aria-label={`${label}. ${explanation}`}
          size="small"
          variant="outlined"
          color={isOnline ? "success" : "warning"}
          icon={isOnline ? <WifiIcon /> : <WifiOffIcon />}
          label={label}
        />
      </Tooltip>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Offline and storage"
        subheader={
          isServiceWorkerActive
            ? "Forecasts you have already opened stay available without a connection."
            : "Offline support activates after the app has been loaded once from the network."
        }
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
              role="status"
              aria-live="polite"
              size="small"
              color={isOnline ? "success" : "warning"}
              icon={isOnline ? <WifiIcon /> : <WifiOffIcon />}
              label={isOnline ? "Online" : "Offline"}
            />
          </Stack>

          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography variant="body2">Offline support</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {isServiceWorkerActive
                ? `Active${cacheStatus?.version ? ` · ${cacheStatus.version}` : ""}`
                : "Not active"}
            </Typography>
          </Stack>

          {isInstalled && (
            <Stack
              direction="row"
              sx={{ alignItems: "center", justifyContent: "space-between" }}
            >
              <Typography variant="body2">Installed</Typography>
              <Chip
                size="small"
                variant="outlined"
                color="success"
                icon={<CloudDoneIcon />}
                label="Running as an app"
              />
            </Stack>
          )}

          {cacheStatus && (
            <>
              <Divider />
              <Stack
                direction="row"
                sx={{ alignItems: "center", justifyContent: "space-between" }}
              >
                <Typography variant="body2">Saved responses</Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {cachedCount} · {formatCacheSize(cacheStatus.cacheSize)}
                </Typography>
              </Stack>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Newest saved copy: {formatLastUpdated(cacheStatus.lastUpdated)}
              </Typography>
            </>
          )}

          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            <Tooltip
              title={
                isOnline
                  ? "Refresh every saved forecast from the network"
                  : "Needs a connection"
              }
            >
              {/* A disabled button swallows the pointer events a Tooltip needs. */}
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!isOnline}
                  startIcon={<RefreshIcon />}
                  onClick={() => {
                    requestSync();
                    refreshCacheStatus();
                  }}
                >
                  Refresh
                </Button>
              </span>
            </Tooltip>

            <Button
              size="small"
              variant="outlined"
              color="error"
              disabled={cachedCount === 0}
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
                {isPushSubscribed ? "Mute notifications" : "Enable notifications"}
              </Button>
            )}

            {canInstall && !isInstalled && (
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
