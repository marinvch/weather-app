/**
 * Arrow fields: turning a bearing in degrees into a rotation on screen.
 *
 * A direction field is a list of points, each carrying a bearing and a
 * magnitude — wind at 220° blowing 34 km/h, waves running to 040° at 2.1 m.
 * Rendering one is two decisions, and this file owns both so that no caller has
 * to guess: how far to rotate the glyph, and which step of the ramp it lands on.
 *
 * ## The one rule: an arrow points the way the flow is going
 *
 * Every arrow this module produces points **downstream** — the direction the
 * air or the water is travelling towards. That is a rendering choice, made once,
 * so that a wind arrow and a wave arrow on the same map read the same way. It is
 * *not* a wind barb, which by convention points into the wind.
 *
 * The trap is that the two feeds we consume do not agree with each other:
 *
 * | Open-Meteo field | Reports | `convention` |
 * |---|---|---|
 * | `wind_direction_10m` | the direction the wind blows **FROM** | `"from"` |
 * | `wave_direction`, `swell_wave_direction` | the direction the waves travel **TOWARDS** | `"towards"` |
 *
 * A southerly wind is `wind_direction_10m: 180` and moves north; waves at
 * `wave_direction: 180` move south. Rendering both with the same rotation is
 * wrong by exactly 180° for one of them, and it is wrong *plausibly* — the
 * arrows still look like a coherent field, they just point at the wrong coast.
 * So the convention is a required field on the spec rather than a default:
 * whoever owns the query knows which of the two they asked for.
 *
 * ## Rotation
 *
 * Bearings are clockwise from true north. Screen north is up and CSS
 * `rotate()` turns clockwise, so a glyph drawn pointing up needs
 * `rotate(bearing)` to point along that bearing — no trigonometry and no
 * projection. Leaflet paints its tiles in Web Mercator, but that stays inside
 * Leaflet; nothing here converts a coordinate.
 */

import type { Coordinates, RiskLevel } from "@/shared/types/weather";

/** Which end of the flow the reported degrees describe. Never defaulted. */
export type DirectionConvention = "from" | "towards";

/** One reading in a field. WGS 84, `latitude, longitude`, like everything else. */
export interface DirectionSample extends Coordinates {
  /** Bearing in degrees, clockwise from true north. Read per `convention`. */
  directionDegrees: number;
  /** Speed or height — whatever `DirectionFieldSpec.unit` names. */
  magnitude: number;
  /** Optional extra line for the arrow's tooltip, e.g. a timestamp. */
  label?: string;
}

/**
 * A whole field, ready to draw. The feature that owns the query builds this and
 * hands it down — `shared` never fetches one, because a component here that
 * knew about wind or waves would know about a feature.
 */
export interface DirectionFieldSpec {
  /** Stable across renders; used as the layer key. */
  id: string;
  /** Shown on the toggle and in the legend, e.g. "Wind". */
  name: string;
  /** Unit of `magnitude`, e.g. "km/h", "m". Display only. */
  unit: string;
  convention: DirectionConvention;
  samples: DirectionSample[];
  /**
   * Magnitude at which the ramp saturates. Left out, the field scales itself to
   * its own largest reading, which makes a calm hour look as dramatic as a
   * gale — pass a fixed value when readings should be comparable over time.
   */
  scaleMax?: number;
}

/** Steps in the magnitude ramp. */
export const ARROW_BIN_COUNT = 4;

/**
 * Which `theme.vars.palette.risk` tone each step borrows.
 *
 * The risk palette is a calibrated four-step green-to-red ramp and this is the
 * same ramp, so a second set of hexes in a component would only drift from it.
 * The legend labels the steps with their *value ranges*, never with the risk
 * words — how much wind is dangerous is a per-persona judgement that lives in
 * each feature's `lib/advice.ts`, and a shared map is not entitled to make it.
 */
export const ARROW_RAMP: readonly RiskLevel[] = [
  "low",
  "moderate",
  "high",
  "severe",
] as const;

/** Index into `ARROW_RAMP`. */
export type ArrowBin = 0 | 1 | 2 | 3;

const ARROW_MIN_PX = 18;
const ARROW_MAX_PX = 36;

/**
 * Fold any angle into `[0, 360)`.
 *
 * In-range values come back bit-for-bit — the `(x + 360) % 360` shorthand
 * costs an ulp on values like 359.9, and the rounding shows up as an arrow one
 * hair off north. Returns `NaN` for a non-finite input rather than pretending
 * it is north; `isRenderableSample` is what drops those.
 */
export function normalizeDegrees(degrees: number): number {
  if (!Number.isFinite(degrees)) return Number.NaN;
  const wrapped = degrees % 360;
  if (wrapped < 0) return wrapped + 360;
  // `-0 % 360` is `-0`, and `Object.is(-0, 0)` is false — enough to fail an
  // equality check downstream for an angle that is plainly north.
  return wrapped === 0 ? 0 : wrapped;
}

/**
 * The CSS rotation for a glyph drawn pointing north, in `[0, 360)`.
 *
 * `"towards"` is the identity: the reading already names where the flow is
 * going. `"from"` is the reading plus 180°, because the wind arrives from there
 * and leaves the other way.
 */
export function arrowRotationDegrees(
  directionDegrees: number,
  convention: DirectionConvention,
): number {
  const heading =
    convention === "from" ? directionDegrees + 180 : directionDegrees;
  return normalizeDegrees(heading);
}

/**
 * Which ramp step a magnitude lands on. Out-of-range and non-finite values
 * clamp to the ends — a missing reading draws as the calmest arrow, never as
 * an `undefined` colour.
 */
