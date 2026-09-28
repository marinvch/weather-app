import { StrictMode, type ReactElement } from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppTheme from "@/shared/theme/AppTheme";
import type { DirectionFieldSpec } from "@/shared/lib/arrowField";
import { isValidCoordinates } from "@/shared/lib/geo";
import type { Coordinates } from "@/shared/types/weather";
import { WeatherMap, type MapPin } from "./WeatherMap";

const BURGAS = { latitude: 42.4619, longitude: 27.4039 };

function renderMap(ui: ReactElement) {
  // StrictMode on purpose: React 19 double-invokes effects, and a Leaflet map
  // built in one throws "Map container is already initialized" on the second
  // run unless the cleanup really removes it.
  return render(
    <StrictMode>
      <AppTheme>{ui}</AppTheme>
    </StrictMode>,
  );
}

const WIND: DirectionFieldSpec = {
  id: "wind",
  name: "Wind",
  unit: "km/h",
  convention: "from",
  samples: [
    { latitude: 42.4, longitude: 27.4, directionDegrees: 220, magnitude: 34 },
    { latitude: 42.5, longitude: 27.5, directionDegrees: 40, magnitude: 8 },
  ],
  scaleMax: 40,
};

const WAVES: DirectionFieldSpec = {
  id: "waves",
  name: "Waves",
  unit: "m",
  convention: "towards",
  samples: [
    { latitude: 42.4, longitude: 27.6, directionDegrees: 220, magnitude: 2.1 },
  ],
  scaleMax: 4,
};

