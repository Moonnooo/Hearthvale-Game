import { scrypt,randomBytes,timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive=promisify(scrypt),options={N:131072,r:8,p:1,maxmem:256*1024*1024};
export const validUsername=name=>typeof name==='string'&&/^[A-Za-z][A-Za-z0-9_]{2,19}$/.test(name);
export const validPassword=password=>typeof password==='string'&&password.length>=12&&password.length<=128;
export async function passwordHash(password,salt=randomBytes(16).toString('hex')){return {salt,digest:(await derive(password,salt,64,options)).toString('hex')};}
export async function passwordMatches(password,account){const result=await passwordHash(password,account?.salt||'00000000000000000000000000000000');return timingSafeEqual(Buffer.from(result.digest,'hex'),Buffer.from(account?.password_hash||'00'.repeat(64),'hex'))&&Boolean(account);}
