const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
export const RUG_DURATION=2.4;
export function rugPose(seconds){
 const pull=smooth((seconds-.38)/.42),fall=smooth((seconds-.64)/1.03);
 return {pull,offset:pull*245,lift:Math.sin(pull*Math.PI)*13,rugAlpha:1-smooth((seconds-.95)/.2),
  catX:fall*35,catLift:Math.sin(fall*Math.PI)*54,rotation:fall*Math.PI*2.5,
  fallen:fall,stage:seconds<.38?'land':seconds<.64?'pull':seconds<1.67?'tumble':'rest'};
}
