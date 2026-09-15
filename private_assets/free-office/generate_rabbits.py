"""Original upright-ear rabbit sheets: idle, four walk beats and resting pose."""
from pathlib import Path
p=Path(__file__).parent/'sprites'
coats=['#ffe5ae','#cadbee','#f3bcbc','#c8dda5','#dac7ec','#e9cb9c']
outline='#56504b'
def ellipse(x,y,rx,ry,fill,stroke=True):
 return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{fill}" stroke="{outline if stroke else "none"}" stroke-width="1.7"/>'
for index,fur in enumerate(coats):
 frames=[]
 for row in range(8):
  for facing in range(4):
   step=0 if row in (0,5,6,7) else [0,-2,0,2][row-1]
   back=facing==1;side=facing in (2,3)
   body='<ellipse cx="32" cy="58" rx="14" ry="3" fill="#25272b" opacity=".18"/>'
   # Keep every pose inside its 64 px cell, including ears while resting.
   transform='translate(0 -1) rotate(-75 32 34)' if row==5 else f'translate(0 {-abs(step)*.3})'
   body+=f'<g transform="{transform}" stroke-linejoin="round" stroke-linecap="round">'
   body+=ellipse(25,13,5,10,fur)+ellipse(39,13,5,10,fur)
   body+=ellipse(25,12,2,6,'#eaafa5',False)+ellipse(39,12,2,6,'#eaafa5',False)
   body+=ellipse(32,44,13,12,fur)+ellipse(32,46,8,7,'#fff7df',False)
   body+=ellipse(24,56+step,6,3,fur)+ellipse(40,56-step,6,3,fur)
   body+=ellipse(32,30,13 if side else 17,14,fur)
   if not back:
    eyes=[25,39] if not side else ([23] if facing==2 else [41])
    for eye in eyes:
     if row in (5,6):body+=f'<path d="M{eye-2} 30h4" stroke="{outline}" stroke-width="1.5"/>'
     else:body+=ellipse(eye,29,2.6,3.5,outline,False)+ellipse(eye-.7,27.8,.8,1,'#ffffff',False)
    if not side:
     body+=ellipse(21,35,3,1.6,'#e9a398',False)+ellipse(43,35,3,1.6,'#e9a398',False)
    nose=32 if not side else (17 if facing==2 else 47)
    body+=f'<path d="M{nose-1.5} 34 Q{nose} 32 {nose+1.5} 34 L{nose} 36 M{nose} 36 q-2 3-4 0 M{nose} 36 q2 3 4 0" fill="none" stroke="{outline}" stroke-width="1.6"/>'
    body+=f'<path d="M22 43 Q32 47 42 43 L39 48 L33 47 L29 52 L26 47Z" fill="#66968d" stroke="{outline}" stroke-width="2"/>'
    body+=ellipse(20,44 if row==7 else 47-step,3,5,fur)+ellipse(44,44 if row==7 else 47+step,3,5,fur)
   else:body+=ellipse(32,49,5,5,'#fff7df')
   body+='</g>'
   frames.append(f'<svg x="{facing*64}" y="{row*64}" width="64" height="64" viewBox="0 0 64 64" overflow="hidden">{body}</svg>')
 (p/f'rabbit-{index}.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="512" viewBox="0 0 256 512">'+''.join(frames)+'</svg>')
 (p/f'rabbit-portrait-{index}.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">'+frames[0]+'</svg>')

import json
(p.parent/'rabbit-sheet.json').write_text(json.dumps({'frameWidth':64,'frameHeight':64,'columns':['down','up','left','right'],'rows':['idle','walk-contact-left','walk-pass-left','walk-contact-right','walk-pass-right','rest','blink','working'],'coats':coats,'outline':outline},indent=2)+'\n')
