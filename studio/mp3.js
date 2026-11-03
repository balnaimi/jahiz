/* MP3 encoder: lazy browser-only loading, no media upload. */
window.JahizMp3=(()=>{
 let loading;
 function load(){
  if(window.lamejs?.Mp3Encoder)return Promise.resolve(window.lamejs);
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js';
   const timer=setTimeout(()=>{loading=null;reject(new Error('تحميل MP3 أخذ وقت طويل. جرّب مرة ثانية.'))},30000);
   script.onload=()=>{clearTimeout(timer);if(window.lamejs?.Mp3Encoder)resolve(window.lamejs);else{loading=null;reject(new Error('مكتبة MP3 ما اشتغلت.'))}};
   script.onerror=()=>{clearTimeout(timer);loading=null;reject(new Error('ما قدرنا نحمّل مكتبة MP3. تأكد من الإنترنت.'))};
   document.head.appendChild(script);
  });return loading;
 }
 async function encode(wav,onProgress){
  const lib=await load(),data=new DataView(await wav.arrayBuffer());
  const channels=data.getUint16(22,true),rate=data.getUint32(24,true),count=data.getUint32(40,true)/(channels*2);
  if(channels!==1&&channels!==2)throw new Error('MP3 يدعم مونو أو ستيريو. اختر مونو لهالملف.');
  const encoder=new lib.Mp3Encoder(channels,rate,192),chunks=[],N=1152;
  for(let start=0;start<count;start+=N){
   const n=Math.min(N,count-start),left=new Int16Array(n),right=channels===2?new Int16Array(n):null;
   for(let i=0;i<n;i++){left[i]=data.getInt16(44+((start+i)*channels)*2,true);if(right)right[i]=data.getInt16(44+((start+i)*channels+1)*2,true)}
   const bytes=right?encoder.encodeBuffer(left,right):encoder.encodeBuffer(left);if(bytes.length)chunks.push(new Uint8Array(bytes));
   if(start%(N*100)===0){onProgress?.(start/count);await new Promise(r=>setTimeout(r,0))}
  }
  const end=encoder.flush();if(end.length)chunks.push(new Uint8Array(end));onProgress?.(1);
  return new Blob(chunks,{type:'audio/mpeg'});
 }
 return {encode};
})();
