import { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import InstallMobileIcon from "@mui/icons-material/InstallMobile";
import {
  isAppInstalled,
  isInstallPromptAvailable,
  onInstallAvailabilityChange,
  showInstallPrompt,
} from "@/features/pwa/lib/serviceWorker";

/** Survives reloads so a declined install is not asked about again. */
const DISMISSED_KEY = "weather-pro:install-prompt-dismissed";

const readDismissed = (): boolean => {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "true";
  } catch {
    // Private mode or storage disabled — treat as "not dismissed".
    return false;
  }
};

const writeDismissed = (): void => {
  try {
    window.localStorage.setItem(DISMISSED_KEY, "true");
  } catch {
    // Nothing to do; the prompt simply reappears next session.
  }
};

/**
 * A dismissible install CTA, driven by the `beforeinstallprompt` event that
 * `setupInstallPrompt()` captured at startup. Takes no props and renders
 * nothing unless the browser has said the app is installable, the user has not
 * dismissed it before, and it is not already running standalone.
 */
export function InstallPrompt() {
  const [canInstall, setCanInstall] = useState(isInstallPromptAvailable);
  const [dismissed, setDismissed] = useState(readDismissed);
  // Display mode cannot change without a reload, so this is read once.
  const [installed] = useState(isAppInstalled);

  useEffect(() => onInstallAvailabilityChange(setCanInstall), []);

  const dismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  const install = async () => {
    await showInstallPrompt();
    // Whatever the browser dialog returned, the captured event is spent and
    // onInstallAvailabilityChange has already flipped canInstall to false.
  };

  return (
    <Snackbar
      open={canInstall && !dismissed && !installed}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      sx={{ maxWidth: 420 }}
    >
      <Paper elevation={6} sx={{ p: 2, width: "100%" }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start" }}>
          <InstallMobileIcon color="primary" />
          <Stack spacing={0.5} sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle2">Install Weather Pro</Typography>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Add it to this device for a full-screen app and access to the
              forecasts you have already loaded while offline.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
              <Button size="small" variant="contained" onClick={install}>
                Install
              </Button>
              <Button size="small" color="inherit" onClick={dismiss}>
                Not now
              </Button>
            </Stack>
          </Stack>
          <IconButton
            size="small"
            aria-label="Dismiss install prompt"
            onClick={dismiss}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Paper>
    </Snackbar>
  );
}
