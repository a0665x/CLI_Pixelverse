from pathlib import Path
p=Path(__file__).parent/'sprites'
coats=['#d8ac73','#b6ab93','#d3a091','#b1b18a','#b9a19c','#d5b984']
for index,fur in enumerate(coats):
 frames=[]
 for row in range(6):
  for facing in range(4):
   x=facing*64;y=row*64;step=0 if row in (0,5) else [0,-2,0,2][row-1];back=facing==1;side=facing in (2,3)
   body=f'<ellipse cx="32" cy="56" rx="18" ry="4" fill="#354c42" opacity=".16"/>'
   body+=f'<g transform="translate(0 {abs(step)*-.4})'+ (' rotate(-75 32 39)' if row==5 else '')+'">'
   body+=f'<ellipse cx="32" cy="42" rx="15" ry="16" fill="{fur}"/><ellipse cx="32" cy="44" rx="10" ry="10" fill="#e9cf9e"/>'
   body+=f'<path d="M21 32 Q32 38 43 32 L44 47 Q35 52 32 45 Q25 52 20 47Z" fill="#738065"/><path d="M32 35V47" stroke="#c5bb83" stroke-width="1.5"/>'
   body+=f'<ellipse cx="24" cy="56" rx="7" ry="4" fill="{fur}" transform="translate(0 {step})"/><ellipse cx="40" cy="56" rx="7" ry="4" fill="{fur}" transform="translate(0 {-step})"/>'
   body+=f'<ellipse cx="32" cy="23" rx="17" ry="15" fill="{fur}"/><ellipse cx="13" cy="25" rx="6" ry="18" fill="{fur}" transform="rotate(20 13 25)"/><ellipse cx="51" cy="25" rx="6" ry="18" fill="{fur}" transform="rotate(-20 51 25)"/>'
   if not back:
    eyes=[25,39] if not side else ([23] if facing==2 else [41])
    for eye in eyes:body+=f'<circle cx="{eye}" cy="23" r="6.2" fill="none" stroke="#635443" stroke-width="1.5"/><ellipse cx="{eye}" cy="23" rx="2" ry="3" fill="#37312b"/><circle cx="{eye-.6}" cy="22" r=".7" fill="#fff7da"/>'
    if not side:body+='<path d="M31 23H33" stroke="#635443" stroke-width="1.5"/>'
    nose=32 if not side else (16 if facing==2 else 48)
    body+=f'<ellipse cx="{nose}" cy="31" rx="7" ry="5" fill="#ead2a6"/><path d="M{nose-2} 29 Q{nose} 27 {nose+2} 29 L{nose} 31Z" fill="#8c6a50"/>'
   else:body+='<ellipse cx="32" cy="49" rx="5" ry="5" fill="#eee0b9"/>'
   body+='</g>';frames.append(f'<g transform="translate({x} {y})">{body}</g>')
 (p/f'rabbit-{index}.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="256" height="384" viewBox="0 0 256 384">'+''.join(frames)+'</svg>')

 (p/f'rabbit-portrait-{index}.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">'+frames[0]+'</svg>')
