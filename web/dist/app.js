(() => {
  'use strict';
  const toggle = document.querySelector('#breath-toggle');
  const reset = document.querySelector('#breath-reset');
  const phase = document.querySelector('#breath-phase');
  const hint = document.querySelector('#breath-hint');
  const status = document.querySelector('#breath-status');
  const time = document.querySelector('#breath-time');
  const orb = document.querySelector('#breath-orb');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let running = false;
  let elapsed = 0;
  let startedAt = 0;
  let frame = 0;
  let lastPhase = '';
  const duration = 60000;

  function setStatus(text) {
    if (status.textContent !== text) status.textContent = text;
  }

  function draw(ms) {
    const cycle = ms % 10000;
    const breathingIn = cycle < 4000;
    const currentPhase = breathingIn ? 'Inspira' : 'Suelta el aire';
    const remaining = Math.ceil((duration - ms) / 1000);
    const progress = breathingIn ? cycle / 4000 : 1 - (cycle - 4000) / 6000;
    orb.style.transform = reducedMotion.matches ? 'scale(1)' : `scale(${1 + Math.sin(progress * Math.PI / 2) * 0.36})`;
    if (lastPhase !== currentPhase) {
      phase.textContent = currentPhase;
      hint.textContent = breathingIn ? 'SUAVEMENTE' : 'SIN FORZAR';
      setStatus(`${currentPhase}, ${breathingIn ? 'suavemente' : 'sin forzar'}.`);
      lastPhase = currentPhase;
    }
    const timeLabel = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} · TU MOMENTO DE CALMA`;
    if (time.textContent !== timeLabel) time.textContent = timeLabel;
  }

  function finish() {
    running = false;
    elapsed = duration;
    orb.style.transform = 'scale(1)';
    phase.textContent = 'Gracias por parar';
    hint.textContent = 'SIGUE A TU RITMO';
    time.textContent = 'TU MINUTO DE PAUSA HA TERMINADO';
    toggle.textContent = 'Otro momento para mí ↗';
    reset.hidden = true;
    setStatus('Tu minuto de pausa ha terminado. Continúa a tu ritmo.');
  }

  function tick(now) {
    if (!running) return;
    const ms = elapsed + now - startedAt;
    if (ms >= duration) { finish(); return; }
    draw(ms);
    frame = window.requestAnimationFrame(tick);
  }

  function pause() {
    if (!running) return;
    elapsed = Math.min(duration, elapsed + performance.now() - startedAt);
    running = false;
    window.cancelAnimationFrame(frame);
    if (elapsed >= duration) { finish(); return; }
    phase.textContent = 'A tu ritmo';
    hint.textContent = 'EN PAUSA';
    toggle.textContent = 'Continuar mi pausa ↗';
    setStatus('Ejercicio en pausa. Puedes continuar cuando quieras.');
    lastPhase = '';
  }

  function start() {
    if (elapsed >= duration) elapsed = 0;
    running = true;
    startedAt = performance.now();
    toggle.textContent = 'Pausar un momento';
    reset.hidden = false;
    lastPhase = '';
    draw(elapsed);
    frame = window.requestAnimationFrame(tick);
  }

  toggle.addEventListener('click', () => running ? pause() : start());
  reset.addEventListener('click', () => {
    running = false;
    window.cancelAnimationFrame(frame);
    elapsed = 0;
    lastPhase = '';
    orb.style.transform = 'scale(1)';
    phase.innerHTML = 'Un momento<br>para ti';
    hint.textContent = 'SIN PRISA';
    toggle.innerHTML = 'Empezar mi pausa <span aria-hidden="true">↗</span>';
    time.textContent = '1 MINUTO · SOLO PARA TI';
    reset.hidden = true;
    toggle.focus();
    setStatus('Pausa reiniciada. Lista para empezar.');
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && running) pause();
  });
})();
