import * as T from 'three';
/** Soft world-space puffs; one draw call, no per-frame geometry allocation. */
export function createGuideSmoke(){
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,uniforms:{time:{value:0},motion:{value:1}},vertexShader:`
 uniform float time; uniform float motion; attribute float phase; varying float puff;
 void main(){puff=phase;vec3 p=position;p.y+=sin(time*1.4+phase*6.283)*.08*motion;
 p.x+=sin(time*.8+phase*16.)*.045*motion;vec4 mv=modelViewMatrix*vec4(p,1.);
 gl_Position=projectionMatrix*mv;gl_PointSize=clamp(620./max(1.,-mv.z),3.,85.);}`,
 fragmentShader:`varying float puff;void main(){float r=length(gl_PointCoord-.5)*2.;float alpha=exp(-r*r*4.)*(1.-smoothstep(.65,1.,r))*.18;gl_FragColor=vec4(mix(vec3(.72,.88,.77),vec3(1.,.87,.56),puff),alpha);}`});
 return new T.Points(new T.BufferGeometry(),material);
}
export function smokeRoute(points:T.Vector3[]){const positions:number[]=[],phases:number[]=[];
 for(let i=1;i<points.length;i++){const a=points[i-1]!,b=points[i]!,count=Math.max(1,Math.ceil(a.distanceTo(b)/.20));for(let j=0;j<count;j++){const t=j/count,p=a.clone().lerp(b,t),phase=((i*31+j*17)%101)/101;positions.push(p.x+Math.sin(phase*32)*.12,p.y+.12+phase*.14,p.z+Math.cos(phase*32)*.12);phases.push(phase);}}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('phase',new T.Float32BufferAttribute(phases,1));return geometry;
}
