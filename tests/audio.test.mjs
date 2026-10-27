import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('Persistent OST clamps saved volume and restores requested position after load resets it',()=>{
 const listeners=new Map(),data=new Map([['speedy-friends-global-ost-v1',JSON.stringify({src:'fixture.mp3',volume:4,time:12,playing:false})]]);
 const audio={src:'',currentTime:0,duration:100,paused:true,volume:0,addEventListener(name,fn,options){const list=listeners.get(name)||[];list.push({fn,once:options?.once});listeners.set(name,list);},dispatch(name){const list=listeners.get(name)||[];listeners.set(name,list.filter(x=>!x.once));for(const x of list)x.fn();},load(){this.currentTime=0;},getAttribute(){return this.src;},pause(){this.paused=true;},play(){this.paused=false;return Promise.resolve();}};
 const window={__sfGlobalAudio:audio,addEventListener(){}};
 const context={window,Audio:function(){return audio;},sessionStorage:{getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)},document:{addEventListener(){}},performance:{now:()=>1500},console};
 vm.runInNewContext(readFileSync('global-ost-player.js','utf8'),context);
 assert.equal(audio.volume,1);audio.dispatch('loadedmetadata');assert.equal(audio.currentTime,12);
 window.__sfOST.load('another.mp3',42,false);assert.equal(audio.currentTime,0);audio.dispatch('loadedmetadata');assert.equal(audio.currentTime,42);
 window.__sfOST.stop();assert.equal(audio.currentTime,0);assert.equal(JSON.parse(data.get('speedy-friends-global-ost-v1')).playing,false);
});
