import fs from 'node:fs';
import {Store} from '../backend/server/store.mjs';
import {editorWorldIssues} from '../backend/server/world.mjs';
const [database,username,output]=process.argv.slice(2);
if(!database||!username||!output)throw Error('Usage: npm run world:export -- backend/data/world.sqlite YOUR_LOCAL_USERNAME world/proposal.json');
const store=new Store(database);
try{const account=store.db.prepare('SELECT id FROM accounts WHERE username=? COLLATE NOCASE').get(username);if(!account)throw Error('Local account not found');const draft=store.editorDraft(account.id);if(!draft)throw Error('Save a draft in World Studio first');const issues=editorWorldIssues(draft.world);if(issues.length)throw Error(JSON.stringify(issues));fs.writeFileSync(output,JSON.stringify(draft.world,null,2)+'\n');console.log('Exported world geometry only. No account data or credentials.');}finally{store.close();}
