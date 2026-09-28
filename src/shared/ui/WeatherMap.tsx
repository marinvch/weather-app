/**
 * The map: the app's primary interactive surface, not a detail view.
 *
 * It is on the page by default rather than behind a "Show map" button, and it
 * carries four things at once — a base map, optional keyless overlays (sea
 * marks, rain radar), the pins a caller drops on it, and an arrow field for a
 * direction-and-magnitude reading like wind or waves.
 *
 * ## What it does not know
 *
 * Nothing here fetches weather and nothing here knows what a profile is.
 * Pins arrive as data with optional `ReactNode` popups, and an arrow field
 * arrives as `DirectionFieldSpec` from whichever feature owns the query. That
 * is deliberate: a map in `shared` that fetched wave heights would be a map
 * that knows about `features/marine`, which is the one dependency direction the
 * architecture forbids. The single exception is the reverse-geocode behind
 * `onLocationSelect`, which predates this rewrite and is part of the existing
 * prop contract.
 *
 * ## Coordinates
 *
 * WGS 84, `latitude, longitude`, in and out — the same as everything else in
 * the app. Leaflet's `LatLng` is already WGS 84, so no value is ever converted;
 * its Web Mercator tile grid is internal to Leaflet and never reaches a number
 * we hold. Everything Leaflet hands back (a click, a drag past the
 * antimeridian) goes through `normalizeCoordinates` at that boundary.
 *
 * ## Attribution
 *
 * OSM, Esri, OpenTopoMap, OpenSeaMap and RainViewer all require credit, and
 * each layer carries its own string into Leaflet's attribution control. It is
 * styled to stay legible in both colour schemes; it is not hidden.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme, type Theme } from "@mui/material/styles";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import {
  ARROW_RAMP,
  arrowIconHtml,
  arrowRotationDegrees,
  arrowSizePx,
  describeSample,
  isRenderableSample,
  magnitudeBin,
  resolveScaleMax,
  type DirectionFieldSpec,
} from "@/shared/lib/arrowField";
import {
  formatCoordinates,
  normalizeCoordinates,
  sameCoordinates,
} from "@/shared/lib/geo";
import {
  BASE_LAYERS,
  DEFAULT_BASE_LAYER_ID,
  RAINVIEWER_ATTRIBUTION,
  SEAMARK_LAYER,
  fetchRadarFrames,
  frameClock,
  frameOffsetLabel,
  type RadarFrame,
} from "@/shared/lib/mapTiles";
import type { Coordinates, RiskLevel } from "@/shared/types/weather";
import { DirectionFieldLegend } from "@/shared/ui/DirectionFieldLegend";

/**
 * A pin's colour role. `RiskLevel` is included so a caller can drop a pin that
 * carries a severity it has already decided — the map never decides one.
 */
export type MapPinTone = "primary" | "neutral" | RiskLevel;

/** A marker a caller drops on the map: a favourite, a search hit, a station. */
export interface MapPin {
  /** Stable across renders — it keys the marker and its popup portal. */
  id: string;
  coordinates: Coordinates;
  /** The pin's accessible name and its popup heading. */
  label: string;
  /** One line under the heading. Ignored when `popup` is given. */
  detail?: string;
  /**
   * Arbitrary popup content, rendered through a portal so it is real React —
   * hooks, theme, click handlers all work. The map does not render weather
   * itself; this is how a caller puts its own readout on a pin.
   */
  popup?: ReactNode;
  tone?: MapPinTone;
}

/** The optional overlays this map can offer. Both are keyless. */
export type MapOverlayId = "seamarks" | "radar";

const ALL_OVERLAYS: readonly MapOverlayId[] = ["seamarks", "radar"];

const OVERLAY_LABEL: Record<MapOverlayId, string> = {
  seamarks: "Sea marks",
  radar: "Rain radar",
};

