/* Video tab: play a clip, pin timed notes, jump back, copy YouTube chapters, export MP4 with chapters inside.
   Only note text is stored, never media. */
window.JahizReview=(()=>{
 const KEY='jahiz.review.v1',MAX_CLIPS=60,MAX_NOTES=500,MAX_TEXT=1000,TAGS={key:'مهم',fix:'تعديل',idea:'فكرة'};
 const pad=n=>String(n).padStart(2,'0');
 /* Arabic counting: 1 ملاحظة واحدة، 2 ملاحظتين، 3-10 ملاحظات، 11+ ملاحظة */
 const count=(n,[one,two,few,many])=>n===1?one:n===2?two:n>=3&&n<=10?n+' '+few:n+' '+many;
 const NOTES=['ملاحظة وحدة','ملاحظتين','ملاحظات','ملاحظة'];
 const fmt=s=>{s=Math.max(0,Math.floor(Number(s)||0));const h=Math.floor(s/3600);return (h?h+':'+pad(Math.floor(s%3600/60)):pad(Math.floor(s/60)))+':'+pad(s%60)};
 /* search ignores harakat and hamza/taa-marbuta spelling differences */
 const norm=s=>s.toLowerCase().replace(/[\u064B-\u0652\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').trim();
 const clipKey=(file,duration)=>[file.name,file.size,Math.round(duration||0)].join('|');
 const rid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
 const clean=list=>(Array.isArray(list)?list:[]).filter(n=>n&&typeof n.text==='string'&&n.text.trim()&&Number.isFinite(n.t)&&n.t>=0).slice(0,MAX_NOTES)
  .map(n=>({id:typeof n.id==='string'?n.id:rid(),t:n.t,tag:TAGS[n.tag]?n.tag:'key',text:n.text.slice(0,MAX_TEXT)})).sort((a,b)=>a.t-b.t);
 function readStore(){
  try{const raw=JSON.parse(localStorage.getItem(KEY)||'{}');if(raw&&raw.clips&&typeof raw.clips==='object'&&!Array.isArray(raw.clips))return raw}catch(e){}
  return {clips:{}};
 }
 function writeStore(store){
  const keys=Object.keys(store.clips).sort((a,b)=>(store.clips[b].updated||0)-(store.clips[a].updated||0));
  keys.slice(MAX_CLIPS).forEach(k=>delete store.clips[k]);
  try{localStorage.setItem(KEY,JSON.stringify(store));return true}catch(e){return false}
 }
 /* YouTube rules: first chapter at 0:00, at least 3, each at least 10 seconds long. */
 function chapters(notes,duration){
  const kept=[];let skipped=0;
  [...notes].sort((a,b)=>a.t-b.t).forEach(n=>{
   const title=n.text.split('\n')[0].replace(/\s+/g,' ').trim().slice(0,90);
   if(!title)return;
   const t=kept.length?Math.floor(n.t):(n.t<10?0:Math.floor(n.t));
   if(!kept.length&&t>0)kept.push({t:0,title:'البداية'});
   if(kept.length&&t-kept[kept.length-1].t<10){skipped++;return}
   if(duration&&duration-t<10){skipped++;return}
   kept.push({t,title});
  });
  return {text:kept.map(c=>fmt(c.t)+' '+c.title).join('\n'),count:kept.length,skipped,tooFew:kept.length<3};
 }
 /* chapters stored in the MP4: a note in the first 5 seconds becomes 0:00, no zero-length entries, no YouTube 10-second rule */
 function fileChapters(notes,duration){
  const out=[];
  [...notes].sort((a,b)=>a.t-b.t).forEach(n=>{
   const title=n.text.split('\n')[0].replace(/\s+/g,' ').trim().slice(0,200);
   if(!title||(duration&&n.t>=duration-.5))return;
   const t=out.length?n.t:(n.t<5?0:n.t);
   if(!out.length&&t>0)out.push({t:0,title:'البداية'});
   if(out.length&&t-out[out.length-1].t<1)return;
   out.push({t,title});
  });
  return out;
 }

 function init(){
  const $=id=>document.getElementById(id),pane=$('pane-vid');
  if(!pane)return;
  const video=$('rvVideo'),tl=$('rvTl'),text=$('rvText'),list=$('rvList');
  const st={file:null,url:'',key:'',notes:[],pending:null,editing:null,filter:'all',query:'',undo:null,undoT:0,stored:true};
  const dur=()=>Number.isFinite(video.duration)?video.duration:0;
  const tagPick=group=>group.querySelector('[aria-pressed="true"]').dataset.v;
  function pick(group,v){group.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.v===v)))}
  function tagButtons(selected){
   const g=document.createElement('div');g.className='rv-tags';
   Object.entries(TAGS).forEach(([v,label])=>{const b=document.createElement('button');b.type='button';b.className='rv-tag';b.dataset.v=v;b.innerHTML='<i></i>';b.append(label);b.setAttribute('aria-pressed',String(v===selected));g.append(b)});
   g.addEventListener('click',e=>{const b=e.target.closest('button');if(b)pick(g,b.dataset.v)});
   return g;
  }

  function persist(){
   if(!st.key)return;
   const store=readStore();
   if(st.notes.length)store.clips[st.key]={name:st.file.name,size:st.file.size,duration:dur(),updated:Date.now(),notes:st.notes};
   else delete store.clips[st.key];
   st.stored=writeStore(store);
   $('rvStoreHint').textContent=st.stored?'الملاحظات تنحفظ على هالجهاز بس، وترجع لما تفتح نفس الملف.':'المتصفح ما سمح بحفظ الملاحظات. انسخها قبل ما تسكّر الصفحة.';
   $('rvStoreHint').classList.toggle('rv-warn',!st.stored);
  }

  function renderRecent(){
   const clips=Object.entries(readStore().clips).sort((a,b)=>(b[1].updated||0)-(a[1].updated||0)),ul=$('rvRecentList');
   ul.replaceChildren();
   clips.forEach(([k,c])=>{
    const li=document.createElement('li'),name=document.createElement('span'),info=document.createElement('small'),del=document.createElement('button');
    name.textContent=c.name;name.title=c.name;
    info.textContent=count(c.notes?.length||0,NOTES)+' · '+new Date(c.updated||0).toLocaleDateString('ar-QA-u-nu-latn',{day:'numeric',month:'short'});
    del.type='button';del.className='rv-btn small';del.textContent='حذف ملاحظاته';
    del.onclick=()=>{if(del.dataset.sure){const s=readStore();delete s.clips[k];writeStore(s);renderRecent()}else{del.dataset.sure='1';del.textContent='أكيد؟ اضغط مرة ثانية'}};
    const box=document.createElement('div');box.style.minWidth='0';box.append(name);
    li.append(box,info,del);ul.append(li);
   });
   $('rvRecent').hidden=!clips.length||!!st.file;
  }

  /* playback */
  function sync(){
   const d=dur(),pct=d?video.currentTime/d*100:0;
   $('rvFill').style.width=pct+'%';$('rvHead').style.right=pct+'%';
   $('rvClock').textContent=fmt(video.currentTime)+' / '+fmt(d);
   tl.setAttribute('aria-valuenow',String(Math.floor(video.currentTime)));tl.setAttribute('aria-valuetext',fmt(video.currentTime));
   if(st.pending===null)$('rvAt').textContent=fmt(video.currentTime);
   const cur=st.notes.reduce((a,n)=>n.t<=video.currentTime+.25?n:a,null);
   list.querySelectorAll('.rv-note').forEach(el=>el.classList.toggle('cur',!!cur&&el.dataset.id===cur.id));
  }
  function seek(t){const d=dur();video.currentTime=Math.min(Math.max(0,t),d||t);sync()}
  function toggle(){if(video.paused)video.play().catch(()=>{});else video.pause()}
  video.addEventListener('timeupdate',sync);video.addEventListener('seeked',sync);video.addEventListener('durationchange',()=>{renderPins();sync()});
  video.addEventListener('play',()=>{$('rvPlay').textContent='❚❚ إيقاف'});
  video.addEventListener('pause',()=>{$('rvPlay').textContent='▶ تشغيل'});
  video.addEventListener('click',toggle);
  $('rvPlay').onclick=toggle;$('rvBack').onclick=()=>seek(video.currentTime-5);$('rvFwd').onclick=()=>seek(video.currentTime+5);
  const speeds=[1,1.5,2];
  $('rvSpeed').onclick=()=>{video.playbackRate=speeds[(speeds.indexOf(video.playbackRate)+1)%speeds.length];$('rvSpeed').textContent=video.playbackRate+'×'};
  $('rvFull').onclick=()=>{video.controls=true;(video.requestFullscreen||video.webkitEnterFullscreen||(()=>{})).call(video)};
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement)video.controls=false});
  function fromPointer(e){const r=tl.getBoundingClientRect();seek((r.right-e.clientX)/r.width*dur())}
  tl.addEventListener('pointerdown',e=>{if(e.target.closest('.rv-pin')||!dur())return;tl.setPointerCapture(e.pointerId);fromPointer(e)});
  tl.addEventListener('pointermove',e=>{if(tl.hasPointerCapture(e.pointerId))fromPointer(e)});
  tl.addEventListener('keydown',e=>{const step={ArrowLeft:5,ArrowRight:-5,Home:-Infinity,End:Infinity}[e.key];if(step===undefined)return;e.preventDefault();seek(Number.isFinite(step)?video.currentTime+step:step<0?0:dur())});

  /* notes */
  function renderPins(){
   tl.querySelectorAll('.rv-pin').forEach(p=>p.remove());
   const d=dur();if(!d)return;
   st.notes.forEach(n=>{
    const p=document.createElement('button');p.type='button';p.className='rv-pin';p.dataset.tag=n.tag;p.style.right=Math.min(100,n.t/d*100)+'%';
    p.title=fmt(n.t)+' — '+n.text.split('\n')[0];p.setAttribute('aria-label','روح لـ '+fmt(n.t));
    p.onclick=()=>seek(n.t);tl.append(p);
   });
  }
  function visible(){const q=norm(st.query).replace(/^ال/,'');return st.notes.filter(n=>(st.filter==='all'||n.tag===st.filter)&&(!q||norm(n.text).includes(q)))}
  function renderList(){
   const shown=visible();list.replaceChildren();
   $('rvCount').textContent=st.notes.length?(shown.length===st.notes.length?count(st.notes.length,NOTES):shown.length+' من '+st.notes.length):'';
   if(!shown.length){const e=document.createElement('div');e.className='empty';e.textContent=st.notes.length?'ما فيه ملاحظات تطابق البحث.':'ما فيه ملاحظات للحين. شغّل المقطع واكتب أول ملاحظة.';list.append(e)}
   shown.forEach(n=>{
    const row=document.createElement('div');row.className='rv-note';row.dataset.id=n.id;
    const t=document.createElement('button');t.type='button';t.className='t';t.textContent=fmt(n.t);t.setAttribute('aria-label','روح لـ '+fmt(n.t));
    row.append(t);
    if(st.editing===n.id){
     const box=document.createElement('div');box.className='rv-edit';
     const ta=document.createElement('textarea');ta.value=n.text;ta.maxLength=MAX_TEXT;
     const tags=tagButtons(n.tag),acts=document.createElement('div');acts.className='rv-row';
     let newT=n.t;
     const ok=document.createElement('button'),no=document.createElement('button'),re=document.createElement('button');
     ok.type=no.type=re.type='button';ok.className='rv-btn small blue';ok.textContent='حفظ';no.className=re.className='rv-btn small';no.textContent='إلغاء';re.textContent='خذ الوقت الحالي';
     re.onclick=()=>{newT=video.currentTime;t.textContent=fmt(newT)};
     ok.onclick=()=>{const v=ta.value.trim();if(!v){ta.focus();return}Object.assign(n,{text:v.slice(0,MAX_TEXT),tag:tagPick(tags),t:newT});st.notes.sort((a,b)=>a.t-b.t);st.editing=null;changed()};
     no.onclick=()=>{st.editing=null;renderList();sync()};
     ta.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();ok.click()}if(e.key==='Escape')no.click()});
     acts.append(ok,no,re);box.append(ta,tags,acts);row.append(box);list.append(row);queueMicrotask(()=>ta.focus());return;
    }
    const tx=document.createElement('div');tx.className='tx';tx.textContent=n.text;
    const meta=document.createElement('div');meta.className='rv-meta';
    const dot=document.createElement('span'),i=document.createElement('i');i.dataset.tag=n.tag;dot.append(i,' '+TAGS[n.tag]);
    const ed=document.createElement('button'),del=document.createElement('button');ed.type=del.type='button';ed.textContent='تعديل';del.textContent='حذف';
    ed.onclick=e=>{e.stopPropagation();st.editing=n.id;renderList()};
    del.onclick=e=>{e.stopPropagation();remove(n)};
    meta.append(dot,ed,del);row.append(tx,meta);
    row.addEventListener('click',()=>seek(n.t));
    list.append(row);
   });
   sync();
  }
  function changed(){persist();renderPins();renderList();$('rvChapBox').hidden=true;stale()}
  function remove(n){
   st.notes=st.notes.filter(x=>x!==n);st.undo=n;changed();
   $('rvUndo').hidden=false;clearTimeout(st.undoT);st.undoT=setTimeout(()=>{$('rvUndo').hidden=true;st.undo=null},8000);
  }
  $('rvUndoBtn').onclick=()=>{if(!st.undo)return;st.notes.push(st.undo);st.notes.sort((a,b)=>a.t-b.t);st.undo=null;$('rvUndo').hidden=true;changed()};

  /* composer: the moment you start a note, the clip pauses and the time is held */
  const pickTag=$('rvTagPick');pickTag.addEventListener('click',e=>{const b=e.target.closest('button');if(b)pick(pickTag,b.dataset.v)});
  function hold(){if(st.pending===null){st.pending=video.currentTime;$('rvAt').textContent=fmt(st.pending)}video.pause()}
  text.addEventListener('focus',()=>{if(st.file)hold()});text.addEventListener('input',()=>{if(st.file)hold()});
  $('rvRetime').onclick=()=>{st.pending=video.currentTime;$('rvAt').textContent=fmt(st.pending)};
  function addNote(){
   const v=text.value.trim();if(!st.file)return;
   if(!v){text.focus();return}
   if(st.notes.length>=MAX_NOTES){$('rvStoreHint').textContent='وصلت حد '+MAX_NOTES+' ملاحظة لهالمقطع.';return}
   st.notes.push({id:rid(),t:st.pending??video.currentTime,tag:tagPick(pickTag),text:v.slice(0,MAX_TEXT)});st.notes.sort((a,b)=>a.t-b.t);
   text.value='';st.pending=null;text.blur();changed();
  }
  $('rvSave').onclick=addNote;
  text.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)){e.preventDefault();addNote()}if(e.key==='Escape')text.blur()});

  /* filter, search, export */
  const filt=$('rvFilter');filt.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;pick(filt,b.dataset.v);st.filter=b.dataset.v;renderList()});
  $('rvSearch').addEventListener('input',e=>{st.query=e.target.value;renderList()});
  $('rvCopy').onclick=async()=>{
   const shown=visible(),c=chapters(shown,dur()),box=$('rvChapters'),msg=$('rvChapMsg');
   $('rvChapBox').hidden=false;box.value=c.text;
   if(!shown.length){msg.textContent='ما فيه ملاحظات ظاهرة عشان تنسخها.';msg.classList.add('rv-warn');return}
   const notes=[];if(c.skipped)notes.push('تخطّيت '+count(c.skipped,NOTES)+' لأن الفرق أقل من 10 ثواني');if(c.tooFew)notes.push('يوتيوب يبي 3 فصول على الأقل');
   let copied=false;try{await navigator.clipboard.writeText(c.text);copied=true}catch(e){box.focus();box.select()}
   msg.textContent=(copied?'انتسخت '+count(c.count,['فصل واحد','فصلين','فصول','فصل'])+'. الصقها في وصف اليوتيوب.':'انسخ النص من المربع.')+(notes.length?' '+notes.join('، ')+'.':'');
   msg.classList.toggle('rv-warn',c.tooFew);
  };


  /* export: MP4 (H.264/AAC), original or 1080/720 long edge; chapters written into the file afterwards */
  const ex={conv:null,blob:null,name:'',info:'',url:'',run:0};
  const MBP=()=>window.__jahizMB||(window.__jahizMB=import('https://cdn.jsdelivr.net/npm/mediabunny@1.61.1/dist/bundles/mediabunny.min.mjs'));
  const fmtMB=b=>b<1048576?Math.max(1,Math.round(b/1024))+' KB':(b/1048576).toFixed(1)+' MB';
  const even=n=>Math.max(2,Math.round(n/2)*2);
  /* one button: prepare (progress shown) then save straight away; a finished file is reused until something changes */
  const dlBtn=$('rvDl'),dlLabel=()=>'تنزيل الفيديو'+(ex.blob?' · ⁦'+fmtMB(ex.blob.size)+'⁩':'');
  function stale(){ex.blob=null;dlBtn.textContent=dlLabel();if(!ex.conv)$('rvDlMsg').textContent=''}
  function cancelExport(){ex.run++;if(ex.conv)ex.conv.cancel()}
  const resGroup=$('rvRes');
  resGroup.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;pick(resGroup,b.dataset.v);stale();window.JahizPrefs?.save()});
  $('rvChap').addEventListener('change',stale);
  $('rvCancel').onclick=cancelExport;
  async function prepare(){
   const run=++ex.run,file=st.file,res=resGroup.querySelector('[aria-pressed="true"]').dataset.v,msg=$('rvDlMsg');
   const chapList=$('rvChap').checked?fileChapters(visible(),dur()):[];
   stale();msg.classList.remove('rv-warn');msg.textContent='';
   dlBtn.disabled=true;dlBtn.textContent='جاري التجهيز…';$('rvProg').hidden=false;$('rvBar').style.width='0%';$('rvPct').textContent='0%';
   try{
    const MB=await MBP().catch(()=>null);
    if(!MB)throw new Error('مكتبة الفيديو ما تحمّلت. تأكد من الإنترنت وجرّب مرة ثانية.');
    if(run!==ex.run)return false;
    const input=new MB.Input({source:new MB.BlobSource(file),formats:MB.ALL_FORMATS});
    const track=await input.getPrimaryVideoTrack();
    if(!track)throw new Error('ما لقينا صورة في هالملف.');
    const output=new MB.Output({format:new MB.Mp4OutputFormat(),target:new MB.BufferTarget()});
    let video={codec:'avc'};
    if(res!=='orig'){
     const long=res==='1080'?1920:1280,w=track.displayWidth,h=track.displayHeight,k=Math.min(1,long/Math.max(w,h));
     if(k<1)video={codec:'avc',width:even(w*k),height:even(h*k),fit:'contain',allowTransformationMetadata:false};
    }
    ex.conv=await MB.Conversion.init({input,output,showWarnings:false,video,audio:{codec:'aac'}});
    if(run!==ex.run)return false;
    const lost=ex.conv.discardedTracks||[];
    if(!ex.conv.isValid||lost.some(d=>d.track.type==='video'))throw new Error('المتصفح ما يقدر يحوّل هالمقطع لـ MP4. جرّب Chrome أو Safari الحديث.');
    ex.conv.onProgress=p=>{if(run!==ex.run)return;const pc=Math.round(p*100);$('rvBar').style.width=pc+'%';$('rvPct').textContent=pc+'%'};
    await ex.conv.execute();
    if(run!==ex.run)return false;
    let parts=[output.target.buffer];
    if(chapList.length)parts=window.JahizMp4Chapters.add(new Uint8Array(output.target.buffer),chapList,dur());
    ex.blob=new Blob(parts,{type:'video/mp4'});
    ex.name=file.name.replace(/\.[^.]+$/,'')+(res==='orig'?'':'-'+res+'p')+'-جاهز.mp4';
    ex.info=[chapList.length?'فيه '+count(chapList.length,['فاصل واحد','فاصلين','فواصل','فاصل']):'بدون فواصل',lost.some(d=>d.track.type==='audio')?'انشال الصوت لأن المتصفح ما يقدر يحوّله':''].filter(Boolean).join(' · ');
    msg.classList.toggle('rv-warn',lost.some(d=>d.track.type==='audio'));
    return true;
   }catch(e){
    if(run!==ex.run||e?.name==='ConversionCanceledError'){msg.textContent='انلغى التنزيل.';return false}
    console.error(e);msg.classList.add('rv-warn');msg.textContent=e?.message&&/[؀-ۿ]/.test(e.message)?e.message:'ما قدرنا نجهّز الفيديو. جرّب 720p أو ملف ثاني.';
    return false;
   }finally{ex.conv=null;$('rvProg').hidden=true;dlBtn.disabled=false;dlBtn.textContent=dlLabel()}
  }
  async function save(){
   const msg=$('rvDlMsg'),done=ex.info+'. لو ما طلع الملف، اضغط «تنزيل الفيديو» مرة ثانية.';
   let dl=null;try{dl=window.claude&&claude.use?await claude.use('downloads'):null}catch(e){}
   if(!dl){
    if(ex.url)URL.revokeObjectURL(ex.url);ex.url=URL.createObjectURL(ex.blob);
    const a=document.createElement('a');a.href=ex.url;a.download=ex.name;document.body.append(a);a.click();a.remove();
    msg.textContent=done;return;
   }
   try{await dl.save({filename:ex.name,data:ex.blob});msg.textContent=done}catch(e){if(e?.code!=='declined')msg.textContent=e?.code==='too_large'?'الملف كبير على التنزيل هنا، جرّب 720p.':'ما قدرنا ننزّل الملف.'}
  }
  dlBtn.onclick=async()=>{
   if(!st.file||ex.conv)return;
   if(ex.blob||await prepare())await save();
  };

  /* file */
  function open(f){
   if(!f)return;
   if(!/^video\//.test(f.type)&&!/\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name)){$('rvError').textContent='اختر ملف فيديو.';return}
   $('rvError').textContent='';
   if(st.url)URL.revokeObjectURL(st.url);
   Object.assign(st,{file:f,url:URL.createObjectURL(f),key:'',notes:[],pending:null,editing:null,undo:null});
   text.value='';$('rvUndo').hidden=true;$('rvChapBox').hidden=true;cancelExport();stale();
   $('rvName').textContent=f.name;video.playbackRate=1;$('rvSpeed').textContent='1×';
   video.src=st.url;$('rvWork').hidden=false;$('rvDrop').classList.add('compact');renderRecent();
   video.addEventListener('loadedmetadata',()=>{
    st.key=clipKey(f,dur());st.notes=clean(readStore().clips[st.key]?.notes);
    persist();renderPins();renderList();
   },{once:true});
   renderList();
  }
  video.addEventListener('error',()=>{if(st.file)$('rvError').textContent='المتصفح ما قدر يشغّل هالملف. جرّب MP4 أو MOV من الجوال.'});
  $('rvInput').addEventListener('change',e=>{open(e.target.files[0]);e.target.value=''});
  const dz=$('rvDrop');
  ['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('over')}));
  ['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('over')}));
  dz.addEventListener('drop',e=>open(e.dataTransfer.files[0]));

  /* keys: Space plays, N starts a note (any keyboard layout); only while this tab is open */
  document.addEventListener('keydown',e=>{
   if(pane.hidden||!st.file||e.metaKey||e.ctrlKey||e.altKey)return;
   if(e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
   if(e.code==='KeyN'){e.preventDefault();text.focus()}
   else if(e.code==='Space'&&!e.target.closest('button')){e.preventDefault();toggle()}
  });
  document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{if(t.getAttribute('aria-controls')!=='pane-vid')video.pause()}));
  renderRecent();
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
 return {KEY,fmt,count,norm,clipKey,clean,chapters,fileChapters};
})();
