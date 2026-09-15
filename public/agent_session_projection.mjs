const COPY={
 'en-US':{title:'Work projection',live:'Live session · refreshes every 1.5s',observed:'Observed history · hook connection',events:'Hook events',empty:'Waiting for public output…',error:'Connection interrupted · showing last received output',follow:'Follow latest output',note:'Public messages and tool output. Activity rhythm indicates work type, not CPU usage.'},
 'zh-TW':{title:'即時工作投影',live:'即時對話 · 每 1.5 秒更新',observed:'已觀測歷史 · Hook 連線',events:'Hook 活動紀錄',empty:'等待公開工作內容…',error:'連線中斷 · 保留最後收到的內容',follow:'跟隨最新輸出',note:'顯示公開訊息與工具輸出。心跳節奏表示工作類型，並非 CPU 使用率。'},
 'ja-JP':{title:'作業ライブビュー',live:'ライブ · 1.5秒ごとに更新',observed:'観測履歴 · Hook 接続',events:'Hook イベント',empty:'公開出力を待っています…',error:'接続中断 · 最新の受信内容を表示',follow:'最新の出力を追従',note:'公開メッセージとツール出力。波形は作業種別を示し、CPU 使用率ではありません。'},
 'ko-KR':{title:'실시간 작업 보기',live:'실시간 · 1.5초마다 갱신',observed:'관측 기록 · Hook 연결',events:'Hook 이벤트',empty:'공개 출력 대기 중…',error:'연결 끊김 · 마지막 수신 내용 표시',follow:'최신 출력 따라가기',note:'공개 메시지와 도구 출력입니다. 파형은 작업 유형이며 CPU 사용률이 아닙니다.'},
};
export function projectionText(messages=[]){return messages.filter(m=>['user','assistant','tool'].includes(m.role)&&typeof m.text==='string').slice(-60).map(m=>`${m.role==='user'?'>':m.role==='assistant'?'●':'$'} ${m.text}`).join('\n\n').slice(-64000);}
export function createSessionProjection({root,fetcher=globalThis.fetch,locale=()=>document.documentElement.lang,setTimer=setTimeout,clearTimer=clearTimeout}={}){
 if(!root)return {select(){},close(){},destroy(){}};
 const doc=root.ownerDocument;
 const title=doc.createElement('strong'),status=doc.createElement('span'),output=doc.createElement('pre'),follow=doc.createElement('button'),note=doc.createElement('small');
 root.className='agent-session-projection';status.className='projection-status';output.className='projection-output';output.tabIndex=0;output.dataset.externalCopy='true';follow.type='button';note.className='projection-note';
 root.append(title,status,output,follow,note);
 let id='',generation=0,timer,abort,latest='',events='',following=true;
 const copy=()=>COPY[locale()]||COPY['en-US'];
 const localize=()=>{title.textContent=copy().title;follow.textContent=copy().follow;note.textContent=copy().note;output.setAttribute('aria-label',copy().title);};
 const draw=text=>{const value=text||events||copy().empty;if(output.textContent!==value){const top=output.scrollTop;output.textContent=value;if(following)output.scrollTop=output.scrollHeight;else output.scrollTop=top;}follow.hidden=following;};
 const scroll=()=>{following=output.scrollHeight-output.clientHeight-output.scrollTop<28;follow.hidden=following;};
 output.addEventListener('scroll',scroll);
 follow.onclick=()=>{following=true;output.scrollTop=output.scrollHeight;follow.hidden=true;};
 const close=()=>{generation++;id='';clearTimer(timer);abort?.abort();abort=undefined;};
 const poll=async(token,agent)=>{
  abort=new AbortController();const controller=abort;
  const timeout=setTimer(()=>controller.abort(),8000);
  try{
   const response=await fetcher(`/api/agent-session/${encodeURIComponent(agent)}`,{signal:controller.signal,cache:'no-store'});
   if(!response.ok)throw new Error('session unavailable');
   const data=await response.json();if(token!==generation)return;
   latest=projectionText(data.messages);status.textContent=data.available?copy().live:latest?copy().observed:copy().events;
   root.dataset.connected='true';draw(latest);
  }catch(error){if(token!==generation)return;status.textContent=copy().error;root.dataset.connected='false';draw(latest);}
  finally{clearTimer(timeout);if(token===generation)timer=setTimer(()=>poll(token,agent),1500);}
 };
 return {
  select(detail){
   localize();events=(detail.recentEvents||[]).slice().reverse().map(e=>e.summary||e.preview||e.message||e.event||e.type||'').filter(Boolean).join('\n');
   if(id===detail.id){draw(latest);return;}
   close();id=detail.id;latest='';following=true;status.textContent=copy().empty;draw('');poll(generation,id);
  },close,destroy(){close();output.removeEventListener('scroll',scroll);root.replaceChildren();},
 };
}
