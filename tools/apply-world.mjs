import fs from 'node:fs';
import {Store} from '../backend/server/store.mjs';
import {editorWorldIssues,applyWorldDocument,exportWorldDocument} from '../backend/server/world.mjs';
const [file,database]=process.argv.slice(2);
if(!file||!database)throw Error('Usage: npm run world:apply -- world/sample.json backend/data/world.sqlite (stop the local server first)');
const world=JSON.parse(fs.readFileSync(file,'utf8')),issues=editorWorldIssues(world);
if(issues.length)throw Error(JSON.stringify(issues));
applyWorldDocument(world);const store=new Store(database);
try{const previous=store.authoredWorld();if(previous)fs.writeFileSync(database+'.world-backup-'+Date.now()+'.json',JSON.stringify(previous),{mode:0o600,flag:'wx'});store.saveAuthoredWorld(exportWorldDocument(),previous);console.log('Applied validated world. Restart the local server to load it.');}finally{store.close();}
