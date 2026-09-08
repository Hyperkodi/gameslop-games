// Generated 2x2 atlas, ordered closed, medium, wide, small.
// The skull registration offsets were measured against the closed frame.
// Shared crop and scale keep the eyes/hair still as the bearded jaw drops.
export const CHOMP_ATLAS = {
  cell:627,
  cropX:130,
  cropWidth:405,
  logicalHeight:650,
  frames:[
    {column:0,sourceY:0,sourceHeight:600,dx:0,dy:0},
    {column:1,sourceY:0,sourceHeight:600,dx:60,dy:-1},
    {column:0,sourceY:600,sourceHeight:654,dx:1,dy:18},
    {column:1,sourceY:600,sourceHeight:654,dx:58,dy:17}
  ]
};
const CYCLE=[0,3,1,2,2,1,3];
// One chomp per corridor tile. Using movement progress also freezes the mouth
// during pause and closes it at a wall, independent of display frame rate.
export function chompFrame(actor) {
  if(!actor?.moving)return 0;
  const phase=Math.min(CYCLE.length-1,Math.floor(actor.progress/actor.duration*CYCLE.length));
  return CYCLE[Math.max(0,phase)];
}
