import { useEffect, useMemo } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CheckCircleRoundedIcon from "@mui/icons-material/CheckCircleRounded";
import CloseIcon from "@mui/icons-material/Close";
import DangerousRoundedIcon from "@mui/icons-material/DangerousRounded";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import InfoRoundedIcon from "@mui/icons-material/InfoRounded";
import MarkEmailReadOutlinedIcon from "@mui/icons-material/MarkEmailReadOutlined";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import WarningRoundedIcon from "@mui/icons-material/WarningRounded";

import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { Coordinates, RiskLevel, WeatherAlert } from "@/shared/types/weather";
import { useGetAlertConditionsQuery } from "@/features/alerts/api/alertConditionsApi";
import { alertLevel, deriveAlerts } from "@/features/alerts/lib/deriveAlerts";
import {
  clearAlerts,
  markAlertAsRead,
  markAllAlertsAsRead,
  removeAlert,
  setAlerts,
} from "@/features/alerts/store/alertsSlice";

export interface AlertsPanelProps {
  /**
   * When given, the panel derives alerts for this point and keeps the slice in
   * step with them. Omitted, it renders whatever is already in the slice —
   * which is what a history or settings screen wants.
   */
  coordinates?: Coordinates;
}

/**
 * One icon *outline* per level, not one colour per level.
 *
 * A tick, an info disc, a triangle and an octagon are four different shapes, so
 * the level survives greyscale, a colour-blind reader and a phone in direct
 * sun. The word is printed beside it as well; colour is the third channel, not
 * the only one.
 */
const LEVEL_ICON = {
  low: CheckCircleRoundedIcon,
  moderate: InfoRoundedIcon,
  high: WarningRoundedIcon,
  severe: DangerousRoundedIcon,
} as const;

const LEVEL_WORD: Record<RiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Severe",
};

/** Severe first, so the thing that matters is not below the fold. */
const LEVEL_ORDER: Record<RiskLevel, number> = {
  severe: 0,
  high: 1,
  moderate: 2,
  low: 3,
};

function AlertRow({
  alert,
  isRead,
  onRead,
  onDismiss,
}: {
  alert: WeatherAlert;
  isRead: boolean;
  onRead: () => void;
  onDismiss: () => void;
}) {
  const level = alertLevel(alert);
  const Icon = LEVEL_ICON[level];

  return (
    <Paper
      component="article"
      // The accessible name leads with the severity word, because a screen
      // reader user gets no benefit from the colour or the icon shape.
      aria-label={`${LEVEL_WORD[level]} alert: ${alert.title}`}
      sx={(theme) => ({
        p: 2,
        borderRadius: 3,
        border: "1px solid",
        borderColor: theme.vars.palette.risk[level].border,
        backgroundColor: theme.vars.palette.risk[level].soft,
        // Unread carries a heavier left rule as well as the "Unread" chip, so
        // the state is visible at a glance and readable when it is not.
        borderInlineStartWidth: isRead ? 1 : 5,
        borderInlineStartColor: theme.vars.palette.risk[level].main,
        opacity: isRead ? 0.75 : 1,
      })}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "flex-start" }}>
        <Icon
          aria-hidden
          sx={(theme) => ({
            fontSize: 24,
            flexShrink: 0,
            color: theme.vars.palette.risk[level].main,
          })}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
          >
            <Typography
              variant="subtitle1"
              component="h3"
              sx={(theme) => ({
                fontWeight: 700,
                color: theme.vars.palette.risk[level].text,
              })}
            >
              {alert.title}
            </Typography>
            <Chip
              size="small"
              label={LEVEL_WORD[level]}
              sx={(theme) => ({
                borderColor: theme.vars.palette.risk[level].border,
                color: theme.vars.palette.risk[level].text,
                backgroundColor: theme.vars.palette.background.paper,
              })}
              variant="outlined"
            />
            {!isRead && (
              <Chip size="small" label="Unread" variant="outlined" />
            )}
          </Stack>

          <Typography variant="body2" sx={{ mt: 0.75 }}>
            {alert.message}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
          {!isRead && (
            <Tooltip title="Mark as read">
              <IconButton
                size="small"
                aria-label={`Mark "${alert.title}" as read`}
                onClick={onRead}
              >
                <MarkEmailReadOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Dismiss">
            <IconButton
              size="small"
              aria-label={`Dismiss "${alert.title}"`}
              onClick={onDismiss}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Paper>
  );
}

