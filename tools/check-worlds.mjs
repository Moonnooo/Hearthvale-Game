import fs from 'node:fs';
import {editorWorldIssues} from '../backend/server/world.mjs';
const files=process.argv.slice(2);
if(!files.length)for(const f of fs.readdirSync('world'))if(f.endsWith('.json'))files.push('world/'+f);
let failed=false;
for(const file of files){try{const world=JSON.parse(fs.readFileSync(file,'utf8')),issues=editorWorldIssues(world);if(issues.length){failed=true;console.error(file,JSON.stringify(issues));}else console.log(file+': valid');}catch(e){failed=true;console.error(file+': '+e.message);}}
if(failed)process.exitCode=1;
