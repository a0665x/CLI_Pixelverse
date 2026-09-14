/** Camera-relative input owns inspector facing, even if collision blocks translation. */
export function playerHeading(previous:number,inputX:number,inputY:number,cameraYaw:number):number {
 if(!inputX&&!inputY)return previous;
 const x=inputX*Math.cos(cameraYaw)+inputY*Math.sin(cameraYaw);
 const z=-inputX*Math.sin(cameraYaw)+inputY*Math.cos(cameraYaw);
 return Math.atan2(x,z);
}
