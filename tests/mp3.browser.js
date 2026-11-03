/* Unit-level encoder tests; final downloads are also decoded with FFmpeg. */
window.__mp3Test={status:'running'};
(async()=>{
 try{
  if(!window.JahizMp3)throw new Error('MP3 encoder unavailable');
  const count=48000*2,buf=new ArrayBuffer(44+count*2),v=new DataView(buf);
  v.setUint16(22,1,true);v.setUint32(24,48000,true);v.setUint32(40,count*2,true);
  for(let i=0;i<count;i++)v.setInt16(44+i*2,Math.sin(2*Math.PI*440*i/48000)*10000,true);
  const mp3=await JahizMp3.encode(new Blob([buf],{type:'audio/wav'}));
  if(mp3.type!=='audio/mpeg'||mp3.size<1000)throw new Error('Invalid MP3 result');
  const bytes=new Uint8Array(await mp3.arrayBuffer());if(bytes[0]!==255||(bytes[1]&224)!==224)throw new Error('Missing MPEG frame');
  window.__mp3Test={status:'passed',bytes:mp3.size};
 }catch(e){window.__mp3Test={status:'failed',error:e.message}}
})();void 0;
