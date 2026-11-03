/* Studio shell interactions, independent of media-processing engines. */
(()=>{
 const $=s=>document.querySelector(s);
 const copy={aud:['تجهيز الصوت','قصّ، نقِّ، وسمّع النتيجة قبل التنزيل.','AUDIO WORKSPACE'],vid:['الفيديو','شغّل المقطع، علّق على الثانية، ونزّله MP4 بفواصله.','VIDEO WORKSPACE']};
 function setTitle(){const id=$('.tab[aria-selected="true"]').id.replace('tab-','');const [title,desc,kicker]=copy[id];$('#workspaceTitle').textContent=title;$('#workspaceDesc').textContent=desc;$('#workspaceKicker').textContent=kicker;}
 document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',setTitle));setTitle();
 const theme=$('#themeToggle');
 function themeLabel(){theme.textContent=document.documentElement.dataset.theme==='light'?'الوضع الداكن ◐':'الوضع الفاتح ◑';theme.setAttribute('aria-label',theme.textContent)}
 theme.addEventListener('click',()=>{document.documentElement.dataset.theme=document.documentElement.dataset.theme==='light'?'dark':'light';themeLabel();window.JahizPrefs.save();window.dispatchEvent(new Event('resize'))});themeLabel();
 document.querySelectorAll('.settings-toggle').forEach(button=>{
  const rail=button.closest('.rail');
  const sync=()=>button.setAttribute('aria-expanded',String(!matchMedia('(max-width:1000px)').matches||rail.classList.contains('is-open')));
  button.addEventListener('click',()=>{if(matchMedia('(max-width:1000px)').matches){rail.classList.toggle('is-open');sync()}});
  matchMedia('(max-width:1000px)').addEventListener('change',sync);sync();
 });
 document.querySelectorAll('.drop').forEach(drop=>{drop.setAttribute('tabindex','0');drop.setAttribute('role','button');drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();drop.querySelector('input').click()}})});
})();
