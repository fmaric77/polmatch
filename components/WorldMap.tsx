import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Feature, FeatureCollection, Geometry, GeoJsonProperties } from 'geojson'; // Import GeoJSON types

// Dynamically import react-globe.gl to avoid SSR issues
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

export default function WorldMap() {
  const [continents, setContinents] = useState<Feature<Geometry, GeoJsonProperties>[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("WorldMap: Attempting to fetch continents-geo.json");
    fetch('/continents-geo.json')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch continents-geo.json: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log("WorldMap: continents-geo.json fetched successfully:", data);
        if (data.type === 'Topology' && data.objects && data.objects.continents) {
          console.log("WorldMap: Detected TopoJSON, attempting to convert.");
          import('topojson-client').then((topojson) => {
            // topojson.feature can return a single Feature or a FeatureCollection
            const geo = topojson.feature(data, data.objects.continents) as FeatureCollection<Geometry, GeoJsonProperties> | Feature<Geometry, GeoJsonProperties>;
            if (geo.type === 'FeatureCollection') {
              console.log("WorldMap: TopoJSON converted to GeoJSON FeatureCollection:", geo.features);
              setContinents(geo.features);
            } else if (geo.type === 'Feature') {
              console.log("WorldMap: TopoJSON converted to a single GeoJSON Feature:", [geo]);
              setContinents([geo]); // Wrap single feature in an array
            } else {
              console.warn("WorldMap: Converted TopoJSON is not a Feature or FeatureCollection.");
              setError("Invalid converted continent data format.");
            }
          }).catch(conversionError => {
            console.error("WorldMap: Error converting TopoJSON:", conversionError);
            setError("Error converting TopoJSON.");
          });
        } else if (data.type === 'FeatureCollection' && data.features) {
          console.log("WorldMap: Detected GeoJSON features:", data.features);
          setContinents(data.features);
        } else {
          console.warn("WorldMap: continents-geo.json is not in expected TopoJSON or GeoJSON format.");
          setError("Invalid continent data format.");
        }
      })
      .catch(fetchError => {
        console.error("WorldMap: Error fetching continents-geo.json:", fetchError);
        setError("Could not load continent data.");
      });
  }, []);

  useEffect(() => {
    console.log("WorldMap: Continents state updated:", continents);
  }, [continents]);

  // Responsive width/height fallback
  const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const height = typeof window !== 'undefined' ? window.innerHeight : 800;

  if (error) {
    return <div className="w-full h-full flex items-center justify-center bg-black text-red-500 text-xl">{error}</div>;
  }

  return (
    <div className="w-full h-full bg-black">
      <Globe
        globeImageUrl={null}
        backgroundColor={"#000000"}
        width={width}
        height={height}
        polygonsData={continents}
        polygonAltitude={0.01}
        polygonCapColor={(polygon) => {
          const feature = polygon as Feature<Geometry, GeoJsonProperties>;
          let currentPolygonName: string | null = null;
          if (feature && feature.properties) {
            const props = feature.properties;
            currentPolygonName = props.ADMIN || props.name || props.COUNTRY || props.CONTINENT || props.continent;
          }

          const HOVER_COLOR = '#888888';
          const DEFAULT_COLOR = '#FFFFFF';

          if (currentPolygonName === 'Kosovo') {
            if (hovered === 'Serbia') {
              return HOVER_COLOR; // Highlight Kosovo if Serbia is hovered
            }
            return DEFAULT_COLOR; // Kosovo's default color, same as other countries
          }

          if (currentPolygonName === 'Serbia') {
            if (hovered === 'Serbia') {
              return HOVER_COLOR; // Highlight Serbia if it's directly hovered
            }
            // No special color for Serbia if not hovered, defaults below
          }

          // Standard hover for other polygons or Serbia when not specifically Kosovo-related hover
          if (hovered === currentPolygonName) {
            return HOVER_COLOR;
          }
          
          return DEFAULT_COLOR;
        }}
        polygonSideColor={() => '#222'}
        polygonStrokeColor={() => '#fff'}
        onPolygonHover={(polygon) => {
          const feature = polygon as Feature<Geometry, GeoJsonProperties>;
          let nameForHover: string | null = null;
          if (feature && feature.properties) {
            const props = feature.properties;
            const actualName = props.ADMIN || props.name || props.COUNTRY || props.CONTINENT || props.continent;

            if (actualName === 'Kosovo' || actualName === 'Serbia') {
              nameForHover = 'Serbia';
            } else {
              nameForHover = actualName;
            }
          }
          setHovered(nameForHover);
        }}
        onPolygonClick={(polygon) => {
          const feature = polygon as Feature<Geometry, GeoJsonProperties>;
          let name: string | null = null;
          if (feature && feature.properties) {
            const props = feature.properties;
            name = props.ADMIN || props.name || props.COUNTRY || props.CONTINENT || props.continent;
          }
          if (name) {
            alert(`Clicked: ${name}`);
            console.log("WorldMap: Clicked on polygon:", feature);
          }
        }}
        polygonsTransitionDuration={300}
        showGlobe={true}
        showGraticules={true}
        atmosphereColor="#000000"
        atmosphereAltitude={0.15}
      />
      {hovered && (
        <div className="fixed left-1/2 top-8 -translate-x-1/2 px-6 py-2 bg-black/80 text-white rounded-lg border border-white text-xl pointer-events-none z-50 shadow-lg">
          {hovered}
        </div>
      )}
    </div>
  );
}