export interface WeatherMapProps {
  /** The active location. Centres the map and gets the primary pin. */
  coordinates: Coordinates;
  /** Display-only; the map never geocodes it. */
  locationName: string;
  /**
   * Fired on a map click with a reverse-geocoded name. Unchanged from before
   * this component was reworked — the name falls back to `formatCoordinates`
   * when Nominatim has nothing or is unreachable.
   */
  onLocationSelect?: (coordinates: Coordinates, name: string) => void;
  className?: string;
  /**
   * Fired on a map click with the coordinate alone, before any network call.
   * This is the one to use for "check the weather here": it is synchronous and
   * it cannot fail.
   */
  onCoordinateSelect?: (coordinates: Coordinates) => void;
  title?: string;
  /** Explicit, always — a Leaflet map with no height renders blank. */
  height?: number | string;
  zoom?: number;
  /** Extra markers, each with its own popup content. */
  pins?: readonly MapPin[];
  /** Which overlays the layer control offers. Defaults to both. */
  overlays?: readonly MapOverlayId[];
  /** Which of them start switched on. Uncontrolled after mount. */
  defaultOverlays?: readonly MapOverlayId[];
  /**
   * Arrow fields the viewer can switch between — wind, waves, swell. The
   * feature owns the query and the meteorological convention; see
   * `@/shared/lib/arrowField`.
   */
  directionFields?: readonly DirectionFieldSpec[];
  /** Which field starts selected. Omitted, the map opens with none. */
  defaultDirectionFieldId?: string;
  /** Rendered under the map, above the attribution note. */
  footer?: ReactNode;
}

// ---------------------------------------------------------------------------
// Marker glyphs
// ---------------------------------------------------------------------------

/**
 * Inline SVG rather than the CDN PNGs Leaflet defaults to.
 *
 * The previous version patched `L.Icon.Default` to point at a cdnjs URL, which
 * meant markers vanished whenever the app ran from its service-worker cache —
 * on a PWA whose whole point is working offline. Drawing them makes them free,
 * and lets them take a theme colour.
 */
function pinIconHtml(color: string, sizePx: number, label: string): string {
  const safe = label
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  return [
    `<span role="img" aria-label="${safe}" style="display:block;width:${sizePx}px;height:${sizePx}px;">`,
    `<svg viewBox="0 0 24 32" width="${sizePx}" height="${sizePx}" aria-hidden="true" focusable="false">`,
    `<path d="M12 0.8C6.2 0.8 1.6 5.4 1.6 11.2c0 7.6 10.4 20 10.4 20s10.4-12.4 10.4-20C22.4 5.4 17.8 0.8 12 0.8Z"`,
    ` fill="${color}" stroke="rgba(0,0,0,0.45)" stroke-width="1.2"/>`,
    `<circle cx="12" cy="11" r="4.2" fill="#FFFFFF" fill-opacity="0.92"/>`,
    `</svg></span>`,
  ].join("");
}

function pinIcon(color: string, sizePx: number, label: string): L.DivIcon {
  return L.divIcon({
    html: pinIconHtml(color, sizePx, label),
    // Leaflet's own class draws a white box behind the glyph.
    className: "",
    iconSize: [sizePx, sizePx],
    // The tip of the teardrop is the point, not its centre.
    iconAnchor: [sizePx / 2, sizePx],
    popupAnchor: [0, -sizePx + 6],
  });
}

function toneColor(theme: Theme, tone: MapPinTone): string {
  if (tone === "primary") return theme.vars.palette.primary.main;
  if (tone === "neutral") return theme.vars.palette.text.secondary;
  return theme.vars.palette.risk[tone].main;
}

// ---------------------------------------------------------------------------
// Reverse geocoding for onLocationSelect
// ---------------------------------------------------------------------------

/**
 * Nominatim, called with no custom headers on purpose: a `User-Agent` here
 * makes the request non-simple, which triggers a CORS preflight Nominatim
 * rejects — every map click then fell through to the raw-coordinate fallback.
 * See `features/location/lib/geolocation.ts`, which learned this first.
 */
