// Near-level enemies stay green; increasing danger progresses through amber to dark red.
export function combatLevelColour(enemy,player){const d=enemy-player;if(d<=1)return '#75df70';if(d<=3)return '#c1d45b';if(d<=5)return '#e5bc50';if(d<=8)return '#e48645';if(d<=12)return '#df5145';return '#b83232';}
