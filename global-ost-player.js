
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
    try{return JSON.parse(sessionStorage.getItem(KEY)||'null')}catch{return null}
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
    audio.volume=Number.isFinite(saved.volume)?saved.volume:.58;
    audio.src=saved.src;
    audio.addEventListener('loadedmetadata',()=>{
      const max=Math.max(0,(audio.duration||0)-.25);
      audio.currentTime=Math.min(Number(saved.time||0),max);
      if(saved.playing){
        audio.play().catch(()=>{
          // Autoplay can be blocked after a full document navigation.
          // The next user interaction can call resume().
        });
      }
    },{once:true});
    audio.load();
  }

  audio.addEventListener('timeupdate',()=>write());
  audio.addEventListener('play',()=>write({playing:true}));
  audio.addEventListener('pause',()=>write({playing:false}));
  audio.addEventListener('volumechange',()=>write({volume:audio.volume}));
  audio.addEventListener('ended',()=>write({playing:false,time:0}));

  window.__sfOST={
    audio,
    resume:()=>audio.play().catch(()=>false),
    load:(src,time=0,autoplay=true)=>{
      if(!src)return;
      if(audio.src!==src)audio.src=src;
      audio.currentTime=Number(time)||0;
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

  window.addEventListener('pagehide',()=>write());
  window.addEventListener('beforeunload',()=>write());

  // A click/tap counts as user activation and is a good opportunity to
  // resume an OST that was playing before this HTML navigation.
  document.addEventListener('pointerdown',()=>{
    const s=read();
    if(s?.playing && audio.paused)audio.play().catch(()=>{});
  },{once:false,passive:true});
})();
