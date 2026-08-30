import type { ReactNode } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

interface QueryStateProps {
  isLoading: boolean;
  /** RTK Query's error, or any truthy value meaning "the request failed". */
  error?: unknown;
  /** False when the request succeeded but the payload lacks what we need. */
  hasData: boolean;
  /** Shown while loading, e.g. "Loading marine conditions". */
  loadingLabel: string;
  errorTitle: string;
  errorMessage?: string;
  /** Shown when the request succeeded but the payload is unusable. */
  incompleteMessage?: string;
  /**
   * A function, not a node, on purpose. JSX children are evaluated by the
   * caller before this component ever runs, so `children` would execute
   * `data!.hourly.time` even while data is undefined — the exact crash this
   * component exists to prevent. A render prop defers it until `hasData`.
   */
  children: () => ReactNode;
}

/**
 * The four states every dashboard has to render: loading, failed, succeeded but
 * incomplete, and ready.
 *
 * All four dashboards hand-rolled this, which is most of why they were ~1180
 * lines between them — and why they drifted: the mountain dashboard folded
 * "incomplete" into its error branch, so a partial payload told the user the
 * request had failed.
 *
 * The incomplete state is not paranoia. Open-Meteo returns partial payloads by
 * design — mountain wind at 80m/120m is optional, and the marine API answers an
 * inland coordinate with an empty series rather than an error — so a present
 * `data` object is never a guarantee the field you want exists.
 */
export function QueryState({
  isLoading,
  error,
  hasData,
  loadingLabel,
  errorTitle,
  errorMessage = "Please check your connection and try again.",
  incompleteMessage = "The forecast came back without the data this view needs.",
  children,
}: QueryStateProps) {
  if (isLoading) {
    return (
      <Stack
        spacing={2}
        sx={{ alignItems: "center", justifyContent: "center", p: 6 }}
      >
        <CircularProgress />
        <Typography sx={{ color: "text.secondary" }}>{loadingLabel}</Typography>
      </Stack>
    );
  }

  if (error || !hasData) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity={error ? "error" : "warning"}>
          <AlertTitle>{error ? errorTitle : "Incomplete data"}</AlertTitle>
          {error ? errorMessage : incompleteMessage}
        </Alert>
      </Box>
    );
  }

  return <>{children()}</>;
}
