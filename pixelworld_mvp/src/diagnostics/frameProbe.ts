/** Bounded telemetry; no additional animation loop or per-frame DOM writes. */
export class FrameProbe {
 private samples:number[]=[];private costs:number[]=[];private cursor=0;private published=0;
 record(interval:number,cost:number,now:number){
  this.samples[this.cursor]=interval;this.costs[this.cursor]=cost;this.cursor=(this.cursor+1)%120;
  if(now-this.published<1000)return;this.published=now;
  const sorted=[...this.samples].sort((a,b)=>a-b),costs=[...this.costs].sort((a,b)=>a-b);
  return {frames:this.samples.length,fps:Math.round(1000/(this.samples.reduce((a,b)=>a+b,0)/this.samples.length)),p95:Math.round(sorted[Math.floor((sorted.length-1)*.95)]!*10)/10,cpuP95:Math.round(costs[Math.floor((costs.length-1)*.95)]!*10)/10};
 }
}
