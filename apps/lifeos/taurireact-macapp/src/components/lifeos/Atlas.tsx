import { useEffect, useRef, useState, useMemo, lazy, Suspense } from "react";
import { AppShell } from "./AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  MapPin,
  Plane,
  Grid3X3,
  Tag,
  Route,
  Layers,
  RotateCcw,
} from "lucide-react";

// Lazy load the heavy Globe component
const Globe = lazy(() => import("react-globe.gl"));
import type { GlobeMethods } from "react-globe.gl";

// Types
interface CountryFeature {
  type: string;
  properties: {
    NAME: string;
    ISO_A2: string;
    POP_EST: number;
    [key: string]: unknown;
  };
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
}

interface GeoJsonData {
  type: string;
  features: CountryFeature[];
}

interface CityPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  population?: number;
  type: "visited" | "wishlist" | "home";
}

interface FlightArc {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
  label?: string;
}

interface HexBinPoint {
  lat: number;
  lng: number;
  weight: number;
}

interface PathData {
  id: string;
  coords: [number, number][];
  color: string;
  label: string;
}

// Sample Data
const CITIES: CityPoint[] = [
  { id: "1", name: "San Francisco", lat: 37.7749, lng: -122.4194, population: 884363, type: "home" },
  { id: "2", name: "New York", lat: 40.7128, lng: -74.006, population: 8336817, type: "visited" },
  { id: "3", name: "London", lat: 51.5074, lng: -0.1278, population: 8982000, type: "visited" },
  { id: "4", name: "Tokyo", lat: 35.6762, lng: 139.6503, population: 13960000, type: "visited" },
  { id: "5", name: "Paris", lat: 48.8566, lng: 2.3522, population: 2161000, type: "wishlist" },
  { id: "6", name: "Sydney", lat: -33.8688, lng: 151.2093, population: 5312000, type: "wishlist" },
  { id: "7", name: "Dubai", lat: 25.2048, lng: 55.2708, population: 3331000, type: "visited" },
  { id: "8", name: "Singapore", lat: 1.3521, lng: 103.8198, population: 5454000, type: "visited" },
  { id: "9", name: "Hong Kong", lat: 22.3193, lng: 114.1694, population: 7500000, type: "visited" },
  { id: "10", name: "Los Angeles", lat: 34.0522, lng: -118.2437, population: 3979576, type: "visited" },
  { id: "11", name: "Barcelona", lat: 41.3851, lng: 2.1734, population: 1620000, type: "wishlist" },
  { id: "12", name: "Seoul", lat: 37.5665, lng: 126.978, population: 9776000, type: "visited" },
];

const FLIGHT_ARCS: FlightArc[] = [
  { id: "1", startLat: 37.7749, startLng: -122.4194, endLat: 35.6762, endLng: 139.6503, color: "#ff6b6b", label: "SFO → TYO" },
  { id: "2", startLat: 37.7749, startLng: -122.4194, endLat: 51.5074, endLng: -0.1278, color: "#4ecdc4", label: "SFO → LHR" },
  { id: "3", startLat: 40.7128, startLng: -74.006, endLat: 48.8566, endLng: 2.3522, color: "#45b7d1", label: "NYC → PAR" },
  { id: "4", startLat: 51.5074, startLng: -0.1278, endLat: 25.2048, endLng: 55.2708, color: "#96ceb4", label: "LHR → DXB" },
  { id: "5", startLat: 25.2048, startLng: 55.2708, endLat: 1.3521, endLng: 103.8198, color: "#ffeaa7", label: "DXB → SIN" },
  { id: "6", startLat: 1.3521, startLng: 103.8198, endLat: -33.8688, endLng: 151.2093, color: "#dfe6e9", label: "SIN → SYD" },
  { id: "7", startLat: 35.6762, startLng: 139.6503, endLat: 22.3193, endLng: 114.1694, color: "#fd79a8", label: "TYO → HKG" },
  { id: "8", startLat: 22.3193, startLng: 114.1694, endLat: 37.5665, endLng: 126.978, color: "#a29bfe", label: "HKG → ICN" },
];

// Generate hex bin data (random global distribution for demo)
const HEX_BIN_DATA: HexBinPoint[] = Array.from({ length: 300 }, () => ({
  lat: (Math.random() - 0.5) * 160,
  lng: (Math.random() - 0.5) * 360,
  weight: Math.random() * 10,
}));

// Sample route path (e.g., a road trip)
const PATHS: PathData[] = [
  {
    id: "pacific-coast",
    label: "Pacific Coast Highway",
    color: "#ff6b6b",
    coords: [
      [-122.4194, 37.7749], // San Francisco
      [-122.0308, 36.9741], // Santa Cruz
      [-121.8947, 36.6002], // Monterey
      [-121.8863, 36.2704], // Carmel
      [-120.6596, 35.2828], // San Luis Obispo
      [-119.6982, 34.4208], // Santa Barbara
      [-118.4912, 34.0195], // Santa Monica
      [-118.2437, 34.0522], // Los Angeles
    ],
  },
  {
    id: "europe-trip",
    label: "Europe Trip",
    color: "#4ecdc4",
    coords: [
      [-0.1278, 51.5074], // London
      [2.3522, 48.8566], // Paris
      [2.1734, 41.3851], // Barcelona
      [12.4964, 41.9028], // Rome
      [14.4378, 50.0755], // Prague
      [13.405, 52.52], // Berlin
      [4.9041, 52.3676], // Amsterdam
      [-0.1278, 51.5074], // Back to London
    ],
  },
];

