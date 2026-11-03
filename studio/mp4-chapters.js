/* Writes chapters into a finished MP4: a QuickTime chapter text track (QuickTime, Apple apps, ffmpeg)
   plus a Nero "chpl" list (VLC, mpv). Media samples are never touched; only offsets shift if moov grows. */
window.JahizMp4Chapters=(()=>{
 const enc=new TextEncoder();
 const u32=n=>[n>>>24&255,n>>>16&255,n>>>8&255,n&255],u16=n=>[n>>>8&255,n&255];
 const u64=n=>{const hi=Math.floor(n/4294967296),lo=n>>>0;return [...u32(hi),...u32(lo)]};
 const cc=s=>[...s].map(c=>c.charCodeAt(0));
 const cat=parts=>{const len=parts.reduce((s,p)=>s+p.length,0),out=new Uint8Array(len);let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out};
 const box=(type,...parts)=>{const body=cat(parts.map(p=>p instanceof Uint8Array?p:Uint8Array.from(p)));return cat([Uint8Array.from([...u32(body.length+8),...cc(type)]),body])};
 const full=(type,version,flags,...parts)=>box(type,[version,...u32(flags).slice(1)],...parts);
 function boxes(buf,start,end){
  const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength),list=[];let o=start;
  while(o+8<=end){
   let size=dv.getUint32(o),hdr=8;const type=String.fromCharCode(buf[o+4],buf[o+5],buf[o+6],buf[o+7]);
   if(size===1){size=dv.getUint32(o+8)*4294967296+dv.getUint32(o+12);hdr=16}else if(size===0)size=end-o;
   if(size<hdr||o+size>end)throw new Error('Bad MP4 box '+type);
   list.push({type,start:o,end:o+size,body:o+hdr});o+=size;
  }
  return list;
 }
 const child=(buf,b,type)=>boxes(buf,b.body,b.end).find(x=>x.type===type);
 /* utf-8 cut at a character boundary */
 function clip(text,max){let b=enc.encode(text);if(b.length<=max)return b;let n=max;while(n>0&&(b[n]&0xC0)===0x80)n--;return b.slice(0,n)}

 /* chapters: [{t:seconds,title}] sorted, first at 0. Returns Blob parts; the big media data is not copied. */
 function add(mp4,chapters,duration){
  if(!chapters.length)return [mp4];
  const top=boxes(mp4,0,mp4.length),moov=top.find(b=>b.type==='moov');
  if(!moov)throw new Error('No moov');
  const dv=new DataView(mp4.buffer,mp4.byteOffset,mp4.byteLength);
  const kids=boxes(mp4,moov.body,moov.end),mvhd=kids.find(b=>b.type==='mvhd'),traks=kids.filter(b=>b.type==='trak');
  const v1=mp4[mvhd.body]===1,movieScale=dv.getUint32(mvhd.body+(v1?20:12)),nextAt=mvhd.body+(v1?108:96),chapId=dv.getUint32(nextAt);
  const movieDur=Math.round(duration*movieScale);
  /* attach the chapter reference to the first video track (or the first track at all) */
  const handler=t=>{const md=child(mp4,t,'mdia'),h=md&&child(mp4,md,'hdlr');return h?String.fromCharCode(...mp4.subarray(h.body+8,h.body+12)):''};
  const host=traks.find(t=>handler(t)==='vide')||traks[0];
  const ms=1000,starts=chapters.map(c=>Math.round(c.t*ms)),total=Math.max(Math.round(duration*ms),starts[starts.length-1]+1);
  const samples=chapters.map(c=>{const t=clip(c.title,1000);return cat([Uint8Array.from(u16(t.length)),t,Uint8Array.from([0,0,0,12,...cc('encd'),0,0,1,0])])});
  const durs=starts.map((s,i)=>(i+1<starts.length?starts[i+1]:total)-s);
  const matrix=[...u32(0x10000),...u32(0),...u32(0),...u32(0),...u32(0x10000),...u32(0),...u32(0),...u32(0),...u32(0x40000000)];
  const props=new Uint8Array(43);props[7]=1;
  const trakFor=co64=>box('trak',
   full('tkhd',0,0,[...u32(0),...u32(0),...u32(chapId),...u32(0),...u32(movieDur),...u32(0),...u32(0),...u16(0),...u16(0),...u16(0),...u16(0),...matrix,...u32(0),...u32(0)]),
   box('mdia',
    full('mdhd',0,0,[...u32(0),...u32(0),...u32(ms),...u32(total),...u16(0x55C4),...u16(0)]),
    full('hdlr',0,0,[...u32(0),...cc('text'),...u32(0),...u32(0),...u32(0),...cc('Chapters'),0]),
    box('minf',
     box('gmhd',full('gmin',0,0,[...u16(0x40),...u16(0x8000),...u16(0x8000),...u16(0x8000),...u16(0),...u16(0)]),
      box('text',[...u16(1),...u32(0),...u32(0),...u32(0),...u32(1),...u32(0),...u32(0),...u32(0),...u32(0x4000),...u16(0)])),
     box('dinf',full('dref',0,0,u32(1),full('url ',0,1))),
     box('stbl',
      full('stsd',0,0,u32(1),box('text',[0,0,0,0,0,0,...u16(1)],props)),
      full('stts',0,0,u32(durs.length),...durs.map(d=>[...u32(1),...u32(d)])),
      full('stsc',0,0,u32(1),[...u32(1),...u32(1),...u32(1)]),
      full('stsz',0,0,u32(0),u32(samples.length),...samples.map(s=>u32(s.length))),
      full('co64',0,0,u32(samples.length),...co64.map(u64))))));
  const chpl=full('chpl',1,0,u32(0),[Math.min(255,chapters.length)],...chapters.slice(0,255).map(c=>{const t=clip(c.title,255);return cat([Uint8Array.from([...u64(Math.round(c.t*1e7)),t.length]),t])}));
  /* rebuild moov: host trak gains tref/chap, chapter trak added, udta gains chpl, next_track_ID bumped */
  const build=co64=>{
   const parts=[];let hasUdta=false;
   for(const k of kids){
    let b=mp4.slice(k.start,k.end);
    if(k===mvhd){b=b.slice();new DataView(b.buffer).setUint32(nextAt-k.start,chapId+1)}
    else if(k===host){
     const tk=boxes(mp4,k.body,k.end),inner=[];
     const old=tk.find(x=>x.type==='tref'),keep=old?boxes(mp4,old.body,old.end).filter(x=>x.type!=='chap').map(x=>mp4.slice(x.start,x.end)):[];
     for(const x of tk){if(x.type==='tref')continue;inner.push(mp4.slice(x.start,x.end));if(x.type==='tkhd')inner.push(box('tref',...keep,box('chap',u32(chapId))))}
     b=box('trak',...inner);
    }else if(k.type==='udta'){hasUdta=true;b=box('udta',...boxes(mp4,k.body,k.end).filter(x=>x.type!=='chpl').map(x=>mp4.slice(x.start,x.end)),chpl)}
    parts.push(b);
    if(k===traks[traks.length-1])parts.push(trakFor(co64));
   }
   if(!hasUdta)parts.push(box('udta',chpl));
   return box('moov',...parts);
  };
  const size=build(samples.map(()=>0)).length,delta=size-(moov.end-moov.start),after=mp4.subarray(moov.end);
  let o=moov.start+size+after.length+8;const offs=samples.map(s=>{const at=o;o+=s.length;return at});
  const fin=build(offs);
  /* existing media offsets move only when their data sits after moov */
  if(delta&&top.some(b=>b.type==='mdat'&&b.start>moov.start))shiftOffsets(fin,delta,chapId);
  return [mp4.subarray(0,moov.start),fin,after,box('mdat',...samples)];
 }
 function shiftOffsets(moov,delta,skipId){
  const dv=new DataView(moov.buffer,moov.byteOffset,moov.byteLength);
  const walk=(s,e)=>{for(const b of boxes(moov,s,e)){
   if(b.type==='trak'){const tk=boxes(moov,b.body,b.end).find(x=>x.type==='tkhd'),v1=moov[tk.body]===1;if(dv.getUint32(tk.body+(v1?20:12))!==skipId)walk(b.body,b.end)}
   else if(['mdia','minf','stbl'].includes(b.type))walk(b.body,b.end);
   else if(b.type==='stco'){const n=dv.getUint32(b.body+4);for(let i=0;i<n;i++){const p=b.body+8+i*4;dv.setUint32(p,dv.getUint32(p)+delta)}}
   else if(b.type==='co64'){const n=dv.getUint32(b.body+4);for(let i=0;i<n;i++){const p=b.body+8+i*8,v=dv.getUint32(p)*4294967296+dv.getUint32(p+4)+delta;dv.setUint32(p,Math.floor(v/4294967296));dv.setUint32(p+4,v>>>0)}}
  }};
  walk(8,moov.length);
 }
 return {add,boxes};
})();
