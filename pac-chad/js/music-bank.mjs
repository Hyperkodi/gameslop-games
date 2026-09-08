// Music by Eric Matyas — https://soundimage.org/
// Soundimage International Public License: https://soundimage.org/sample-page/
export const MUSIC_BANK = [
  {id:'afterhours',volume:0.215,duration:92.16,fallbackStart:0.02723356009070295,title:'Cyberpunk Arcade 3',page:'sci-fi-11'},
  {id:'acid-works',volume:0.154,duration:60.630362811791386,fallbackStart:0.02723356009070295,title:'Off-World Industry',page:'sci-fi-11'},
  {id:'violet-vault',volume:0.221,duration:64.31301587301587,fallbackStart:0.02723356009070295,title:'Digital Saturday Night',page:'sci-fi-10'},
  {id:'sunset-strip',volume:0.114,duration:40.0034693877551,fallbackStart:0.02723356009070295,title:'Cyber Street Cruising',page:'sci-fi-10'},
  {id:'frost-byte',volume:0.186,duration:73.98496598639456,fallbackStart:0.02723356009070295,title:'Creepy Lab Drone 3',page:'sci-fi-11'},
  {id:'redline',volume:0.113,duration:61.02521541950114,fallbackStart:0.02723356009070295,title:'Factory on Mercury v001 (Looping)',page:'sci-fi-10'},
  {id:'gold-rush',volume:0.124,duration:75.0048299319728,fallbackStart:0.025011337868480726,title:'Funky Chiptune',page:'chiptunes'},
  {id:'deep-signal',volume:0.237,duration:47.21240362811791,fallbackStart:0.02723356009070295,title:'Grungy Old Code',page:'sci-fi-11'},
  {id:'hot-pink-panic',volume:0.199,duration:92.90321995464852,fallbackStart:0,title:'Cyberpunk Street Chase',page:'sci-fi-13'},
  {id:'chad-citadel',volume:0.13,duration:74.44419501133787,fallbackStart:0.02723356009070295,title:'Cyberpunk Action',page:'sci-fi-8'}
].map(track=>({...track,file:`assets/music-${track.id}.ogg`,fallback:`assets/music-${track.id}.mp3`,source:`https://soundimage.org/${track.page}/`}));
