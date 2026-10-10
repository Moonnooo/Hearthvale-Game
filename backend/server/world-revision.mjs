import {createHash} from 'node:crypto';
import {areaPolygons} from './world.mjs';
export function documentRevision(world){const d=structuredClone(world),derived=areaPolygons(d.areas.map(a=>{const n={...a};delete n.polygon;return n;}),d.regions);d.areas.forEach((a,i)=>{if(JSON.stringify(a.polygon)===JSON.stringify(derived[i]?.polygon))delete a.polygon;});return createHash('sha256').update(JSON.stringify(d)).digest('hex');}