describe("WeatherMap", () => {
  it("mounts and unmounts under StrictMode without re-initialising", () => {
    const { unmount } = renderMap(
      <WeatherMap coordinates={BURGAS} locationName="Burgas" />,
    );

    expect(document.querySelector(".leaflet-container")).not.toBeNull();
    expect(() => unmount()).not.toThrow();
  });

  it("shows the place name and the coordinates in the app's one format", () => {
    renderMap(<WeatherMap coordinates={BURGAS} locationName="Burgas" />);

    expect(screen.getAllByText("Burgas").length).toBeGreaterThan(0);
    expect(screen.getByText("42.4619, 27.4039")).toBeInTheDocument();
  });

  it("offers the base layers and both keyless overlays", () => {
    renderMap(<WeatherMap coordinates={BURGAS} locationName="Burgas" />);

    expect(screen.getByRole("button", { name: "Map" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Satellite" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terrain" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sea marks" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rain radar" })).toBeInTheDocument();
  });

  it("credits every layer it draws", () => {
    // The licences require it. Attribution is rendered by Leaflet's own
    // control, which the theme styles but never hides.
    renderMap(
      <WeatherMap
        coordinates={BURGAS}
        locationName="Burgas"
        defaultOverlays={["seamarks"]}
      />,
    );

    const attribution = document.querySelector(".leaflet-control-attribution");
    expect(attribution?.textContent).toMatch(/OpenStreetMap/);
    expect(attribution?.textContent).toMatch(/OpenSeaMap/);
  });

  it("switches on only the overlays it is told to, from those it offers", () => {
    renderMap(
      <WeatherMap
        coordinates={BURGAS}
        locationName="Burgas"
        overlays={["seamarks"]}
        defaultOverlays={["seamarks", "radar"]}
      />,
    );

    expect(screen.getByRole("button", { name: "Sea marks" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // "radar" was asked for but is not on offer, so it must not turn itself on.
    expect(
      screen.queryByRole("button", { name: "Rain radar" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Radar frame")).not.toBeInTheDocument();
  });

  it("does not touch the network just to render", () => {
    // The setup file stubs fetch to throw. Rendering must not reach RainViewer
    // or Nominatim; the radar index is fetched only once the overlay is on.
    expect(() =>
      renderMap(<WeatherMap coordinates={BURGAS} locationName="Burgas" />),
    ).not.toThrow();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("survives the radar index being unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    renderMap(
      <WeatherMap
        coordinates={BURGAS}
        locationName="Burgas"
        defaultOverlays={["radar"]}
      />,
    );

    expect(
      await screen.findByText(/Radar frames are unavailable/),
    ).toBeInTheDocument();
    // The map itself is untouched by the failure.
    expect(document.querySelector(".leaflet-container")).not.toBeNull();
  });

  it("draws a marker per pin and a popup for each", async () => {
    const pins: MapPin[] = [
      {
        id: "varna",
        coordinates: { latitude: 43.2141, longitude: 27.9147 },
        label: "Varna",
        detail: "Favourite",
      },
      {
        id: "sozopol",
        coordinates: { latitude: 42.4183, longitude: 27.6956 },
        label: "Sozopol",
        popup: <span>Sea state: slight</span>,
        tone: "moderate",
      },
    ];

    renderMap(
      <WeatherMap coordinates={BURGAS} locationName="Burgas" pins={pins} />,
    );

    // The active location plus the two pins.
    expect(screen.getByLabelText("Burgas")).toBeInTheDocument();
    expect(screen.getByLabelText("Varna")).toBeInTheDocument();
    expect(screen.getByLabelText("Sozopol")).toBeInTheDocument();

    // Popup content is real React, rendered through a portal into the div
    // Leaflet owns — not a string of HTML the map had to know how to build.
    // The host div is detached until the popup opens, which is why this has to
    // click the marker rather than search the document from the start.
    fireEvent.click(screen.getByLabelText("Sozopol"));
    expect(await screen.findByText("Sea state: slight")).toBeInTheDocument();
  });

  it("reports a clicked coordinate without waiting on a geocoder", () => {
    const onCoordinateSelect = vi.fn();
    renderMap(
      <WeatherMap
        coordinates={BURGAS}
        locationName="Burgas"
        onCoordinateSelect={onCoordinateSelect}
      />,
    );

    expect(
      screen.getByText("Click the map to choose a place"),
    ).toBeInTheDocument();

    fireEvent.click(document.querySelector(".leaflet-container") as HTMLElement);

    expect(onCoordinateSelect).toHaveBeenCalledTimes(1);
    const [picked] = onCoordinateSelect.mock.calls[0] as [Coordinates];
    // Whatever the click projected to, it leaves this component in range:
    // a map dragged past the antimeridian hands back longitudes Open-Meteo
    // rejects, and normalizeCoordinates is what stops them travelling.
    expect(isValidCoordinates(picked)).toBe(true);
    // Synchronous, and no geocoder was consulted: the stubbed fetch throws.
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("hides the click hint when no click callback is given", () => {
    renderMap(<WeatherMap coordinates={BURGAS} locationName="Burgas" />);
    expect(
      screen.queryByText("Click the map to choose a place"),
    ).not.toBeInTheDocument();
  });

  it("renders an arrow field and says which way its arrows point", async () => {
    const user = userEvent.setup();
    renderMap(
      <WeatherMap
        coordinates={BURGAS}
        locationName="Burgas"
        directionFields={[WIND, WAVES]}
        defaultDirectionFieldId="wind"
      />,
    );

    // A wind reported "from 220" blows towards 40 — the arrow is rotated to
    // where it is going, and the accessible name states both numbers.
    const arrow = screen.getByLabelText(
      "Wind 34 km/h from 220°, running towards 40°",
    );
    expect(arrow.getAttribute("style")).toContain("rotate(40deg)");

    const legend = screen.getByRole("figure", { name: /Wind legend/ });
    expect(
      within(legend).getByText(/arrows point the way it is going/i),
    ).toBeInTheDocument();

    // The same bearing under the other convention must not be drawn the same
    // way: waves at 220 travel towards 220.
    await user.click(screen.getByRole("button", { name: "Waves" }));
    const wave = await screen.findByLabelText("Waves 2.1 m towards 220°");
    expect(wave.getAttribute("style")).toContain("rotate(220deg)");
    expect(screen.queryByLabelText(/^Wind \d/)).not.toBeInTheDocument();
  });

  it("takes the arrows away again", async () => {
    const user = userEvent.setup();
    renderMap(
      <WeatherMap
        coordinates={BURGAS}
        locationName="Burgas"
        directionFields={[WIND]}
        defaultDirectionFieldId="wind"
      />,
    );

    expect(screen.getAllByLabelText(/^Wind \d/)).toHaveLength(WIND.samples.length);
    await user.click(screen.getByRole("button", { name: "No arrows" }));
    expect(screen.queryByLabelText(/^Wind \d/)).not.toBeInTheDocument();
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });

  it("shows no arrow controls when no field is supplied", () => {
    renderMap(<WeatherMap coordinates={BURGAS} locationName="Burgas" />);
    expect(
      screen.queryByRole("button", { name: "No arrows" }),
    ).not.toBeInTheDocument();
  });

  it("gives the map container an explicit height", () => {
    // A Leaflet map with no height renders blank, which reads as a data bug
    // rather than a layout one.
    renderMap(
      <WeatherMap coordinates={BURGAS} locationName="Burgas" height={300} />,
    );
    const container = document.querySelector(".leaflet-container")
      ?.parentElement as HTMLElement;
    expect(container).not.toBeNull();
  });
});
