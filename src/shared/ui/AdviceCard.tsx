import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Alert from "@mui/material/Alert";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoIcon from "@mui/icons-material/Info";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import type {
  AgriculturalAnalysis,
  AIAnalysis,
  MarineAnalysis,
  MountainAnalysis,
} from "@/shared/types/weather";

type AnyAdvice =
  | AIAnalysis
  | MarineAnalysis
  | MountainAnalysis
  | AgriculturalAnalysis;

interface AdviceCardProps {
  advice: AnyAdvice;
  /** Heading. Defaults to the persona-neutral wording. */
  title?: string;
}

const RISK_COLOR = {
  low: "success",
  medium: "warning",
  high: "error",
} as const;

const RISK_ICON = {
  low: <CheckCircleIcon fontSize="small" />,
  medium: <InfoIcon fontSize="small" />,
  high: <WarningAmberIcon fontSize="small" />,
} as const;

/** A label/value row, with the value optionally rendered as a status chip. */
function Row({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: "success" | "warning" | "error" | "default";
}) {
  return (
    <Stack
      direction="row"
      sx={{ alignItems: "center", justifyContent: "space-between" }}
    >
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {label}
      </Typography>
      {color ? (
        <Chip
          size="small"
          color={color === "default" ? undefined : color}
          label={value}
          sx={{ textTransform: "capitalize" }}
        />
      ) : (
        <Typography variant="body2">{value}</Typography>
      )}
    </Stack>
  );
}

/**
 * Renders any persona's advice.
 *
 * The four analysis shapes are discriminated structurally with `in` checks
 * rather than a tag, so adding a persona means adding a branch here that
 * TypeScript will not force you to write. A `kind` field on the analysis types
 * would fix that; it is a wider change than this migration.
 */
function PersonaDetail({ advice }: { advice: AnyAdvice }) {
  if ("fishingConditions" in advice) {
    const a = advice as MarineAnalysis;
    return (
      <Stack spacing={1}>
        <Row
          label="Fishing conditions"
          value={a.fishingConditions}
          color={
            a.fishingConditions === "excellent"
              ? "success"
              : a.fishingConditions === "good"
                ? "default"
                : "error"
          }
        />
        <Row label="Sea state" value={a.seaState} />
        {a.tideRecommendation && (
          <Alert severity="info" variant="outlined">
            {a.tideRecommendation}
          </Alert>
        )}
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          <strong>Wave analysis:</strong> {a.waveAnalysis}
        </Typography>
      </Stack>
    );
  }

  if ("avalancheRisk" in advice) {
    const a = advice as MountainAnalysis;
    return (
      <Stack spacing={1}>
        <Row
          label="Avalanche risk"
          value={a.avalancheRisk}
          color={a.avalancheRisk === "low" ? "success" : "error"}
        />
        <Row label="Wind exposure" value={a.windExposure} />
        <Row label="Visibility" value={a.visibilityForecast} />
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          <strong>Temperature gradient:</strong> {a.temperatureGradient}
        </Typography>
      </Stack>
    );
  }

  if ("soilConditions" in advice) {
    const a = advice as AgriculturalAnalysis;
    return (
      <Stack spacing={1}>
        <Row
          label="Soil conditions"
          value={a.soilConditions}
          color={
            a.soilConditions === "excellent"
              ? "success"
              : a.soilConditions === "good"
                ? "default"
                : "error"
          }
        />
        <Row
          label="Frost risk"
          value={a.frostRisk}
          color={a.frostRisk === "none" ? "success" : "error"}
        />
        <Row
          label="Irrigation needed"
          value={a.irrigationNeeded ? "Yes" : "No"}
          color={a.irrigationNeeded ? "warning" : "success"}
        />
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          <strong>Planting:</strong> {a.plantingConditions}
        </Typography>
        {a.harvestRecommendation && (
          <Alert severity="success" variant="outlined">
            <strong>Harvest:</strong> {a.harvestRecommendation}
          </Alert>
        )}
      </Stack>
    );
  }

  return null;
}

export function AdviceCard({ advice, title = "What this means" }: AdviceCardProps) {
  return (
    <Card>
      <CardHeader
        title={title}
        slotProps={{ title: { variant: "h6", component: "h2" } }}
      />
      <CardContent>
        <Stack spacing={2}>
          <Stack
            direction="row"
            sx={{ alignItems: "center", justifyContent: "space-between" }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              Risk level
            </Typography>
            <Chip
              size="small"
              icon={RISK_ICON[advice.riskLevel]}
              color={RISK_COLOR[advice.riskLevel]}
              label={advice.riskLevel}
              sx={{ textTransform: "capitalize" }}
            />
          </Stack>

          <Alert severity="info" icon={<InfoIcon />}>
            <Typography variant="subtitle2">Recommendation</Typography>
            <Typography variant="body2">{advice.recommendation}</Typography>
          </Alert>

          {advice.bestTimeForActivity && (
            <Typography variant="body2">
              <strong>Best time:</strong> {advice.bestTimeForActivity}
            </Typography>
          )}

          <PersonaDetail advice={advice} />

          {advice.profileSpecificTips.length > 0 && (
            <>
              <Divider />
              <Typography variant="subtitle2">Tips</Typography>
              <List dense disablePadding>
                {advice.profileSpecificTips.map((tip) => (
                  <ListItem key={tip} disableGutters sx={{ py: 0.25 }}>
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      <FiberManualRecordIcon sx={{ fontSize: 8 }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={tip}
                      slotProps={{ primary: { variant: "body2" } }}
                    />
                  </ListItem>
                ))}
              </List>
            </>
          )}

          <Divider />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            Based on {advice.reasoning}. Confidence {advice.confidence}% — a
            fixed value from the rules, not a measured certainty.
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}
