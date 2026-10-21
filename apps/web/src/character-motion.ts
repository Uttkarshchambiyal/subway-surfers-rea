export interface MotionState {
 phase:string;grounded:boolean;vy:number;roll:number;board:boolean;boots:boolean;jetpack:boolean;
 transient?:string;
}
export function characterMotion(state:MotionState){
 const {phase,grounded,vy,roll,board,boots,jetpack,transient}=state;
 if(phase==='menu')return {mode:'menu',clip:'Jake_Breathe',once:false};
 if(phase==='collision'||phase==='results')return {mode:'death',clip:'death_lower',once:true};
 if(phase==='starting')return {mode:'intro',clip:'introRun',once:true};
 if(jetpack)return {mode:'jetpack',clip:transient&&/^(Jetpack|Jackpack)_/.test(transient)?transient:'Jetpack_forward_2',once:!!transient};
 if(roll>0)return {mode:board?'board':'run',clip:board?'h_roll':'roll',once:true};
 if(!grounded)return {mode:board?'board':boots?'boots':'air',clip:board?(vy>2?'h_jump':'h_hangtime'):(vy>2?'jump':'hangtime'),once:vy>2};
 if(transient)return {mode:board?'board':boots?'boots':'run',clip:transient,once:true};
 return {mode:board?'board':boots?'boots':'run',clip:board?'h_run':boots?'superRun':'RunNormal',once:false};
}
