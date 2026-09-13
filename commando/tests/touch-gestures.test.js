'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createTouchControls}=require('../js/touch.js');
function harness(){
  class Element {
    constructor(action){this.listeners={};this.dataset={action};this.values={};this.captures=new Set();this.style={setProperty:(k,v)=>this.values[k]=v};this.classList={add(){},remove(){}};}
    addEventListener(type,fn,options){(this.listeners[type]??=[]).push({fn,options});}
    emit(type,event={}){event.target??=this;event.cancelable??=true;event.preventDefault=()=>event.prevented=true;for(const {fn} of this.listeners[type]||[])fn(event);return event;}
    setAttribute(){} setPointerCapture(id){this.captures.add(id);} hasPointerCapture(id){return this.captures.has(id);} releasePointerCapture(id){this.captures.delete(id);}
    getBoundingClientRect(){return {x:30,y:200,width:132,height:132};}
    closest(selector){if(selector==='.joystick,.action-buttons [data-action]')return this.control?this:null;return null;}
  }
  const stick=new Element(),jump=new Element('jump'),auto=new Element(),cabinet=new Element(),element=new Element();
  stick.control=jump.control=true;
  element.querySelector=s=>s==='.joystick'?stick:s==='#auto-fire'?auto:null;
  element.querySelectorAll=()=>[jump];
  const changes=new Map(),state={status:'playing',level:{mode:'run'}};
  const controls=createTouchControls({element,cabinet,getState:()=>state,storage:{get:()=> '1',set(){}},unlock(){},onChange:(id,value)=>changes.set(id,value)});
  return {controls,element,stick,jump,auto,cabinet,changes,state};
}
test('Safari touch events suppress joystick scrolling with explicitly non-passive listeners',()=>{
  const h=harness();
  for(const type of ['touchstart','touchmove']){
    assert.equal(h.cabinet.listeners[type][0].options.passive,false);
    assert.equal(h.cabinet.emit(type,{target:h.stick}).prevented,true);
    assert.equal(h.cabinet.emit(type,{target:h.jump}).prevented,true);
    assert.notEqual(h.cabinet.emit(type,{target:h.auto}).prevented,true);
    assert.notEqual(h.cabinet.emit(type,{target:h.stick,cancelable:false}).prevented,true);
  }
});
test('joystick capture survives a simultaneous jump finger and releases independently',()=>{
  const h=harness();
  h.stick.emit('pointerdown',{pointerId:1,clientX:150,clientY:266});
  h.jump.emit('pointerdown',{pointerId:2});
  assert.deepEqual(h.changes.get(1),['0:right']);assert.deepEqual(h.changes.get(2),['0:jump']);
  assert.equal(h.stick.hasPointerCapture(1),true);
  assert.equal(h.cabinet.emit('touchmove',{target:h.auto}).prevented,true);
  h.stick.emit('pointerdown',{pointerId:3,clientX:30,clientY:266});
  assert.equal(h.changes.has(3),false);
  h.element.emit('pointerup',{pointerId:2});assert.equal(h.changes.get(2),null);
  assert.deepEqual(h.changes.get(1),['0:right']);
  h.element.emit('pointerup',{pointerId:1});assert.equal(h.controls.inspect().contacts,0);
  assert.equal(h.stick.values['--stick-x'],'0px');assert.equal(h.stick.hasPointerCapture(1),false);
});
test('cancel, lost capture, and the shared pause/rotation reset clear all held actions',()=>{
  for(const action of ['pointercancel','lostpointercapture','reset']){
    const h=harness();h.stick.emit('pointerdown',{pointerId:1,clientX:150,clientY:266});
    if(action==='reset'){h.jump.emit('pointerdown',{pointerId:2});h.controls.reset();assert.equal(h.changes.get(2),null);}
    else h.element.emit(action,{pointerId:1});
    assert.equal(h.controls.inspect().contacts,0);assert.equal(h.changes.get(1),null);
    assert.equal(h.stick.values['--stick-y'],'0px');
    assert.notEqual(h.cabinet.emit('touchmove',{target:h.auto}).prevented,true);
  }
});