export function magnitudeBin(magnitude: number, scaleMax: number): ArrowBin {
  if (
    !Number.isFinite(magnitude) ||
    !Number.isFinite(scaleMax) ||
    scaleMax <= 0
  ) {
    return 0;
  }
  const step = Math.floor((magnitude / scaleMax) * ARROW_BIN_COUNT);
  return Math.min(ARROW_BIN_COUNT - 1, Math.max(0, step)) as ArrowBin;
}

/** Glyph size in px, growing with magnitude so the field reads without colour. */
export function arrowSizePx(magnitude: number, scaleMax: number): number {
  if (
    !Number.isFinite(magnitude) ||
    !Number.isFinite(scaleMax) ||
    scaleMax <= 0
  ) {
    return ARROW_MIN_PX;
  }
  const fraction = Math.min(1, Math.max(0, magnitude / scaleMax));
  return Math.round(ARROW_MIN_PX + (ARROW_MAX_PX - ARROW_MIN_PX) * fraction);
}

/** A sample worth drawing: finite position, finite bearing, finite magnitude. */
export function isRenderableSample(sample: DirectionSample): boolean {
  return (
    Number.isFinite(sample.latitude) &&
    Number.isFinite(sample.longitude) &&
    Number.isFinite(sample.directionDegrees) &&
    Number.isFinite(sample.magnitude)
  );
}

/** The magnitude to scale against — the override when it is usable. */
export function resolveScaleMax(
  samples: readonly DirectionSample[],
  override?: number,
): number {
  if (override !== undefined && Number.isFinite(override) && override > 0) {
    return override;
  }
  const largest = samples.reduce(
    (max, sample) =>
      Number.isFinite(sample.magnitude) ? Math.max(max, sample.magnitude) : max,
    0,
  );
  return largest > 0 ? largest : 1;
}

export interface ArrowBinRange {
  bin: ArrowBin;
  /** Inclusive lower bound. */
  min: number;
  /** Exclusive upper bound; `null` on the top step, which is open-ended. */
  max: number | null;
  /** Ready to render, e.g. `"10–20"` or `"≥ 30"`. */
  label: string;
}

/** One entry per ramp step, for the legend. */
export function binRanges(scaleMax: number): ArrowBinRange[] {
  const safeMax = Number.isFinite(scaleMax) && scaleMax > 0 ? scaleMax : 1;
  const width = safeMax / ARROW_BIN_COUNT;

  return Array.from({ length: ARROW_BIN_COUNT }, (_, index) => {
    const bin = index as ArrowBin;
    const min = width * index;
    const isTop = index === ARROW_BIN_COUNT - 1;
    const max = isTop ? null : width * (index + 1);

    return {
      bin,
      min,
      max,
      label: isTop
        ? `≥ ${formatBound(min)}`
        : `${formatBound(min)}–${formatBound(max as number)}`,
    };
  });
}

/** Bounds are labels, not readings: whole numbers once they are big enough. */
function formatBound(value: number): string {
  if (value >= 10) return String(Math.round(value));
  return String(Math.round(value * 10) / 10);
}

export interface ArrowIconOptions {
  /** Already through `arrowRotationDegrees` — this function does not convert. */
  rotationDegrees: number;
  sizePx: number;
  /** Any CSS colour. `var(--mui-palette-risk-high-main)` resolves in place. */
  color: string;
  /** The arrow's accessible name and its `title` tooltip. */
  title: string;
}

/**
 * The glyph, as a string for a Leaflet `DivIcon`.
 *
 * A dart pointing north at rotation 0, turned with a CSS transform — no plugin,
 * no rotated-marker dependency, and it stays crisp at any angle. Inline SVG
 * rather than an image URL so it draws with the network off, which is the point
 * of a PWA that caches its forecasts.
 */
export function arrowIconHtml({
  rotationDegrees,
  sizePx,
  color,
  title,
}: ArrowIconOptions): string {
  const rotation = Number.isFinite(rotationDegrees) ? rotationDegrees : 0;
  const size = Math.max(1, Math.round(sizePx));
  const safeTitle = escapeHtml(title);

  return [
    `<span role="img" aria-label="${safeTitle}" title="${safeTitle}"`,
    ` style="display:block;width:${size}px;height:${size}px;`,
    `transform:rotate(${rotation}deg);transform-origin:50% 50%;">`,
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" focusable="false">`,
    `<path d="M12 1.6 19.6 21.8 12 17.2 4.4 21.8Z" fill="${escapeHtml(color)}"`,
    ` stroke="rgba(0,0,0,0.45)" stroke-width="1.1" stroke-linejoin="round"/>`,
    `</svg></span>`,
  ].join("");
}

/** Sample labels come from a feed; they are never interpolated raw. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The arrow's accessible name: the bearing as reported, the magnitude, and
 * which way it is actually going. A screen-reader user gets the convention
 * spelled out, because they cannot see that the arrow disagrees with the number.
 */
export function describeSample(
  sample: DirectionSample,
  field: Pick<DirectionFieldSpec, "name" | "unit" | "convention">,
): string {
  const bearing = Math.round(normalizeDegrees(sample.directionDegrees));
  const heading = Math.round(
    arrowRotationDegrees(sample.directionDegrees, field.convention),
  );
  const magnitude = Math.round(sample.magnitude * 10) / 10;
  const sense =
    field.convention === "from"
      ? `from ${bearing}°, running towards ${heading}°`
      : `towards ${bearing}°`;

  return `${field.name} ${magnitude} ${field.unit} ${sense}`;
}
