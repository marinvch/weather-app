import { useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useServiceWorkerUpdate } from "@/features/pwa/hooks/useServiceWorkerUpdate";

/**
 * Offers the reload when a new service worker is waiting. Mounted once, near
 * the root; it renders nothing until there is an update, and takes no props.
 *
 * Dismissing hides it for this page load only — the waiting worker is still
 * there and will take over on the next natural navigation.
 */
export function UpdatePrompt() {
  const { updateAvailable, applyUpdate } = useServiceWorkerUpdate();
  const [dismissed, setDismissed] = useState(false);

  const open = updateAvailable && !dismissed;

  return (
    <Snackbar
      open={open}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      onClose={(_event, reason) => {
        // Not clickaway: an accidental click elsewhere should not dismiss it.
        if (reason === "clickaway") return;
        setDismissed(true);
      }}
    >
      <Alert
        severity="info"
        variant="filled"
        icon={<RefreshIcon fontSize="inherit" />}
        // `action` replaces Alert's own close button, so the dismiss control
        // lives here alongside the reload.
        action={
          <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <Button color="inherit" size="small" onClick={applyUpdate}>
              Reload
            </Button>
            <IconButton
              color="inherit"
              size="small"
              aria-label="Dismiss update notice"
              onClick={() => setDismissed(true)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        }
        sx={{ alignItems: "center" }}
      >
        A new version of Weather Pro is available.
      </Alert>
    </Snackbar>
  );
}
