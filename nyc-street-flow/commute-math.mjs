import {bridgeData, bridgePoint, periods} from './core.mjs';
import {railRows} from './rail.mjs';

export const commuteModes = [
  ['rail', 'Subway riders'], ['motor', 'Non-bus motor occupants'], ['bike', 'People cycling'],
  ['walk', 'People walking'], ['bus', 'Scheduled bus riders']
];

// Each result is the count over the complete window. Divide by hours for rates.
export function crossingCounts(year, peak) {
  const {start, end} = periods[peak];
  const hours = end - start;
  const rail = railRows.filter(r => r[0] === year && r[2] >= start && r[2] < end);
  const roads = bridgeData.bridges.map(key => bridgePoint(key, year, peak));
  if (rail.length !== 2 * hours || roads.some(r => !r)) return null;
  const sum = column => rail.reduce((n, r) => n + r[column], 0);
  const result = {year, hours, rail:sum(3) + sum(4), bus:sum(6), sectorRail:sum(5)};
  for (const key of ['motor', 'bike', 'walk']) result[key] = roads.reduce((n, r) => n + r[key], 0);
  result.total = commuteModes.reduce((n, [key]) => n + result[key], 0);
  return result;
}

// NYC DOT, Prospect Park West: post-implementation data, PDF page 51.
// DOT reports the four-route mean separately. Keep it as published.
export const drivePeriods = {day:'Daytime · 7 a.m.–7 p.m.', am:'Morning · 7–10 a.m.', mid:'Midday · 10 a.m.–2 p.m.', pm:'Evening · 4–7 p.m.'};
export const drives = [
  {route:'Prospect Park West · south', day:[174,167], am:[155,162], mid:[174,164], pm:[183,179]},
  {route:'Seventh Avenue · south', day:[325,353], am:[262,332], mid:[356,390], pm:[311,339]},
  {route:'Eighth Avenue · north', day:[255,237], am:[260,245], mid:[254,208], pm:[250,247]},
  {route:'Sixth Avenue · north', day:[260,258], am:[251,232], mid:[261,255], pm:[248,273]},
  {route:'Four-route mean', day:[254,254], am:[232,243], mid:[261,254], pm:[248,260]}
];

export const travelerGroups = [
  'Switch from car to subway', 'Stay in a car / taxi', 'Switch to cycling',
  'Other subway / bus riders', 'Other cyclists', 'Walking / other trips'
];
export const defaultTrips = [[20,40,30], [80,40,41], [0,0,0], [0,0,0], [0,0,0], [0,0,0]];
export function validTrips(rows) {
  return Array.isArray(rows) && rows.length === travelerGroups.length && rows.every(row =>
    Array.isArray(row) && row.length === 3 && Number.isInteger(row[0]) && row[0] >= 0 && row[0] <= 1000000 &&
    row.slice(1).every(v => Number.isFinite(v) && v >= 0 && v <= 1440 && (!row[0] || v > 0)));
}
export function tripBudget(rows) {
  if (!validTrips(rows)) return null;
  const changes = rows.map(([count, without, withLane]) => count * (without - withLane));
  const people = rows.reduce((n, [count]) => n + count, 0);
  const without = rows.reduce((n, [count, minutes]) => n + count * minutes, 0);
  const withLane = rows.reduce((n, [count, , minutes]) => n + count * minutes, 0);
  return {people, without, withLane, saved:without - withLane, changes};
}
export function parseTrips(value) {
  if (value) {
    const rows = value.split('~').map(row => row.split(',').map(v => v.trim() === '' ? NaN : Number(v)));
    if (validTrips(rows)) return rows;
  }
  return defaultTrips.map(row => row.slice());
}
export const serializeTrips = rows => rows.map(row => row.join(',')).join('~');
