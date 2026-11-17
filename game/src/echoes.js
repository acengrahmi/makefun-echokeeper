// echoes.js — TIME ECHOES, the signature mechanic of ECHOKEEPER.
// One small job: remember the keeper's last six seconds, and replay them
// forever as translucent ghost keepers — living turrets the player
// choreographs simply by playing well for six seconds, then pressing E.

export const ECHO_RECORD_TICKS = 360; // six seconds at 60 ticks per second
export const ECHO_MIN_TICKS = 90;     // need at least 1.5 s of memory to cast

// The keeper is always being remembered: every tick pushes one frame.
export function pushMemory(buffer, frame) {
  buffer.push(frame);
  if (buffer.length > ECHO_RECORD_TICKS) buffer.shift();
}

// A memory frame is everything an echo needs to re-live that tick.
export function memoryFrame(x, y, aimAngle, firing) {
  return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, a: Math.round(aimAngle * 1000) / 1000, f: firing ? 1 : 0 };
}

// Cast an echo from the current memory. Returns the echo, or null when the
// memory is too short or the chorus is full (the caller plays the fail cue).
export function castEcho(buffer, cap, existing, power) {
  if (buffer.length < ECHO_MIN_TICKS) return null;
  if (existing.length >= cap) return null;
  const frames = buffer.slice();
  return {
    frames,            // the recorded loop, replayed verbatim
    cursor: 0,         // where in the loop this echo currently stands
    x: frames[0].x, y: frames[0].y,
    aim: frames[0].a,
    firing: frames[0].f === 1,
    power,             // fraction of the keeper's bolt damage it deals
    fireTimer: 0,      // its own trigger, throttled in stepEchoes
    age: 0,
    hue: 168 + existing.length * 36, // each echo wears its own colour
  };
}

// Advance every echo one tick along its loop. Returns fire orders so the
// world can spawn the echo's bolts with the echo's own damage fraction.
export function stepEchoes(echoes, fireInterval) {
  const orders = [];
  for (const e of echoes) {
    e.age++;
    e.cursor = (e.cursor + 1) % e.frames.length;
    const fr = e.frames[e.cursor];
    e.x = fr.x; e.y = fr.y; e.aim = fr.a; e.firing = fr.f === 1;
    e.fireTimer -= 1 / 60;
    if (e.firing && e.fireTimer <= 0) {
      e.fireTimer = fireInterval;
      orders.push({ x: e.x, y: e.y, angle: e.aim, power: e.power, hue: e.hue });
    }
  }
  return orders;
}

// A compact fingerprint of an echo's loop, used by the determinism tests.
export function echoDigest(echo) {
  let sum = 0;
  for (let i = 0; i < echo.frames.length; i += 17) {
    const f = echo.frames[i];
    sum += Math.round(f.x) * 3 + Math.round(f.y) * 5 + (f.f ? 7 : 0);
  }
  return sum;
}
