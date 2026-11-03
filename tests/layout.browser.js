window.JahizLayoutTest=()=>{
 const tabs=[...document.querySelectorAll('.tab')];
 const checks={videoFirst:tabs[0]?.id==='tab-vid'&&tabs[0].getAttribute('aria-selected')==='true'&&!document.querySelector('#pane-vid').hidden,onlyVideoAndAudio:tabs.length===2&&!!document.querySelector('#tab-aud'),allTabsVisible:document.querySelector('.side').scrollWidth<=document.querySelector('.side').clientWidth,uploadVisible:document.querySelector('#rvDrop').getBoundingClientRect().bottom<innerHeight,themeControl:!!document.querySelector('#themeToggle'),noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth,heading:document.querySelector('#workspaceTitle')?.textContent==='الفيديو'};
 return {status:Object.values(checks).every(Boolean)?'passed':'failed',checks};
};
