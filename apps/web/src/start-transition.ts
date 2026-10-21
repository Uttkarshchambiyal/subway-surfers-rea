const clamp=(value:number)=>Math.max(0,Math.min(1,value));
export function startPresentation(phase:string,previousPhase:string,remaining:number,duration:number,distance:number,speed:number){
 const stage=phase==='paused'?previousPhase:phase;
 const progress=stage==='menu'?0:stage==='starting'?clamp(1-remaining/duration):1;
 const blend=progress*progress*progress*(progress*(progress*6-15)+10);
 // Integral of smoothstep velocity: stationary at the menu, normal world
 // speed at the handoff, with zero acceleration at both endpoints.
 const lead=speed*duration/2;
 const introDistance=stage==='menu'?0:stage==='starting'?speed*duration*(progress**3-.5*progress**4):lead;
 return {stage,progress,blend,lead,environmentDistance:introDistance+distance,entityDistance:introDistance+distance-lead};
}
