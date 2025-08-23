import { useEffect, useState, useMemo } from 'react';
import { Feature, FeatureCollection, Geometry, GeoJsonProperties } from 'geojson';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';
import { useTheme } from './ThemeProvider';
import { useRouter } from 'next/navigation';

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

export default function WorldMap(): JSX.Element {
  const { theme } = useTheme();
  const router = useRouter();
  const [continents, setContinents] = useState<FeatureCollection<Geometry, GeoJsonProperties> | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countryStats, setCountryStats] = useState<{ [country: string]: CountryStat }>({});
  const [totalUsers, setTotalUsers] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState<boolean>(true);

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
              setContinents(geo);
            } else if (geo.type === 'Feature') {
              console.log("WorldMap: TopoJSON converted to a single GeoJSON Feature:", [geo]);
              setContinents({ type: 'FeatureCollection', features: [geo] });
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
          setContinents(data as FeatureCollection<Geometry, GeoJsonProperties>);
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

  const geographySource = useMemo(() => continents, [continents]);

  if (error) {
    return <div className="w-full h-full flex items-center justify-center bg-white dark:bg-black text-red-600 dark:text-red-500 text-xl">{error}</div>;
  }

  return (
    <div className="w-full h-full bg-white dark:bg-black relative">
      {geographySource ? (
        <ComposableMap
          projection="geoEqualEarth"
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
        >
          <Geographies geography={geographySource}>
            {({ geographies }: { geographies: Array<Feature<Geometry, GeoJsonProperties> & { rsmKey: string }> }) => (
              <>
                {geographies.map((geo) => {
                  const props = geo.properties as GeoJsonProperties & { [key: string]: unknown };
                  const actualName = (props.ADMIN as string) || (props.name as string) || (props.COUNTRY as string) || (props.CONTINENT as string) || (props.continent as string) || '';
                  const displayName = (actualName === 'Kosovo' || actualName === 'Serbia') ? 'Serbia' : actualName;
                  const userCount = displayName && countryStats[displayName] ? countryStats[displayName].count : 0;

                  const hoverColor = '#FFD700';
                  let baseColor = theme === 'dark' ? '#444444' : '#cccccc';
                  if (userCount > 0) {
                    if (userCount >= 10) baseColor = '#FF4444';
                    else if (userCount >= 5) baseColor = '#FF8844';
                    else if (userCount >= 2) baseColor = '#FFAA44';
                    else baseColor = '#FFDD44';
                  }

                  const isHovered = hovered === displayName;
                  const fill = isHovered ? hoverColor : baseColor;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onMouseEnter={() => setHovered(displayName || null)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => {
                        if (actualName) {
                          router.push(`/search?country=${encodeURIComponent(actualName)}`);
                          console.log('WorldMap: Navigating to search for country:', actualName);
                        }
                      }}
                      style={{
                        default: {
                          fill,
                          stroke: theme === 'dark' ? '#ffffff' : '#000000',
                          strokeWidth: 0.5,
                          outline: 'none'
                        },
                        hover: {
                          fill: hoverColor,
                          stroke: theme === 'dark' ? '#ffffff' : '#000000',
                          strokeWidth: 0.8,
                          outline: 'none'
                        },
                        pressed: {
                          fill: hoverColor,
                          stroke: theme === 'dark' ? '#ffffff' : '#000000',
                          strokeWidth: 1,
                          outline: 'none'
                        }
                      }}
                    />
                  );
                })}
              </>
            )}
          </Geographies>
        </ComposableMap>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-600 dark:text-gray-300">
          Loading map...
        </div>
      )}

      {hovered && (
        <div className="fixed left-1/2 top-8 -translate-x-1/2 px-6 py-3 bg-white/90 dark:bg-black/90 text-black dark:text-white rounded-lg border border-black dark:border-white text-lg pointer-events-none z-50 shadow-lg min-w-[200px]">
          <div className="font-bold text-xl mb-1">{hovered}</div>
          {countryStats[hovered] ? (
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Users:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-300">{countryStats[hovered].count}</span>
              </div>
              <div className="flex justify-between">
                <span>Percentage:</span>
                <span className="font-semibold text-green-600 dark:text-green-300">{countryStats[hovered].percentage}%</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600 dark:text-gray-300">
              {loadingStats ? 'Loading stats...' : 'No users found'}
            </div>
          )}
          {totalUsers > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
              Total active users: {totalUsers}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
