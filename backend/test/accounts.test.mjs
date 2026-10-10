import test from 'node:test';
import assert from 'node:assert/strict';
import { Store,hash } from '../server/store.mjs';
const password='Only for automated testing!';
test('email registration starts a fresh character, validates and saves account data',async()=>{
 const store=new Store(':memory:');try{
 const guest=store.create('Old Traveller');guest.player.inventory.logs=8;store.save(guest.player);
 await assert.rejects(()=>store.register('Alice','short','alice@example.com'),/12/);
 await assert.rejects(()=>store.register('Alice',password,'invalid'),/email/);
 assert.equal(store.db.prepare('SELECT count(*) AS n FROM accounts').get().n,0);
 const account=await store.register('Alice',password,' Alice@Example.com ');
 assert.notEqual(account.player.id,guest.player.id);assert.equal(account.player.inventory.logs,0);
 const row=store.db.prepare('SELECT * FROM accounts').get();assert.equal(row.email,'alice@example.com');assert.notEqual(row.password_hash,password);
 await assert.rejects(()=>store.register('ALICE',password,'other@example.com'),/taken/);
 await assert.rejects(()=>store.register('Other',password,'ALICE@example.com'),/Unable/);
 account.player.bank.logs=9;store.save(account.player);assert.equal((await store.login('alice',password)).player.bank.logs,9);
 }finally{store.close();}
});
test('reset tokens are hashed, expire, are single use, and revoke all sessions',async()=>{
 const store=new Store(':memory:');try{
 const account=await store.register('Alice',password,'alice@example.com');const login=await store.login('Alice',password);
 assert.equal(store.requestReset('nobody@example.com'),null);
 const reset=store.requestReset('ALICE@example.com');assert.equal(reset.email,'alice@example.com');assert.equal(store.requestReset('alice@example.com'),null);
 assert.equal(store.db.prepare('SELECT token_hash FROM password_resets').get().token_hash,hash(reset.token));
 await assert.rejects(()=>store.resetPassword(reset.token,'short'),/12/);assert.ok(store.authenticatedSession(account.token));
 store.db.prepare('UPDATE password_resets SET expires=0').run();await assert.rejects(()=>store.resetPassword(reset.token,password),/expired/);
 store.db.prepare('UPDATE password_resets SET requested_at=0').run();const fresh=store.requestReset('alice@example.com');
 await assert.rejects(()=>store.resetPassword(reset.token,password),/expired/);
 const newPassword='A different automated test password!';
 const simultaneous=await Promise.allSettled([store.resetPassword(fresh.token,newPassword),store.resetPassword(fresh.token,newPassword)]);
 assert.equal(simultaneous.filter(r=>r.status==='fulfilled').length,1);
 assert.equal(store.authenticatedSession(account.token),null);assert.equal(store.authenticatedSession(login.token),null);
 await assert.rejects(()=>store.login('Alice',password),/Invalid/);assert.equal((await store.login('Alice',newPassword)).player.id,account.player.id);
 await assert.rejects(()=>store.resetPassword(fresh.token,password),/expired/);
 }finally{store.close();}
});
