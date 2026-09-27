import type { ReactNode } from "react";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloudOffIcon from "@mui/icons-material/CloudOff";
import RefreshIcon from "@mui/icons-material/Refresh";
import { formatCoordinates } from "@/shared/lib/geo";
import { describeQueryError } from "@/shared/lib/queryError";
import type { Coordinates } from "@/shared/types/weather";

export interface DashboardShellProps {
  title: string;
  subtitle?: string;
  /** Display-only, but every dashboard header expects it beside the figures. */
  locationName: string;
  /** WGS 84, shown under the name at `WGS84.precision`. Never converted. */
  coordinates: Coordinates;
  isLoading: boolean;
  isError: boolean;
  /** RTK Query's error, translated into something a person can act on. */
  error?: unknown;
  /** The request succeeded but the payload lacks what this view needs. */
  isEmpty?: boolean;
  onRetry?: () => void;
  /** Header-right slot: a unit toggle, a range picker, a refresh button. */
  actions?: ReactNode;
  /** Rendered only when not loading, not failed and not empty. */
  children: ReactNode;
}

/** The header, which is identical in every state — including the failed one. */
function ShellHeader({
  title,
  subtitle,
  locationName,
  coordinates,
  actions,
}: Pick<
  DashboardShellProps,
  "title" | "subtitle" | "locationName" | "coordinates" | "actions"
>) {
  return (
    <Stack
      direction="row"
      spacing={2}
      sx={{
        alignItems: "flex-start",
        justifyContent: "space-between",
        flexWrap: "wrap",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h4" component="h1">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.25 }}>
            {subtitle}
          </Typography>
        )}
        <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.75 }}>
          {locationName}
          {" · "}
          {/* WGS 84 decimal degrees, formatted by the one function that does
              it. Nothing on this screen converts a coordinate. */}
          <Box component="span" sx={{ fontVariantNumeric: "tabular-nums" }}>
            {formatCoordinates(coordinates)}
          </Box>
        </Typography>
      </Box>
      {actions && <Box sx={{ flexShrink: 0 }}>{actions}</Box>}
    </Stack>
  );
}

/**
 * Skeletons in the shape of the real dashboard: a hero band, a tile grid, a
 * chart.
 *
 * A spinner says "wait"; this says "wait, and here is roughly what arrives" —
 * and because the boxes occupy the space the content will, nothing jumps when
 * the data lands. That reflow is the actual complaint behind "the app feels
 * janky", not the wait itself.
 */
function ShellSkeleton() {
  return (
    <Stack spacing={3} aria-hidden>
      <Skeleton variant="rounded" height={196} sx={{ borderRadius: 4 }} />
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        }}
      >
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton
            key={index}
            variant="rounded"
            height={96}
            sx={{ borderRadius: 3 }}
          />
        ))}
      </Box>
      <Skeleton variant="rounded" height={260} sx={{ borderRadius: 3 }} />
    </Stack>
  );
}

/**
 * The frame all four dashboards share: header, then one of loading, failed,
 * empty or ready.
 *
 * Every dashboard hand-rolled this, which is most of why they ran to ~1180
 * lines between them — and why they drifted apart. The mountain one folded
 * "empty" into its error branch, so a partial payload told the user the request
 * had failed; two of them showed a bare spinner with no way to retry.
 *
 * `children` is a plain node here, unlike `QueryState`'s render prop. That is
 * safe only because the caller renders this *after* narrowing its data — the
 * shell has no `data` to guard. If a call site needs the payload guarded, it
 * wants `QueryState` inside this, not instead of it.
 *
 * "Empty" is a first-class state, not paranoia: Open-Meteo answers an inland
 * coordinate's marine query with an empty series and HTTP 200, and optional
 * fields (80m/120m wind) are simply absent. A present response is never a
 * guarantee that the field a view needs came with it.
 */
export function DashboardShell({
  title,
  subtitle,
  locationName,
  coordinates,
  isLoading,
  isError,
  error,
  isEmpty = false,
  onRetry,
  actions,
  children,
}: DashboardShellProps) {
  const retry = onRetry && (
    <Button
      size="small"
      variant="outlined"
      color="inherit"
      startIcon={<RefreshIcon />}
      onClick={onRetry}
    >
      Retry
    </Button>
  );

  return (
    <Stack spacing={3} sx={{ width: "100%" }}>
      <ShellHeader
        title={title}
        subtitle={subtitle}
        locationName={locationName}
        coordinates={coordinates}
        actions={actions}
      />

      {/* Announced politely so a screen reader hears the outcome without the
          skeletons or a mid-flight state interrupting whatever is being read. */}
      <Box aria-live="polite" aria-busy={isLoading}>
        {isLoading ? (
          <ShellSkeleton />
        ) : isError ? (
          <Alert severity="error" action={retry}>
            <AlertTitle>{title} could not be loaded</AlertTitle>
            {describeQueryError(error)}
          </Alert>
        ) : isEmpty ? (
          <Alert severity="warning" icon={<CloudOffIcon />} action={retry}>
            <AlertTitle>No data for this location</AlertTitle>
            The request succeeded, but the forecast came back without the
            readings this view needs. That usually means the model has no
            coverage at {formatCoordinates(coordinates)} — try a nearby point.
          </Alert>
        ) : (
          children
        )}
      </Box>
    </Stack>
  );
}
