
/* Speedy Friends — persistent OST across internal HTML navigation.
   Keeps source, timestamp and play state in sessionStorage so navigation
   can resume the exact same track instead of starting from 0:00.
*/
(() => {
  const KEY='speedy-friends-global-ost-v1';
  const audio=window.__sfGlobalAudio || new Audio();
  window.__sfGlobalAudio=audio;
  audio.preload='metadata';
  audio.crossOrigin='anonymous';

  const read=()=>{
    try{const value=JSON.parse(sessionStorage.getItem(KEY)||'null');return value&&typeof value==='object'&&!Array.isArray(value)?value:null}catch{return null}
  };
  const write=(extra={})=>{
    try{
      const old=read()||{};
      sessionStorage.setItem(KEY,JSON.stringify({
        ...old,
        src:audio.src||old.src||'',
        time:Number.isFinite(audio.currentTime)?audio.currentTime:(old.time||0),
        duration:Number.isFinite(audio.duration)?audio.duration:(old.duration||0),
        playing:!audio.paused,
        volume:audio.volume,
        ...extra,
        updatedAt:Date.now()
      }));
    }catch{}
  };

  const saved=read();
  if(saved?.src){
    audio.volume=Number.isFinite(saved.volume)?Math.min(1,Math.max(0,saved.volume)):.58;
    audio.src=saved.src;
    audio.addEventListener('loadedmetadata',()=>{
      const max=Number.isFinite(audio.duration)?Math.max(0,audio.duration-.25):0;
      const time=Number(saved.time);
      audio.currentTime=Number.isFinite(time)?Math.max(0,Math.min(time,max)):0;
      if(saved.playing){
        audio.play().catch(()=>{
          // Autoplay can be blocked after a full document navigation.
          // The next user interaction can call resume().
        });
      }
    },{once:true});
    audio.load();
  }

  let lastProgressWrite=0;
  audio.addEventListener('timeupdate',()=>{if(performance.now()-lastProgressWrite<1000)return;lastProgressWrite=performance.now();write();});
  audio.addEventListener('play',()=>write({playing:true}));
  audio.addEventListener('pause',()=>write({playing:false}));
  audio.addEventListener('volumechange',()=>write({volume:audio.volume}));
  audio.addEventListener('ended',()=>write({playing:false,time:0}));

  window.__sfOST={
    audio,
    resume:()=>audio.play().catch(()=>false),
    load:(src,time=0,autoplay=true)=>{
      if(!src)return;
      // load() resets currentTime. Restore it only after metadata for this source arrives.
      const position=Number.isFinite(Number(time))?Math.max(0,Number(time)):0;
      const onReady=()=>{if(audio.getAttribute('src')!==src)return;const max=Number.isFinite(audio.duration)?audio.duration:position;audio.currentTime=Math.min(position,max);};
      audio.addEventListener('loadedmetadata',onReady,{once:true});
      audio.src=src;
      audio.load();
      return autoplay?audio.play().catch(()=>false):Promise.resolve();
    },
    save:()=>write(),
    stop:()=>{
      audio.pause();
      audio.currentTime=0;
      write({playing:false,time:0});
    }
  };

  // Un solo audio a la vez: OST de perfiles, tocadiscos de cafetería o reproductor de ost.html
  // pausan el OST global y viceversa. Los vídeos silenciados (previews) no cuentan.
  const audible=media=>media&&media!==audio&&!media.muted&&media.volume>0;
  document.addEventListener('play',event=>{if(audible(event.target)&&!audio.paused)audio.pause();},true);
  audio.addEventListener('play',()=>{document.querySelectorAll('audio,video').forEach(media=>{if(audible(media)&&!media.paused)media.pause();});});

  window.addEventListener('pagehide',()=>write());
  window.addEventListener('beforeunload',()=>write());

  // A click/tap counts as user activation and is a good opportunity to
  // resume an OST that was playing before this HTML navigation.
  document.addEventListener('pointerdown',()=>{
    const s=read();
    if(s?.playing && audio.paused)audio.play().catch(()=>{});
  },{once:false,passive:true});
})();
