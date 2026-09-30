import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
function browser(reduced = false) {
  let now = 0, nextId = 1;
  const jobs = new Map(), elements = new Map(), documentEvents = new Map(), mediaEvents = new Map();
  const media = {matches: reduced, addEventListener: (name, fn) => mediaEvents.set(name, fn)};
  for (const name of ['toggle','reset','phase','hint','status','time','orb']) {
    elements.set(`#breath-${name}`, {textContent:'',innerHTML:'',style:{},hidden:false,events:new Map(),addEventListener(name, fn){this.events.set(name,fn);},focus(){this.focused=true;}});
  }
  const schedule = (kind, fn, delay) => {const id=nextId++; jobs.set(id,{kind,fn,delay}); return id;};
  const document = {hidden:false,querySelector: id => elements.get(id),addEventListener: (name,fn) => documentEvents.set(name,fn)};
  vm.runInNewContext(source, {document,performance:{now:()=>now},window:{matchMedia:()=>media,requestAnimationFrame:fn=>schedule('raf',fn,0),cancelAnimationFrame:id=>jobs.delete(id),setTimeout:(fn,delay)=>schedule('timeout',fn,delay),clearTimeout:id=>jobs.delete(id)}});
  return {
    jobs, element: name => elements.get(`#breath-${name}`),
    click(name){elements.get(`#breath-${name}`).events.get('click')();},
    setTime(value){now=value;},
    fire(value){now=value; assert.equal(jobs.size,1,'exactly one callback pending'); const [id,job]=jobs.entries().next().value; jobs.delete(id); job.fn(now);},
    preference(value){media.matches=value;mediaEvents.get('change')?.({matches:value});},
    hide(){document.hidden=true;documentEvents.get('visibilitychange')();}
  };
}

test('reduced motion uses a one-second timer and elapsed real time, not frame callbacks',()=>{
  const b=browser(true); b.click('toggle');
  assert.equal([...b.jobs.values()][0].kind,'timeout');
  assert.equal([...b.jobs.values()][0].delay,1000);
  b.fire(4250);
  assert.equal(b.element('phase').textContent,'Suelta el aire');
  assert.equal(b.element('time').textContent,'0:56 · TU MOMENTO DE CALMA');
  assert.equal(b.element('orb').style.transform,'scale(1)');
  b.fire(65000);
  assert.equal(b.jobs.size,0);
  assert.equal(b.element('phase').textContent,'Gracias por parar');
});

test('motion preference switches replace the active scheduler without restarting elapsed time',()=>{
  const b=browser(); b.click('toggle');
  assert.equal([...b.jobs.values()][0].kind,'raf');
  b.fire(1500); assert.notEqual(b.element('orb').style.transform,'scale(1)');
  b.setTime(4500); b.preference(true);
  assert.equal(b.jobs.size,1);assert.equal([...b.jobs.values()][0].kind,'timeout');
  assert.equal(b.element('orb').style.transform,'scale(1)');
  assert.equal(b.element('phase').textContent,'Suelta el aire');
  b.setTime(8000); b.preference(false);
  assert.equal(b.jobs.size,1);assert.equal([...b.jobs.values()][0].kind,'raf');
  b.fire(60000);assert.equal(b.jobs.size,0);assert.equal(b.element('phase').textContent,'Gracias por parar');
});

for(const reduced of [false,true]) test(`pause/resume, hidden tab, reset and replay preserve controls (${reduced ? 'reduced' : 'animated'})`,()=>{
  const b=browser(reduced);b.click('toggle');b.setTime(2500);b.click('toggle');
  assert.equal(b.jobs.size,0);assert.equal(b.element('phase').textContent,'A tu ritmo');
  b.preference(!reduced);assert.equal(b.jobs.size,0,'preference change does not resume paused exercise');
  b.setTime(10000);b.click('toggle');b.fire(11500);
  assert.equal(b.element('time').textContent,'0:56 · TU MOMENTO DE CALMA');
  b.setTime(12000);b.hide();assert.equal(b.jobs.size,0);
  assert.equal(b.element('toggle').textContent,'Continuar mi pausa ↗');
  b.click('reset');assert.equal(b.element('reset').hidden,true);assert.equal(b.element('toggle').focused,true);
  b.setTime(20000);b.click('toggle');b.fire(79999);assert.equal(b.element('time').textContent,'0:01 · TU MOMENTO DE CALMA');
  b.fire(80000);assert.equal(b.jobs.size,0);assert.equal(b.element('reset').hidden,true);
  b.setTime(90000);b.click('toggle');assert.equal(b.element('time').textContent,'1:00 · TU MOMENTO DE CALMA');
  b.click('reset');assert.equal(b.jobs.size,0,'reset cancels active scheduler');
});