async function reverseGeocode(point: Coordinates): Promise<string> {
  const fallback = formatCoordinates(point);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${point.latitude}&lon=${point.longitude}&zoom=14&addressdetails=1&accept-language=en`,
    );
    if (!response.ok) return fallback;

    const data = await response.json();
    const address = data?.address ?? {};
    const city =
      address.village ??
      address.town ??
      address.city ??
      address.municipality ??
      address.hamlet;
    const region = address.state ?? address.county ?? address.province;
    const country = address.country;

    if (city && country) {
      return region ? `${city}, ${region}, ${country}` : `${city}, ${country}`;
    }
    return data?.display_name ?? fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// The component
// ---------------------------------------------------------------------------

const RADAR_FRAME_MS = 600;

export function WeatherMap({
  coordinates,
  locationName,
  onLocationSelect,
  className,
  onCoordinateSelect,
  title = "Weather map",
  height = 420,
  zoom = 8,
  pins,
  overlays = ALL_OVERLAYS,
  defaultOverlays,
  directionFields,
  defaultDirectionFieldId,
  footer,
}: WeatherMapProps) {
  const theme = useTheme();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const [baseLayerId, setBaseLayerId] = useState(DEFAULT_BASE_LAYER_ID);
  const [activeOverlays, setActiveOverlays] = useState<MapOverlayId[]>(() =>
    (defaultOverlays ?? []).filter((id) => overlays.includes(id)),
  );
  const [fieldId, setFieldId] = useState<string | null>(
    defaultDirectionFieldId ?? null,
  );

  const [radarFrames, setRadarFrames] = useState<RadarFrame[]>([]);
  const [radarLoaded, setRadarLoaded] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const radarOn = activeOverlays.includes("radar");
  const seamarksOn = activeOverlays.includes("seamarks");

  const activeField = useMemo(
    () => directionFields?.find((field) => field.id === fieldId) ?? null,
    [directionFields, fieldId],
  );

  // Callbacks live in refs so the map is built once. Dashboards pass inline
  // arrow functions, and a click handler in the init effect's dependency list
  // tore the whole map down and rebuilt it on every render of the parent.
  const onLocationSelectRef = useRef(onLocationSelect);
  const onCoordinateSelectRef = useRef(onCoordinateSelect);
  onLocationSelectRef.current = onLocationSelect;
  onCoordinateSelectRef.current = onCoordinateSelect;

  const initialViewRef = useRef({ coordinates, zoom, reducedMotion });

  // Popup hosts are detached divs that React portals into and Leaflet owns.
  // Keyed by pin id so a re-render with the same pins reuses them rather than
  // remounting the popup content and losing its state.
  const popupHostsRef = useRef(new Map<string, HTMLDivElement>());
  const popupHost = useCallback((id: string) => {
    let host = popupHostsRef.current.get(id);
    if (!host) {
      host = document.createElement("div");
      popupHostsRef.current.set(id, host);
    }
    return host;
  }, []);

  // -- 1. Create the map exactly once -------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const { coordinates: start, zoom: startZoom, reducedMotion: still } =
      initialViewRef.current;

    const map = L.map(container, {
      center: [start.latitude, start.longitude],
      zoom: startZoom,
      zoomControl: true,
      doubleClickZoom: true,
      // The map now sits inline in a scrolling page, so a wheel over it must
      // not swallow the page scroll. It is enabled once the viewer has clicked
      // into the map and disabled again when the pointer leaves.
      scrollWheelZoom: false,
      fadeAnimation: !still,
      zoomAnimation: !still,
      markerZoomAnimation: !still,
    });

    map.on("click", (event: L.LeafletMouseEvent) => {
      // Leaflet is WGS 84 like everything else, but a map dragged past the
      // antimeridian reports longitudes outside ±180, which both Nominatim and
      // Open-Meteo reject. Wrap at the boundary, once.
      const picked = normalizeCoordinates({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });

      map.scrollWheelZoom.enable();
      onCoordinateSelectRef.current?.(picked);

      const report = onLocationSelectRef.current;
      if (report) {
        void reverseGeocode(picked).then((name) => report(picked, name));
      }
    });
    map.on("mouseout", () => map.scrollWheelZoom.disable());

    mapRef.current = map;
    setMapReady(true);

    // The map is about to be rendered on the page rather than in a toggled
    // panel, so it can be laid out at one size and shown at another — a tab, a
    // drawer, a column that reflows. Leaflet caches the container size, and a
    // stale one draws a quarter map, which reads as a data bug.
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => map.invalidateSize());
      observer.observe(container);
    }

    return () => {
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // Empty on purpose: React 19's StrictMode double-invokes this, and the
    // cleanup's map.remove() is what makes the second run succeed instead of
    // throwing "Map container is already initialized".
  }, []);

  // -- 2. Base layer -------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const source =
      BASE_LAYERS.find((layer) => layer.id === baseLayerId) ?? BASE_LAYERS[0];
    const layer = L.tileLayer(source.urlTemplate, {
      attribution: source.attribution,
      maxZoom: source.maxZoom,
    }).addTo(map);

    return () => {
      layer.remove();
    };
  }, [mapReady, baseLayerId]);

  // -- 3. Sea marks --------------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !seamarksOn) return;

    const layer = L.tileLayer(SEAMARK_LAYER.urlTemplate, {
      attribution: SEAMARK_LAYER.attribution,
      maxZoom: SEAMARK_LAYER.maxZoom,
      opacity: SEAMARK_LAYER.opacity,
      // Above the base map, below markers.
      pane: "overlayPane",
    }).addTo(map);

    return () => {
      layer.remove();
    };
  }, [mapReady, seamarksOn]);

  // -- 4. Radar frames -----------------------------------------------------
  // Fetched only when the overlay is first switched on: the map must not touch
  // the network just to render, and RainViewer is an extra that is allowed to
  // be unavailable.
  useEffect(() => {
    if (!radarOn || radarLoaded) return;

    const controller = new AbortController();
    let live = true;

    void fetchRadarFrames(controller.signal).then((frames) => {
      if (!live) return;
      setRadarFrames(frames);
      setRadarLoaded(true);
      // Open on the most recent observation rather than the oldest, which is
      // what "the radar" means to someone who just switched it on. Written as
      // a loop because `findLastIndex` is ES2023 and this project's lib is
      // ES2022.
      let newest = -1;
      frames.forEach((frame, index) => {
        if (frame.kind === "past") newest = index;
      });
      setFrameIndex(newest >= 0 ? newest : Math.max(0, frames.length - 1));
    });

    return () => {
      live = false;
      controller.abort();
    };
  }, [radarOn, radarLoaded]);

  const currentFrame: RadarFrame | undefined = radarFrames[frameIndex];

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !radarOn || !currentFrame) return;

    const layer = L.tileLayer(currentFrame.urlTemplate, {
      attribution: RAINVIEWER_ATTRIBUTION,
      opacity: 0.65,
      maxZoom: 19,
      // Radar is coarse. `maxNativeZoom` makes Leaflet upsample the last real
      // level instead of requesting tiles RainViewer does not cut, which would
      // blank the overlay the moment someone zoomed into a harbour.
      maxNativeZoom: 10,
      pane: "overlayPane",
    }).addTo(map);

    return () => {
      layer.remove();
    };
  }, [mapReady, radarOn, currentFrame]);

  // Playback. Never starts by itself, and stops entirely under reduced motion.
  useEffect(() => {
    if (!playing || radarFrames.length < 2 || reducedMotion) return;

    const timer = window.setInterval(() => {
      setFrameIndex((index) => (index + 1) % radarFrames.length);
    }, RADAR_FRAME_MS);

    return () => window.clearInterval(timer);
  }, [playing, radarFrames.length, reducedMotion]);

  // -- 5. The primary marker, and following the active location ------------
  const lastCentredRef = useRef<Coordinates | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const point = normalizeCoordinates(coordinates);
    const latLng = new L.LatLng(point.latitude, point.longitude);

    // Only recentre when the location genuinely moved. Recentring on every
    // render throws away a pan the viewer just made.
    if (
      !lastCentredRef.current ||
      !sameCoordinates(lastCentredRef.current, point)
    ) {
      map.setView(latLng, map.getZoom());
      lastCentredRef.current = point;
    }

    const marker = L.marker(latLng, {
      icon: pinIcon(toneColor(theme, "primary"), 34, locationName),
      title: locationName,
      zIndexOffset: 1000,
    })
      .bindPopup(
        `<strong>${locationName.replace(/</g, "&lt;")}</strong><br/>${formatCoordinates(point)}`,
      )
      .addTo(map);

    return () => {
      marker.remove();
    };
  }, [mapReady, coordinates, locationName, theme]);

  // -- 6. Caller-supplied pins --------------------------------------------
  //
  // Keyed by what the markers are actually made of, not by array identity. A
  // dashboard builds its pins inline, so a fresh array arrives on every RTK
  // Query poll; re-adding the markers each time would slam shut whatever popup
  // the viewer had open. Popup *content* is unaffected — it lives in a portal
  // and re-renders on its own.
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const pinSignature = (pins ?? [])
    .map((pin) =>
      [
        pin.id,
        pin.coordinates.latitude,
        pin.coordinates.longitude,
        pin.tone ?? "",
        pin.label,
        pin.detail ?? "",
        pin.popup ? "node" : "",
      ].join(":"),
    )
    .join("|");

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const group = L.layerGroup().addTo(map);
    const seen = new Set<string>();

    (pinsRef.current ?? []).forEach((pin) => {
      seen.add(pin.id);
      const point = normalizeCoordinates(pin.coordinates);
      const marker = L.marker([point.latitude, point.longitude], {
        icon: pinIcon(toneColor(theme, pin.tone ?? "neutral"), 26, pin.label),
        title: pin.label,
      });

      if (pin.popup) {
        marker.bindPopup(popupHost(pin.id));
      } else {
        const detail = pin.detail ? `<br/>${pin.detail.replace(/</g, "&lt;")}` : "";
        marker.bindPopup(
          `<strong>${pin.label.replace(/</g, "&lt;")}</strong>${detail}<br/>${formatCoordinates(point)}`,
        );
      }

      marker.addTo(group);
    });

    // Drop hosts for pins that are gone, so a long-lived map does not hoard
    // detached DOM for every place the viewer has ever looked at.
    popupHostsRef.current.forEach((_, id) => {
      if (!seen.has(id)) popupHostsRef.current.delete(id);
    });

    return () => {
      group.remove();
    };
    // `pins` is deliberately absent: it is read through pinsRef and tracked by
    // pinSignature, which changes only when a marker's own values change.
  }, [mapReady, pinSignature, theme, popupHost]);

  // -- 7. The arrow field --------------------------------------------------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !activeField) return;

    const field = activeField;
    const scaleMax = resolveScaleMax(field.samples, field.scaleMax);
    const group = L.layerGroup().addTo(map);

    field.samples.filter(isRenderableSample).forEach((sample) => {
      const point = normalizeCoordinates(sample);
      const size = arrowSizePx(sample.magnitude, scaleMax);
      const description = describeSample(sample, field);
      const icon = L.divIcon({
        html: arrowIconHtml({
          rotationDegrees: arrowRotationDegrees(
            sample.directionDegrees,
            field.convention,
          ),
          sizePx: size,
          color:
            theme.vars.palette.risk[
              ARROW_RAMP[magnitudeBin(sample.magnitude, scaleMax)]
            ].main,
          title: description,
        }),
        className: "",
        iconSize: [size, size],
        // Centred, not tipped: an arrow marks the cell it samples, and
        // anchoring it at a corner shifts the whole field half a glyph.
        iconAnchor: [size / 2, size / 2],
      });

      L.marker([point.latitude, point.longitude], {
        icon,
        title: description,
        keyboard: false,
      })
        .bindTooltip(
          sample.label ? `${description} · ${sample.label}` : description,
        )
        .addTo(group);
    });

    return () => {
      group.remove();
    };
  }, [mapReady, activeField, theme]);

  const centreOnLocation = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const point = normalizeCoordinates(coordinates);
    map.setView([point.latitude, point.longitude], Math.max(map.getZoom(), 11));
    lastCentredRef.current = point;
  }, [coordinates]);

  const offeredOverlays = ALL_OVERLAYS.filter((id) => overlays.includes(id));
  const interactive = Boolean(onLocationSelect || onCoordinateSelect);
  const pinsWithPopups = (pins ?? []).filter((pin) => pin.popup);

  return (
    <Card className={className}>
      <CardHeader
        title={title}
        slotProps={{ title: { variant: "h6", component: "h2" } }}
        action={
          <Button
            size="small"
            variant="outlined"
            startIcon={<MyLocationIcon />}
            onClick={centreOnLocation}
          >
            Centre
          </Button>
        }
      />

      <CardContent>
        <Stack spacing={1.5}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: "wrap", rowGap: 1, alignItems: "center" }}
          >
            <ToggleButtonGroup
              size="small"
              exclusive
              value={baseLayerId}
              onChange={(_, next: string | null) => {
                if (next) setBaseLayerId(next);
              }}
              aria-label="Base map"
            >
              {BASE_LAYERS.map((layer) => (
                <ToggleButton key={layer.id} value={layer.id}>
                  {layer.name}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>

            {offeredOverlays.length > 0 && (
              <ToggleButtonGroup
                size="small"
                value={activeOverlays}
                onChange={(_, next: MapOverlayId[]) => setActiveOverlays(next)}
                aria-label="Overlays"
              >
                {offeredOverlays.map((id) => (
                  <ToggleButton key={id} value={id}>
                    {OVERLAY_LABEL[id]}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}

            {directionFields && directionFields.length > 0 && (
              <ToggleButtonGroup
                size="small"
                exclusive
                value={fieldId ?? "none"}
                onChange={(_, next: string | null) => {
                  setFieldId(next === null || next === "none" ? null : next);
                }}
                aria-label="Direction field"
              >
                <ToggleButton value="none">No arrows</ToggleButton>
                {directionFields.map((field) => (
                  <ToggleButton key={field.id} value={field.id}>
                    {field.name}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            )}
          </Stack>

          <Box
            sx={{
              position: "relative",
              height,
              // 360px viewport minus the card's padding still has to show a
              // usable map, and the controls below must not overlap it.
              minHeight: 240,
              width: "100%",
              borderRadius: 2,
              overflow: "hidden",
              border: 1,
              borderColor: "divider",
              // Leaflet ships its own light-only chrome. These pull its
              // controls, popups and — importantly — its attribution into the
              // active colour scheme instead of leaving white boxes in dark.
              "& .leaflet-container": {
                backgroundColor: "background.default",
                fontFamily: "inherit",
              },
              "& .leaflet-bar a, & .leaflet-control-attribution": {
                backgroundColor: "background.paper",
                color: "text.primary",
              },
              "& .leaflet-control-attribution a": { color: "primary.main" },
              "& .leaflet-popup-content-wrapper, & .leaflet-popup-tip": {
                backgroundColor: "background.paper",
                color: "text.primary",
              },
              "& .leaflet-popup-content": { margin: "10px 14px" },
            }}
          >
            <Box
              ref={containerRef}
              role="application"
              aria-label={`Map centred on ${locationName}`}
              sx={{ height: "100%", width: "100%" }}
            />

            {interactive && (
              // zIndex 400 clears Leaflet's own panes, which sit at 200-400.
              <Chip
                size="small"
                label="Click the map to choose a place"
                sx={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  zIndex: 400,
                  backgroundColor: "background.paper",
                }}
              />
            )}

            <Box sx={{ position: "absolute", bottom: 28, right: 12, zIndex: 400 }}>
              <Button
                size="small"
                variant="contained"
                startIcon={<MyLocationIcon />}
                onClick={centreOnLocation}
              >
                My location
              </Button>
            </Box>
          </Box>

          {radarOn && (
            <Stack
              direction="row"
              spacing={1}
              sx={{ alignItems: "center" }}
              aria-label="Radar time"
            >
              {radarFrames.length > 1 ? (
                <>
                  <IconButton
                    size="small"
                    onClick={() => setPlaying((on) => !on)}
                    disabled={reducedMotion}
                    aria-label={playing ? "Pause radar" : "Play radar"}
                  >
                    {playing ? <PauseIcon /> : <PlayArrowIcon />}
                  </IconButton>
                  <Slider
                    size="small"
                    min={0}
                    max={radarFrames.length - 1}
                    step={1}
                    value={frameIndex}
                    onChange={(_, next) => {
                      setPlaying(false);
                      setFrameIndex(next as number);
                    }}
                    aria-label="Radar frame"
                    sx={{ flex: 1, mx: 1 }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", whiteSpace: "nowrap" }}
                  >
                    {currentFrame
                      ? `${frameClock(currentFrame.time)} · ${frameOffsetLabel(currentFrame.time, Date.now())}`
                      : ""}
                  </Typography>
                  {currentFrame?.kind === "forecast" && (
                    <Chip size="small" label="Forecast" />
                  )}
                </>
              ) : (
                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  {radarLoaded
                    ? "Radar frames are unavailable right now."
                    : "Loading radar frames…"}
                </Typography>
              )}
            </Stack>
          )}

          {activeField && <DirectionFieldLegend field={activeField} />}

          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 2 }}>
            <Box sx={{ flex: "1 1 200px" }}>
              <Typography variant="label" sx={{ color: "text.secondary" }}>
                Location
              </Typography>
              <Typography variant="body2">{locationName}</Typography>
            </Box>
            <Box sx={{ flex: "1 1 200px" }}>
              <Typography variant="label" sx={{ color: "text.secondary" }}>
                Coordinates
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                {formatCoordinates(coordinates)}
              </Typography>
            </Box>
          </Stack>

          {footer}
        </Stack>
      </CardContent>

      {/*
        Popup content lives in portals into the detached divs Leaflet holds, so
        a caller's popup is ordinary React — it re-renders with its own data and
        keeps its hooks — instead of a string of HTML the map has to know how to
        build.
      */}
      {pinsWithPopups.map((pin) =>
        createPortal(pin.popup, popupHost(pin.id), pin.id),
      )}
    </Card>
  );
}