/**
 * Active weather alerts, with dismiss and mark-read.
 *
 * The `alerts` slice had a full reducer set and nothing in the app dispatching
 * to it — including a `markAlertAsRead` that found the alert and then ran an
 * empty `if` body. This is the surface that uses it.
 *
 * An **Alert** is a threshold breach, distinct from a **Tip** (advisory text an
 * Analysis produces, never persisted) and a **Notification** (the PWA delivery
 * mechanism). See `CONTEXT.md`.
 */
export function AlertsPanel({ coordinates }: AlertsPanelProps) {
  const dispatch = useAppDispatch();

  const alerts = useAppSelector((state) => state.alerts.alerts);
  const readIds = useAppSelector((state) => state.alerts.readIds);
  const sensitivity = useAppSelector(
    (state) => state.preferences.alertSensitivity,
  );
  const profile = useAppSelector((state) => state.userProfile.profile);

  // `skip` rather than a conditional hook: without coordinates this panel is a
  // reader of the slice and issues no request at all.
  const { data } = useGetAlertConditionsQuery(coordinates ?? { latitude: 0, longitude: 0 }, {
    skip: !coordinates,
  });

  const derived = useMemo(
    () => (data ? deriveAlerts(data, { sensitivity, profile }) : null),
    [data, sensitivity, profile],
  );

  useEffect(() => {
    // `setAlerts`, not a loop of `addAlert`: the derivation returns the whole
    // current set, so replacing it is what lets a breach that has *passed*
    // disappear. An alert that can only be added is an alert that never goes
    // away.
    if (derived) dispatch(setAlerts(derived));
  }, [derived, dispatch]);

  const sorted = useMemo(
    () =>
      [...alerts].sort(
        (a, b) => LEVEL_ORDER[alertLevel(a)] - LEVEL_ORDER[alertLevel(b)],
      ),
    [alerts],
  );

  const unreadCount = sorted.filter(
    (alert) => !readIds.includes(alert.id),
  ).length;

  return (
    <Box component="section" aria-label="Weather alerts">
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          rowGap: 1,
          mb: 1.5,
        }}
      >
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <NotificationsNoneIcon
            aria-hidden
            sx={{ fontSize: 20, color: "text.secondary" }}
          />
          <Typography variant="h6" component="h2">
            Alerts
          </Typography>
          {unreadCount > 0 && (
            <Chip size="small" label={`${unreadCount} unread`} />
          )}
        </Stack>

        {sorted.length > 0 && (
          <Stack direction="row" spacing={1}>
            {unreadCount > 0 && (
              <Button
                size="small"
                startIcon={<DoneAllIcon />}
                onClick={() => dispatch(markAllAlertsAsRead())}
              >
                Mark all read
              </Button>
            )}
            <Button size="small" onClick={() => dispatch(clearAlerts())}>
              Dismiss all
            </Button>
          </Stack>
        )}
      </Stack>

      {sorted.length === 0 ? (
        <Paper
          sx={{
            p: 2,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Nothing crosses an alert threshold right now. Thresholds follow your
            alert sensitivity setting, currently <strong>{sensitivity}</strong>.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {sorted.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              isRead={readIds.includes(alert.id)}
              onRead={() => dispatch(markAlertAsRead(alert.id))}
              onDismiss={() => dispatch(removeAlert(alert.id))}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}
