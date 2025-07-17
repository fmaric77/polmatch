import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { Feature, FeatureCollection, Geometry, GeoJsonProperties } from 'geojson'; // Import GeoJSON types

// Dynamically import react-globe.gl to avoid SSR issues
const Globe = dynamic(() => import('react-globe.gl'), { ssr: false });

interface CountryStat {
  country: string;
  count: number;
  percentage: string;
}

interface CountryStatsResponse {
  success: boolean;
  totalUsers: number;
  countryStats: CountryStat[];
  lastUpdated: string;
}

export default function WorldMap() {
  const [continents, setContinents] = useState<Feature<Geometry, GeoJsonProperties>[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countryStats, setCountryStats] = useState<{ [country: string]: CountryStat }>({});
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);
  const [webglSupported, setWebglSupported] = useState<boolean>(true);

  useEffect(() => {
    // Detect WebGL support
    if (typeof window !== 'undefined') {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      setWebglSupported(Boolean(gl));
    }
  }, []);

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

  // Fetch country statistics
  useEffect(() => {
    console.log("WorldMap: Fetching country statistics");
    fetch('/api/users/country-stats')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch country stats: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then((data: CountryStatsResponse) => {
        console.log("WorldMap: Country stats fetched successfully:", data);
        if (data.success) {
          const statsMap: { [country: string]: CountryStat } = {};
          data.countryStats.forEach(stat => {
            statsMap[stat.country] = stat;
          });
          setCountryStats(statsMap);
          setTotalUsers(data.totalUsers);
        }
      })
      .catch(fetchError => {
        console.error("WorldMap: Error fetching country stats:", fetchError);
        // Don't set error state for stats, just log it
      })
      .finally(() => {
        setLoadingStats(false);
      });
  }, []);

  useEffect(() => {
    console.log("WorldMap: Continents state updated:", continents);
  }, [continents]);

  // Responsive width/height fallback
  const width = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const height = typeof window !== 'undefined' ? window.innerHeight : 800;

  // If WebGL is not available, show a friendly message
  if (!webglSupported) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-red-400 text-base sm:text-lg p-4">
        WebGL is not supported or is disabled in your browser. Please enable WebGL to view the world map.
      </div>
    );
  }

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

          const HOVER_COLOR = '#FFD700'; // Gold for hover
          
          // Get user count for this country
          const userCount = currentPolygonName && countryStats[currentPolygonName] 
            ? countryStats[currentPolygonName].count 
            : 0;
          
          // Color based on user density
          let baseColor = '#444444'; // Default dark gray for no users
          if (userCount > 0) {
            if (userCount >= 10) {
              baseColor = '#FF4444'; // Bright red for high user count
            } else if (userCount >= 5) {
              baseColor = '#FF8844'; // Orange for medium-high user count
            } else if (userCount >= 2) {
              baseColor = '#FFAA44'; // Yellow-orange for medium user count
            } else {
              baseColor = '#FFDD44'; // Light yellow for low user count
            }
          }

          // Special handling for Kosovo/Serbia
          if (currentPolygonName === 'Kosovo') {
            if (hovered === 'Serbia') {
              return HOVER_COLOR; // Highlight Kosovo if Serbia is hovered
            }
            // Use user count color for Kosovo
            const kosovoCount = countryStats['Serbia'] ? countryStats['Serbia'].count : 0;
            if (kosovoCount >= 10) return '#FF4444';
            if (kosovoCount >= 5) return '#FF8844';
            if (kosovoCount >= 2) return '#FFAA44';
            if (kosovoCount >= 1) return '#FFDD44';
            return '#444444';
          }

          if (currentPolygonName === 'Serbia') {
            if (hovered === 'Serbia') {
              return HOVER_COLOR; // Highlight Serbia if it's directly hovered
            }
            // Use base color for Serbia based on user count
          }

          // Standard hover for other polygons
          if (hovered === currentPolygonName) {
            return HOVER_COLOR;
          }
          
          return baseColor;
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
        <div className="fixed left-1/2 top-8 -translate-x-1/2 px-6 py-3 bg-black/90 text-white rounded-lg border border-white text-lg pointer-events-none z-50 shadow-lg min-w-[200px]">
          <div className="font-bold text-xl mb-1">{hovered}</div>
          {countryStats[hovered] ? (
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Users:</span>
                <span className="font-semibold text-blue-300">{countryStats[hovered].count}</span>
              </div>
              <div className="flex justify-between">
                <span>Percentage:</span>
                <span className="font-semibold text-green-300">{countryStats[hovered].percentage}%</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-300">
              {loadingStats ? 'Loading stats...' : 'No users found'}
            </div>
          )}
          {totalUsers > 0 && (
            <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-600">
              Total active users: {totalUsers}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
