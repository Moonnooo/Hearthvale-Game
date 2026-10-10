import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { passwordHash,passwordMatches,validUsername,validPassword } from './passwords.mjs';
import { normalizePlayer,SPAWN } from './world.mjs';
export const hash=token=>createHash('sha256').update(token).digest('hex');
export const normalizeEmail=value=>typeof value==='string'?value.trim().toLowerCase():'';
export const validEmail=value=>value.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
export class Store {
  constructor(filename) {
    if(filename!==':memory:') mkdirSync(dirname(filename),{recursive:true});
    this.db=new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY, name TEXT NOT NULL, state TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id), expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS world(id TEXT PRIMARY KEY, state TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, player_id TEXT NOT NULL UNIQUE REFERENCES players(id), salt TEXT NOT NULL, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL);`);
    this.db.exec('CREATE TABLE IF NOT EXISTS editor_drafts(account_id TEXT PRIMARY KEY REFERENCES accounts(id), state TEXT NOT NULL, base_revision TEXT NOT NULL, version INTEGER NOT NULL, updated_at INTEGER NOT NULL);');
    this.db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
    if(!this.db.prepare('PRAGMA table_info(accounts)').all().some(c=>c.name==='email'))this.db.exec('ALTER TABLE accounts ADD COLUMN email TEXT');
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS accounts_email ON accounts(email COLLATE NOCASE); CREATE TABLE IF NOT EXISTS password_resets(token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL UNIQUE REFERENCES accounts(id), expires INTEGER NOT NULL, requested_at INTEGER NOT NULL);');
    this.db.prepare('DELETE FROM password_resets WHERE expires < ?').run(Date.now());
  }
  create(name) {
    const id=randomBytes(12).toString('hex'), token=randomBytes(32).toString('hex');
    const player=normalizePlayer({id,name,x:SPAWN.x,y:SPAWN.y});
    this.db.prepare('INSERT INTO players VALUES(?,?,?)').run(id,name,JSON.stringify(player));
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),id,Date.now()+30*86400000);
    return {player,token};
  }
  session(token) {
    if(!/^[a-f0-9]{64}$/.test(token??'')) return null;
    const row=this.db.prepare('SELECT p.state FROM sessions s JOIN players p ON p.id=s.player_id WHERE s.token_hash=? AND s.expires>?').get(hash(token),Date.now());
    return row?normalizePlayer(JSON.parse(row.state)):null;
  }
  accountFor(playerId){const row=this.db.prepare('SELECT id,username FROM accounts WHERE player_id=?').get(playerId);return row||null;}
  authenticatedSession(token){const player=this.session(token);return player&&this.accountFor(player.id)?player:null;}
  newSession(playerId){const token=randomBytes(32).toString('hex');this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(token),playerId,Date.now()+30*86400000);return token;}
  revoke(token){if(token)this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(token));}
  async register(username,password,email){
    if(!validUsername(username))throw new Error('Use 3–20 letters, numbers or underscores; start with a letter.');
    if(!validPassword(password))throw new Error('Use a password with 12–128 characters.');
    email=normalizeEmail(email);if(!validEmail(email))throw new Error('Enter a valid email address.');
    const derived=await passwordHash(password);
    this.db.exec('BEGIN IMMEDIATE');
    try{
      if(this.db.prepare('SELECT id FROM accounts WHERE username=?').get(username))throw new Error('That username is already taken.');
      if(this.db.prepare('SELECT id FROM accounts WHERE email=? COLLATE NOCASE').get(email))throw new Error('Unable to create an account with these details. Try logging in or resetting your password.');
      const player=this.create(username).player;player.inventory.bronzePickaxe=1;player.inventory.bronzeAxe=1;player.inventory.tinderbox=1;this.save(player);
      this.db.prepare('INSERT INTO accounts(id,username,player_id,salt,password_hash,created_at,email) VALUES(?,?,?,?,?,?,?)').run(randomBytes(12).toString('hex'),username,player.id,derived.salt,derived.digest,Date.now(),email);
      this.db.prepare('DELETE FROM sessions WHERE player_id=?').run(player.id);
      const token=this.newSession(player.id);this.db.exec('COMMIT');return {player,token,username};
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  async login(username,password){
    if(!validUsername(username)||typeof password!=='string'||password.length>128)throw new Error('Invalid username or password.');
    const account=this.db.prepare('SELECT * FROM accounts WHERE username=?').get(username);
    if(!await passwordMatches(password,account))throw new Error('Invalid username or password.');
    const player=normalizePlayer(JSON.parse(this.db.prepare('SELECT state FROM players WHERE id=?').get(account.player_id).state));
    return {player,token:this.newSession(player.id),username:account.username};
  }
  requestReset(email){
    email=normalizeEmail(email);if(!validEmail(email))return null;
    const account=this.db.prepare('SELECT id,email FROM accounts WHERE email=? COLLATE NOCASE').get(email);if(!account)return null;
    const previous=this.db.prepare('SELECT requested_at FROM password_resets WHERE account_id=?').get(account.id);
    if(previous&&Date.now()-previous.requested_at<60000)return null;
    const token=randomBytes(32).toString('hex');this.db.prepare('INSERT INTO password_resets VALUES(?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET token_hash=excluded.token_hash,expires=excluded.expires,requested_at=excluded.requested_at').run(hash(token),account.id,Date.now()+1800000,Date.now());return {email:account.email,token};
  }
  async resetPassword(token,password){
    if(!validPassword(password))throw new Error('Use a password with 12–128 characters.');
    if(!/^[a-f0-9]{64}$/.test(token??''))throw new Error('This reset link is invalid or expired. Request a new one.');
    const derived=await passwordHash(password);this.db.exec('BEGIN IMMEDIATE');
    try{const reset=this.db.prepare('SELECT r.account_id,a.player_id FROM password_resets r JOIN accounts a ON a.id=r.account_id WHERE r.token_hash=? AND r.expires>?').get(hash(token),Date.now());if(!reset)throw new Error('This reset link is invalid or expired. Request a new one.');
      this.db.prepare('UPDATE accounts SET salt=?,password_hash=? WHERE id=?').run(derived.salt,derived.digest,reset.account_id);this.db.prepare('DELETE FROM sessions WHERE player_id=?').run(reset.player_id);this.db.prepare('DELETE FROM password_resets WHERE account_id=?').run(reset.account_id);this.db.exec('COMMIT');return reset.player_id;
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  save(p) {const {id,name,x,y,inventory,bank,xp,equipment,hp,combatOption,combatStyle,energy,runEnabled,prayerPoints,floorLevel,floorBuilding}=p;this.db.prepare('UPDATE players SET name=?,state=? WHERE id=?').run(name,JSON.stringify({id,name,x,y,inventory,bank,xp,equipment,hp,combatOption,combatStyle,energy,runEnabled,prayerPoints,floorLevel,floorBuilding}),id);}
  loadWorld(key='nodes'){const r=this.db.prepare('SELECT state FROM world WHERE id=?').get(key);return r?JSON.parse(r.state):[];}
  saveWorld(nodes,key='nodes'){this.db.prepare('INSERT INTO world VALUES(?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state').run(key,JSON.stringify(nodes));}
  loadDrops(key='drops'){const row=this.db.prepare('SELECT state FROM world WHERE id=?').get(key);return row?JSON.parse(row.state):[];}
  saveDrops(drops,key='drops'){this.db.prepare('INSERT INTO world VALUES(?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state').run(key,JSON.stringify(drops));}
  persistLoot(p,drops,nodes,dropKey='drops',nodeKey='nodes'){this.db.exec('BEGIN IMMEDIATE');try{this.save(p);this.saveDrops(drops,dropKey);if(nodes)this.saveWorld(nodes,nodeKey);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}}
  authoredWorld(key='authored:live'){const r=this.db.prepare('SELECT state FROM world WHERE id=?').get(key);return r?JSON.parse(r.state):null;}
  saveAuthoredWorld(next,previous){this.db.exec('BEGIN IMMEDIATE');try{if(previous)this.saveWorld(previous,'authored:previous');this.saveWorld(next,'authored:live');this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}}
  publishEditorWorld(next,previous,accountId,revision,expectedVersion){this.db.exec('BEGIN IMMEDIATE');try{const current=this.editorDraft(accountId);if((current?.version||0)!==expectedVersion){const e=Error('Your database draft changed in another browser. Reload it before publishing.');e.status=409;throw e;}this.saveWorld(previous,'authored:previous');this.saveWorld(next,'authored:live');const version=expectedVersion+1,updatedAt=Date.now();this.db.prepare('INSERT INTO editor_drafts VALUES(?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET state=excluded.state,base_revision=excluded.base_revision,version=excluded.version,updated_at=excluded.updated_at').run(accountId,JSON.stringify(next),revision,version,updatedAt);this.db.exec('COMMIT');return {version,updatedAt};}catch(e){this.db.exec('ROLLBACK');throw e;}}
  editorDraft(accountId){const r=this.db.prepare('SELECT state,base_revision,version,updated_at FROM editor_drafts WHERE account_id=?').get(accountId);return r?{world:JSON.parse(r.state),revision:r.base_revision,version:r.version,updatedAt:r.updated_at}:null;}
  saveEditorDraft(accountId,world,revision,expectedVersion){const state=JSON.stringify(world);if(Buffer.byteLength(state)>2097152)throw Error('World file exceeds 2 MB.');this.db.exec('BEGIN IMMEDIATE');try{const current=this.editorDraft(accountId);if((current?.version||0)!==expectedVersion){const e=Error('This draft changed in another browser. Download your unsaved edits, then reload the database draft.');e.status=409;throw e;}const version=(current?.version||0)+1,updatedAt=Date.now();this.db.prepare('INSERT INTO editor_drafts VALUES(?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET state=excluded.state,base_revision=excluded.base_revision,version=excluded.version,updated_at=excluded.updated_at').run(accountId,state,revision,version,updatedAt);this.db.exec('COMMIT');return {version,updatedAt};}catch(e){this.db.exec('ROLLBACK');throw e;}}
  close(){this.db.close();}
}
