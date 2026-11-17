// input.js — keyboard and mouse become one plain input frame per tick.
// One small job: listen to the browser, expose {mx,my,aimX,aimY,fire,
// dash,echo,pause,speed,mute,confirm} so the simulation never touches the DOM.

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 640, y: 300, down: false, rightDown: false };
  const pressed = new Set(); // edge-triggered actions, consumed each frame

  const code = (e) => e.code;
  addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) {
      if (e.code === 'KeyE') pressed.add('echo');
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') pressed.add('dash');
      if (e.code === 'KeyP' || e.code === 'Escape') pressed.add('pause');
      if (e.code === 'KeyM') pressed.add('mute');
      if (e.code === 'Digit1') pressed.add('speed1');
      if (e.code === 'Digit2') pressed.add('speed2');
      if (e.code === 'Enter') pressed.add('confirm');
    }
    keys.add(code(e));
  });
  addEventListener('keyup', (e) => keys.delete(code(e)));
  addEventListener('blur', () => { keys.clear(); mouse.down = false; mouse.rightDown = false; });

  const toGame = (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 1280;
    mouse.y = ((e.clientY - r.top) / r.height) * 720;
  };
  canvas.addEventListener('mousemove', toGame);
  canvas.addEventListener('mousedown', (e) => {
    toGame(e);
    if (e.button === 0) { mouse.down = true; pressed.add('click'); }
    if (e.button === 2) { mouse.rightDown = true; pressed.add('echo'); }
  });
  addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
    if (e.button === 2) mouse.rightDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('click', () => pressed.add('clickSeen'));

  return {
    frame(px, py) {
      let mx = 0, my = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
      const len = Math.hypot(mx, my) || 1;
      const f = {
        mx: mx / len, my: my / len,
        aimX: mouse.x, aimY: mouse.y,
        fire: mouse.down,
        dash: pressed.has('dash'),
        echo: pressed.has('echo'),
        pause: pressed.has('pause'),
        mute: pressed.has('mute'),
        speed: pressed.has('speed2') ? 2 : pressed.has('speed1') ? 1 : 0,
        confirm: pressed.has('confirm'),
        click: pressed.has('click'),
        clickX: mouse.x, clickY: mouse.y,
      };
      pressed.clear();
      return f;
    },
    setMouse(x, y, down) { mouse.x = x; mouse.y = y; if (down !== undefined) mouse.down = down; },
    tap(action) { pressed.add(action); },
  };
}

export const IDLE_INPUT = Object.freeze({
  mx: 0, my: 0, aimX: 640, aimY: 200, fire: false, dash: false, echo: false,
  pause: false, mute: false, speed: 0, confirm: false, click: false, clickX: 0, clickY: 0,
});
