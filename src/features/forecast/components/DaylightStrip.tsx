import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import WbSunnyOutlinedIcon from "@mui/icons-material/WbSunnyOutlined";
import WbTwilightIcon from "@mui/icons-material/WbTwilight";
import { formatDuration, type DaylightDay } from "@/features/forecast/lib/astronomy";

export interface DaylightStripProps {
  day: DaylightDay;
  /**
   * How far through daylight it is now, 0 to 1 — from `daylightProgress`, which
   * needs the coordinate's own offset. Null hides the marker rather than
   * defaulting it to one end, because a marker in the wrong place is worse
   * than none.
   */
  progress: number | null;
}

/**
 * Sunrise, sunset, and how much of the day is left.
 *
 * The bar is the day, sunrise to sunset. Sunshine duration tints the filled
 * part so a grey day and a bright one of the same length look different, and
 * the "now" marker says where in it you are — which is the question someone
 * checking at 16:00 in November is actually asking.
 *
 * Both figures are also written out as text. The bar is a summary, not the
 * data: a strip with no numbers is a decoration.
 */
export function DaylightStrip({ day, progress }: DaylightStripProps) {
  const { sunrise, sunset, daylightSeconds, sunshineSeconds, sunshineFraction } =
    day;

  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: "center", justifyContent: "space-between", mb: 1.5 }}
      >
        <Typography variant="label" component="h3">
          Daylight
        </Typography>
        {daylightSeconds !== null && (
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}
          >
            {formatDuration(daylightSeconds)}
          </Typography>
        )}
      </Stack>

      <Box
        // The whole strip is one labelled image: four adjacent boxes announce
        // as nothing at all, and the times either side are already in the DOM
        // as text, so this only has to carry the shape.
        role="img"
        aria-label={
          sunrise && sunset
            ? `Sunrise ${sunrise}, sunset ${sunset}${
                daylightSeconds !== null
                  ? `, ${formatDuration(daylightSeconds)} of daylight`
                  : ""
              }`
            : "Daylight times unavailable"
        }
        sx={{
          position: "relative",
          height: 10,
          borderRadius: 999,
          overflow: "hidden",
          // Night either side of the bar, so the filled part reads as the lit
          // part of the day rather than as a progress percentage.
          backgroundColor: "action.hover",
        }}
      >
        {sunshineFraction !== null && (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              width: `${sunshineFraction * 100}%`,
              background:
                "linear-gradient(90deg, #F0B429 0%, #F7D060 60%, #FDE9A9 100%)",
            }}
          />
        )}

        {progress !== null && (
          <Box
            aria-hidden
            sx={(theme) => ({
              position: "absolute",
              top: -2,
              bottom: -2,
              left: `${progress * 100}%`,
              width: 3,
              // Translated back by its own width so the marker sits *on* the
              // position rather than starting at it — visible at 0% and 100%,
              // where an untranslated marker is clipped by the overflow.
              transform: "translateX(-1.5px)",
              borderRadius: 999,
              backgroundColor: theme.vars.palette.text.primary,
            })}
          />
        )}
      </Box>

      <Stack
        direction="row"
        spacing={2}
        sx={{
          mt: 1.25,
          justifyContent: "space-between",
          flexWrap: "wrap",
          rowGap: 1,
        }}
      >
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <WbTwilightIcon aria-hidden sx={{ fontSize: 18, color: "text.secondary" }} />
          <Typography variant="body2">
            Sunrise{" "}
            <Box component="span" sx={{ fontWeight: 600 }}>
              {sunrise ?? "--:--"}
            </Box>
          </Typography>
        </Stack>

        {sunshineSeconds !== null && (
          <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
            <WbSunnyOutlinedIcon
              aria-hidden
              sx={{ fontSize: 18, color: "text.secondary" }}
            />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {formatDuration(sunshineSeconds)} of sunshine
              {/*
                Peak UV, stated but deliberately not banded here. The WHO bands
                and their burn times live in the air quality feature, and a
                second copy of those thresholds in this one is exactly how two
                screens end up disagreeing about whether to wear sunscreen.
              */}
              {day.uvIndexMax !== null && ` · peak UV ${day.uvIndexMax.toFixed(1)}`}
            </Typography>
          </Stack>
        )}

        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
          <DarkModeOutlinedIcon
            aria-hidden
            sx={{ fontSize: 18, color: "text.secondary" }}
          />
          <Typography variant="body2">
            Sunset{" "}
            <Box component="span" sx={{ fontWeight: 600 }}>
              {sunset ?? "--:--"}
            </Box>
          </Typography>
        </Stack>
      </Stack>
    </Paper>
  );
}
