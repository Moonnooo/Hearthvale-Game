// Old School RuneScape standard skill curve; shared by server and browser.
export const MAX_SKILL_LEVEL=99;
const thresholds=[0,0];let points=0;for(let n=1;n<MAX_SKILL_LEVEL;n++){points+=Math.floor(n+300*2**(n/7));thresholds[n+1]=Math.floor(points/4);}export const XP_THRESHOLDS=Object.freeze(thresholds);
export function xpForLevel(n){return XP_THRESHOLDS[Math.max(1,Math.min(MAX_SKILL_LEVEL,Math.floor(n)))];}
export function levelForXp(xp){let low=1,high=MAX_SKILL_LEVEL;while(low<high){const mid=Math.ceil((low+high)/2);if(xp>=XP_THRESHOLDS[mid])low=mid;else high=mid-1;}return low;}
export function skillProgress(xp){const level=levelForXp(xp),start=xpForLevel(level),next=xpForLevel(level+1);return {level,nextLevel:Math.min(MAX_SKILL_LEVEL,level+1),remaining:level===MAX_SKILL_LEVEL?0:Math.max(0,next-xp),percent:level===MAX_SKILL_LEVEL?100:Math.max(0,Math.min(100,(xp-start)/(next-start)*100))};}
