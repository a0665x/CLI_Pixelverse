from pathlib import Path
import json
p=Path('private_assets/free-office');(p/'sprites').mkdir(parents=True,exist_ok=True)
wood='#b99b70';dark='#665643';trim='#dbc69b';sage='#789785';light='#a8bba2';ink='#344c47'
def rect(x,y,w,h,c,r=1):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{c}"/>'
def line(x,y,xx,yy,c=trim):return f'<path d="M{x} {y}L{xx} {yy}" stroke="{c}" stroke-width="1"/>'
def desktop():return rect(7,35,4,25,dark)+rect(53,35,4,25,dark)+rect(3,24,58,17,dark,3)+rect(4,23,56,13,wood,3)+line(7,26,56,26)
def screen():return rect(28,18,5,14,dark)+rect(21,29,19,3,ink)+rect(13,3,36,24,ink,3)+rect(16,6,30,17,'#99c2b0',1)+line(19,10,40,10,'#f0e8c6')+line(19,14,34,14,'#e0d9b7')
art={}
art['desk']=desktop()+rect(8,28,15,6,'#e4ddbc')+rect(48,24,7,8,sage,2)
art['computer']=desktop()+screen()+rect(21,33,23,4,'#d9d6b6')+rect(47,32,4,5,ink)
art['display']=screen()
art['chair']=rect(28,37,7,15,dark)+line(12,56,51,56,dark)+rect(10,52,7,8,ink,3)+rect(46,52,7,8,ink,3)+rect(13,3,38,28,dark,8)+rect(16,5,32,23,light,7)+rect(10,26,44,16,ink,6)+rect(13,26,38,12,sage,6)
art['sofa']=rect(8,50,6,9,dark)+rect(50,50,6,9,dark)+rect(5,9,54,36,dark,8)+rect(8,10,48,26,light,7)+rect(4,28,56,25,sage,7)+rect(9,31,21,15,light,4)+rect(33,31,21,15,light,4)+rect(1,27,9,25,'#607d6d',4)+rect(54,27,9,25,'#607d6d',4)+rect(41,19,10,11,'#ddc28a',3)
books=rect(5,2,54,58,dark,2)+rect(9,5,46,51,'#526b59')
for row in range(3):
 for i in range(7):books+=rect(11+i*6,7+row*16+(i%2)*2,4,12-(i%2)*2,[sage,'#bc805f','#d2bd82','#94aaa8'][i%4])+line(12+i*6,10+row*16,13+i*6,10+row*16)
 books+=rect(8,20+row*16,48,3,wood)
art['bookcase']=books+rect(4,1,56,4,trim)
art['cabinet']=rect(6,7,52,50,dark,2)+rect(8,7,48,4,trim)+rect(9,13,21,39,wood)+rect(33,13,22,39,wood)+rect(25,28,2,8,trim)+rect(36,28,2,8,trim)
art['board']=rect(10,42,4,18,dark)+rect(50,42,4,18,dark)+rect(2,4,60,43,dark,3)+rect(5,7,54,37,'#dcdcc0')
for i in range(6):art['board']+=rect(9+(i%3)*16,12+(i//3)*15,11,9,[sage,'#c4ab71','#b99179'][i%3])
art['plant']=rect(19,40,26,20,'#b5815d',4)+rect(17,39,30,5,'#d0a273')+rect(30,11,4,29,dark)
for x,y,rot in [(21,26,-25),(41,21,25),(23,11,-40),(38,7,30)]:art['plant']+=f'<ellipse cx="{x}" cy="{y}" rx="12" ry="7" fill="{sage if x<30 else light}" transform="rotate({rot} {x} {y})"/>'
art['bed']=rect(4,3,56,57,dark,3)+rect(7,7,50,46,'#e4dec1',5)+rect(12,8,40,12,'#f2ecd4',4)+rect(7,23,50,31,sage,4)+rect(8,24,48,4,light)+line(12,32,52,32,light)
art['printer']=rect(12,4,39,16,'#dddcc3')+rect(5,17,54,34,ink,4)+rect(8,20,48,17,'#a4b3a0',3)+rect(14,38,35,16,'#e8e2c5')+line(18,42,43,42,dark)+rect(47,25,5,4,sage)
art['coffee']=rect(9,9,46,44,dark,3)+rect(13,12,38,10,sage)+rect(18,26,27,23,ink)+rect(23,34,15,14,'#e9dcc0',3)+rect(25,27,5,7,trim)+rect(8,52,48,5,wood)

model_families=list(art)
art['papers']='<rect x="8" y="19" width="42" height="29" rx="2" fill="#b4a47e"/><rect x="13" y="14" width="42" height="29" rx="2" fill="#eee4c3"/><path d="M19 22H47M19 28H43M19 34H39" stroke="#8b9e87" stroke-width="2"/>'
art['keyboard']='<rect x="3" y="22" width="58" height="23" rx="4" fill="#52695e"/><rect x="8" y="27" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="15" y="27" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="22" y="27" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="29" y="27" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="36" y="27" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="43" y="27" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="50" y="27" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="8" y="33" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="15" y="33" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="22" y="33" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="29" y="33" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="36" y="33" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="43" y="33" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="50" y="33" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="8" y="39" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="15" y="39" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="22" y="39" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="29" y="39" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="36" y="39" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="43" y="39" width="5" height="4" rx="1" fill="#c5d0b4"/><rect x="50" y="39" width="5" height="4" rx="1" fill="#c5d0b4"/>'
art['lamp']='<ellipse cx="32" cy="55" rx="18" ry="5" fill="#6a745c"/><path d="M32 54V22L44 13" fill="none" stroke="#776544" stroke-width="4"/><path d="M35 9Q51 4 57 22H33Z" fill="#c6ad6f"/><ellipse cx="44" cy="22" rx="12" ry="3" fill="#efdda3"/>'
art['divider']='<rect x="3" y="9" width="58" height="46" rx="4" fill="#607d70"/><rect x="6" y="12" width="52" height="38" rx="3" fill="#9fb29b"/><path d="M5 53H60" stroke="#d7c39a" stroke-width="3"/>'
for name,body in art.items():
 (p/'sprites'/f'{name}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g stroke-linejoin="round">{body}</g></svg>')
(p/'manifest.json').write_text(json.dumps({'id':'woodland-office','version':'1.1.0','name':'Woodland Office','license':'CC0-1.0','palette':{'wood':wood,'frame':dark,'trim':trim,'fabric':sage,'cushion':light,'screen':ink},'families':list(art),'modelFamilies':model_families},indent=2)+'\n')
(p/'preview.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" width="768" height="470" viewBox="0 0 768 470"><rect width="768" height="470" fill="#eee5cc"/>'+''.join(f'<g transform="translate({(i%6)*128+32} {(i//6)*150+14})">{body}<text x="32" y="88" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#344c47">{name}</text></g>' for i,(name,body) in enumerate(art.items()))+'</svg>')
