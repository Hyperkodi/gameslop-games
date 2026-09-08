// Ordered by campaign level. Artwork and rules share these identifiers.
export const POWERUPS = [
  {id:'gym-pass',name:'Gym Pass',color:'#baff63',effect:'Eat ghosts · double ghost points',object:'Gym membership card'},
  {id:'leg-day',name:'Leg Day',color:'#77d8ff',effect:'Ghosts flee at twice their normal speed',object:'Running shoe'},
  {id:'steak',name:'Damn, that was a great steak',color:'#ffad70',effect:'Move at double speed',object:'Grilled steak on a plate'},
  {id:'mirror-check',name:'Mirror Check',color:'#d9a5ff',effect:'Two fake Chads lure ghosts away',object:'Hand mirror'},
  {id:'cold-plunge',name:'Cold Plunge',color:'#9beeff',effect:'Freeze ghosts for 2s, then slow them for 3s',object:'Bucket overflowing with ice'},
  {id:'pre-workout',name:'Pre-Workout',color:'#ff846c',effect:'Block, knock back and stun the next 3 hits',object:'Shaker bottle'},
  {id:'cheat-day',name:'Cheat Day',color:'#ffde70',effect:'Gold pellets · triple regular pellet points',object:'Cheeseburger'},
  {id:'ghosted',name:'Ghosted',color:'#b7f1e7',effect:'Ghosts search your last known location',object:'Headphones'},
  {id:'absolute-aura',name:'Absolute Aura',color:'#ff9bdd',effect:'Protective aura pushes nearby ghosts away',object:'Deodorant stick'},
  {id:'final-form',name:'Final Form',color:'#ffe89a',effect:'50% faster · eat ghosts · double ghost points',object:'Golden dumbbell'}
];
export const SPECIAL_TICKS=300;
export const specialIs=(s,id)=>s.special?.id===id&&s.special.ticks>0;
export const canEat=s=>s.power>0||specialIs(s,'gym-pass')||specialIs(s,'final-form');
export const ghostBonus=s=>specialIs(s,'gym-pass')||specialIs(s,'final-form')?2:1;