// Layer visibility controls
interface LayerVisibility {
  countries: boolean;
  points: boolean;
  arcs: boolean;
  hexBins: boolean;
  labels: boolean;
  paths: boolean;
}

export function LifeOSAtlas() {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [countries, setCountries] = useState<GeoJsonData>({ type: "FeatureCollection", features: [] });
  const [hoverCountry, setHoverCountry] = useState<CountryFeature | null>(null);
  const [hoverCity, setHoverCity] = useState<CityPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [layers, setLayers] = useState<LayerVisibility>({
    countries: false, // Disable by default - heavy
    points: true,
    arcs: true,
    hexBins: false,
    labels: false, // Disable by default
    paths: false, // Disable by default
  });

  // Fetch country GeoJSON data (only when countries layer is enabled)
  useEffect(() => {
    if (!layers.countries || countries.features.length > 0) return;

    fetch("https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson")
      .then((res) => res.json())
      .then((data: GeoJsonData) => setCountries(data))
      .catch(console.error);
  }, [layers.countries, countries.features.length]);

  // Auto-rotate and initial position
  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 20, lng: 0, altitude: 2.5 });
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.3;
      }
      setIsLoading(false);
    }
  }, []);

  const toggleLayer = (layer: keyof LayerVisibility) => {
    setLayers((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const resetView = () => {
    if (globeRef.current) {
      globeRef.current.pointOfView({ lat: 20, lng: 0, altitude: 2.5 }, 1000);
    }
  };

  // Point color based on type
  const getPointColor = (city: CityPoint) => {
    switch (city.type) {
      case "home": return "#22c55e";
      case "visited": return "#3b82f6";
      case "wishlist": return "#f59e0b";
      default: return "#6b7280";
    }
  };

  // Memoized path data for performance
  const pathsData = useMemo(() =>
    layers.paths ? PATHS.map((p) => ({
      ...p,
      coords: p.coords.map(([lng, lat]) => ({ lat, lng })),
    })) : [],
  [layers.paths]);

  return (
    <AppShell>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="p-6 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-3xl">Atlas</h1>
              <p className="text-muted-foreground">
                Interactive 3D Earth visualization
                {hoverCountry && (
                  <span className="ml-2 text-foreground font-medium">
                    — {hoverCountry.properties.NAME}
                  </span>
                )}
                {hoverCity && (
                  <span className="ml-2 text-foreground font-medium">
                    — {hoverCity.name}
                  </span>
                )}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={resetView}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset View
            </Button>
          </div>
        </div>

        {/* Layer Controls */}
        <div className="px-6 pb-4 flex flex-wrap gap-2">
          <Button
            variant={layers.countries ? "default" : "outline"}
            size="sm"
            onClick={() => toggleLayer("countries")}
          >
            <Layers className="h-4 w-4 mr-2" />
            Countries
          </Button>
          <Button
            variant={layers.points ? "default" : "outline"}
            size="sm"
            onClick={() => toggleLayer("points")}
          >
            <MapPin className="h-4 w-4 mr-2" />
            Markers
          </Button>
          <Button
            variant={layers.arcs ? "default" : "outline"}
            size="sm"
            onClick={() => toggleLayer("arcs")}
          >
            <Plane className="h-4 w-4 mr-2" />
            Flights
          </Button>
          <Button
            variant={layers.paths ? "default" : "outline"}
            size="sm"
            onClick={() => toggleLayer("paths")}
          >
            <Route className="h-4 w-4 mr-2" />
            Routes
          </Button>
          <Button
            variant={layers.labels ? "default" : "outline"}
            size="sm"
            onClick={() => toggleLayer("labels")}
          >
            <Tag className="h-4 w-4 mr-2" />
            Labels
          </Button>
          <Button
            variant={layers.hexBins ? "default" : "outline"}
            size="sm"
            onClick={() => toggleLayer("hexBins")}
          >
            <Grid3X3 className="h-4 w-4 mr-2" />
            Hex Bins
          </Button>

          {/* Legend */}
          <div className="ml-auto flex gap-2 items-center">
            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5" />
              Home
            </Badge>
            <Badge variant="outline" className="bg-blue-500/20 text-blue-400 border-blue-500/30">
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5" />
              Visited
            </Badge>
            <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-amber-500/30">
              <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5" />
              Wishlist
            </Badge>
          </div>
        </div>

        {/* Globe Container */}
        <div className="flex-1 min-h-0 relative">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">Loading 3D Globe...</p>
                </div>
              </div>
            }
          >
          <Globe
            ref={globeRef}
            globeImageUrl="/textures/earth.jpg"
            backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"

            // Country polygons
            polygonsData={layers.countries ? countries.features : []}
            polygonAltitude={0.006}
            polygonCapColor={() => "rgba(100, 100, 255, 0.08)"}
            polygonSideColor={() => "rgba(100, 100, 255, 0.03)"}
            polygonStrokeColor={() => "rgba(255, 255, 255, 0.3)"}
            polygonLabel={(d) => {
              const country = d as CountryFeature;
              return `
                <div style="padding: 8px; background: rgba(0,0,0,0.85); border-radius: 6px; color: white; font-size: 12px;">
                  <b style="font-size: 14px;">${country.properties.NAME}</b>
                  ${country.properties.POP_EST ? `<br/>Population: ${(country.properties.POP_EST / 1e6).toFixed(1)}M` : ""}
                </div>
              `;
            }}
            onPolygonHover={(polygon) => setHoverCountry(polygon as CountryFeature | null)}

            // Points/Markers
            pointsData={layers.points ? CITIES : []}
            pointLat={(d) => (d as CityPoint).lat}
            pointLng={(d) => (d as CityPoint).lng}
            pointColor={(d) => getPointColor(d as CityPoint)}
            pointAltitude={0.01}
            pointRadius={0.4}
            pointLabel={(d) => {
              const city = d as CityPoint;
              return `
                <div style="padding: 10px; background: rgba(0,0,0,0.9); border-radius: 8px; color: white; min-width: 120px;">
                  <b style="font-size: 14px;">${city.name}</b>
                  <br/><span style="color: ${getPointColor(city)}; text-transform: capitalize;">● ${city.type}</span>
                  ${city.population ? `<br/>Pop: ${(city.population / 1e6).toFixed(2)}M` : ""}
                </div>
              `;
            }}
            onPointHover={(point) => setHoverCity(point as CityPoint | null)}

            // Flight Arcs
            arcsData={layers.arcs ? FLIGHT_ARCS : []}
            arcStartLat={(d) => (d as FlightArc).startLat}
            arcStartLng={(d) => (d as FlightArc).startLng}
            arcEndLat={(d) => (d as FlightArc).endLat}
            arcEndLng={(d) => (d as FlightArc).endLng}
            arcColor={(d: object) => (d as FlightArc).color}
            arcAltitude={0.15}
            arcStroke={0.5}
            arcDashLength={0.4}
            arcDashGap={0.2}
            arcDashAnimateTime={2000}
            arcLabel={(d) => {
              const arc = d as FlightArc;
              return `
                <div style="padding: 6px 10px; background: rgba(0,0,0,0.85); border-radius: 4px; color: white; font-size: 12px;">
                  ✈️ ${arc.label || "Flight"}
                </div>
              `;
            }}

            // Hex Bins
            hexBinPointsData={layers.hexBins ? HEX_BIN_DATA : []}
            hexBinPointLat={(d) => (d as HexBinPoint).lat}
            hexBinPointLng={(d) => (d as HexBinPoint).lng}
            hexBinPointWeight={(d) => (d as HexBinPoint).weight}
            hexBinResolution={3}
            hexAltitude={(d) => d.sumWeight * 0.01}
            hexTopColor={() => "rgba(255, 100, 100, 0.8)"}
            hexSideColor={() => "rgba(255, 100, 100, 0.4)"}
            hexBinMerge={true}

            // Labels
            labelsData={layers.labels ? CITIES.filter(c => c.type === "home" || c.population && c.population > 5000000) : []}
            labelLat={(d) => (d as CityPoint).lat}
            labelLng={(d) => (d as CityPoint).lng}
            labelText={(d) => (d as CityPoint).name}
            labelSize={0.8}
            labelDotRadius={0.3}
            labelColor={() => "rgba(255, 255, 255, 0.9)"}
            labelResolution={2}
            labelAltitude={0.015}

            // Paths/Routes
            pathsData={pathsData}
            pathPoints={(d) => (d as { coords: { lat: number; lng: number }[] }).coords}
            pathPointLat={(p) => (p as { lat: number }).lat}
            pathPointLng={(p) => (p as { lng: number }).lng}
            pathColor={(d: object) => (d as PathData).color}
            pathStroke={2}
            pathDashLength={0.01}
            pathDashGap={0.004}
            pathDashAnimateTime={5000}
            pathLabel={(d) => {
              const path = d as PathData;
              return `
                <div style="padding: 6px 10px; background: rgba(0,0,0,0.85); border-radius: 4px; color: white; font-size: 12px;">
                  🛣️ ${path.label}
                </div>
              `;
            }}

            // Atmosphere
            atmosphereColor="lightskyblue"
            atmosphereAltitude={0.15}

            // Animation
            animateIn={true}
          />
          </Suspense>
        </div>
      </div>
    </AppShell>
  );
}
