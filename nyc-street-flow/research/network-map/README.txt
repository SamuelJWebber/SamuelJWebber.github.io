NYC Street Flow — study geography
Updated November 5, 2026

Purpose
Show how the lane conversion, observations, comparators and transport alternatives occupy different geographic boundaries. This map does not measure person flow, routing, travel time, induced demand or mode switching.

Geometry
Coordinates use longitude, latitude (EPSG:4326). The SVG uses a local equirectangular projection corrected by cosine of the case's mid-latitude. This preserves approximate local orientation; it is not a routing map.

Subway station centers are selected from the MTA station dataset 39hk-dx4f, acquired November 5, 2026. Only station identities and geography are retained. Current service patterns are not imputed to 2010 or 2016. Rail connections are straight schematic joins, not tunnel paths. Station entries or exits are not passengers crossing the road measurement boundary.

NYSDOT counter 021284 uses the official 2016 continuous-counter inventory coordinate 40.72549, -73.9488. The inventory describes the road segment as I-278 to Greenpoint Avenue. Coordinate precision does not verify historical sensor continuity or that counts at this point equal bridge traffic.

Roads, parks, creek outlines and PPW count markers are manually approximated from the named locations for visual orientation. They are not official centerlines, measured buffers, exact timed-run endpoints, survey coordinates or hardware positions. The map makes no distance-based calculation. Third Avenue's displayed bus endpoints are named analysis timepoints positioned approximately; the 1.472-mile distance comes from the MTA segment data, not from this drawing.

Historical boundaries
PPW: bike sheets identify the block between Fourth and Fifth Streets; motor counts are near Carroll Street. The B69 left PPW southbound and Eighth Avenue northbound for Seventh Avenue on June 27, 2010, with service changes. These counts and routes cannot be summed as if synchronized.

Third Avenue: project E59–E96, observed bus segment E67–E97. The project includes bus, bicycle, signal and intersection changes. Other corridor estimates and rail geography do not establish passenger displacement or a bike-only effect.

Pulaski: the 2016 conversion removed a Brooklyn-bound/southbound moving lane between Jackson Avenue and Eagle Street. It is distinct from later McGuinness projects. McGuinness station 021284 is south of the bridge and intervening junctions. The bike-counter point uses the site coordinate in the November 5, 2026 NYC DOT registry (sensor 100010018). Its firstdata field is June 24, 2017, after conversion; the registry also lists a May 12, 2022 equipment installation. The displayed site point does not establish 2017 hardware location or continuity. Selected registry fields are preserved in source-points.json.

Reproduction
source-points.json preserves the selected official point coordinates. build-map-data.py combines them with the explicitly approximate hand-entered illustrative geometry and writes map-data.json plus map-features.geojson. Run: python build-map-data.py
All feature sources and descriptions are embedded in the JSON and GeoJSON properties. No external map tiles, routing service, cookies or API key are required at runtime.
