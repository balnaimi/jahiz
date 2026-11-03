/* Call JahizPreferenceTest('set'), reload, then call ('check'). */
window.JahizPreferenceTest=phase=>{
 const q=s=>document.querySelector(s);
 if(phase==='set'){
   q('#tab-aud').click();
   q('#chan [data-v="mono"]').click();
   q('#audFmt [data-v="mp3"]').click();
   q('#norm').click();
   q('#tab-vid').click();
   q('#rvRes [data-v="720"]').click();
   return {status:'configured'};
 }
 const checks={channels:q('#chan [aria-pressed="true"]').dataset.v==='mono',format:q('#audFmt [aria-pressed="true"]').dataset.v==='mp3',normalise:q('#norm').checked===false,videoResolution:q('#rvRes [aria-pressed="true"]').dataset.v==='720'};
 return {status:Object.values(checks).every(Boolean)?'passed':'failed',checks};
};
