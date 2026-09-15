export type InspectorFood='carrot'|'hay';
export const FOOD_DURATION=30000;
/** Refeeding refreshes one effect; effects do not accumulate without a limit. */
export class FoodEffects {
 private speedUntil=0;private sizeUntil=0;
 eatenAt=-Infinity;food:InspectorFood='carrot';
 feed(food:InspectorFood,now:number){this.food=food;this.eatenAt=now;if(food==='carrot')this.speedUntil=now+FOOD_DURATION;else this.sizeUntil=now+FOOD_DURATION;}
 sample(now:number){const speedMs=Math.max(0,this.speedUntil-now),sizeMs=Math.max(0,this.sizeUntil-now);return {speed:speedMs?1.65:1,size:sizeMs?1.35:1,speedSeconds:Math.ceil(speedMs/1000),sizeSeconds:Math.ceil(sizeMs/1000),eating:Math.max(0,1-(now-this.eatenAt)/1300),food:this.food};}
 clear(){this.speedUntil=0;this.sizeUntil=0;this.eatenAt=-Infinity;}
}
