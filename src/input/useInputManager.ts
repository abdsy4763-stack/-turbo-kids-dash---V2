import { useEffect, useRef } from 'react';

export interface PlayerInput {
  moveX: number;
  moveZ: number;
  jump: boolean;
  dash: boolean;
  power: boolean;
}

const DEADZONE = 0.2;

export function useInputManager() {
  const keysPressed = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const getPlayerInput = (playerIndex: 0 | 1): PlayerInput => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const connectedPads = Array.from(gamepads).filter((gp): gp is Gamepad => gp !== null);
    const pad = connectedPads[playerIndex];

    let moveX = 0;
    let moveZ = 0;
    let jump = false;
    let dash = false;
    let power = false;

    if (pad) {
      const axisX = pad.axes[0] || 0;
      const axisY = pad.axes[1] || 0;

      if (Math.abs(axisX) > DEADZONE) moveX = axisX;
      if (Math.abs(axisY) > DEADZONE) moveZ = axisY;

      if (pad.buttons[14]?.pressed) moveX = -1;
      if (pad.buttons[15]?.pressed) moveX = 1;
      if (pad.buttons[12]?.pressed) moveZ = -1;
      if (pad.buttons[13]?.pressed) moveZ = 1;

      // زر A (0) للقفز، زر B (1) للاندفاع، زر X (2) أو Y (3) أو R2 (7) للقدرة
      jump = Boolean(pad.buttons[0]?.pressed);
      dash = Boolean(pad.buttons[1]?.pressed);
      power = Boolean(
        pad.buttons[2]?.pressed || pad.buttons[3]?.pressed || pad.buttons[7]?.pressed
      );
    }

    const keys = keysPressed.current;
    if (playerIndex === 0) {
      if (keys['KeyA']) moveX = -1;
      if (keys['KeyD']) moveX = 1;
      if (keys['KeyW']) moveZ = -1;
      if (keys['KeyS']) moveZ = 1;
      if (keys['Space']) jump = true;
      if (keys['ShiftLeft']) dash = true;
      if (keys['KeyE']) power = true;
    } else {
      if (keys['ArrowLeft']) moveX = -1;
      if (keys['ArrowRight']) moveX = 1;
      if (keys['ArrowUp']) moveZ = -1;
      if (keys['ArrowDown']) moveZ = 1;
      if (keys['Enter'] || keys['Numpad0']) jump = true;
      if (keys['ShiftRight']) dash = true;
      if (keys['ControlRight'] || keys['Slash']) power = true;
    }

    return { moveX, moveZ, jump, dash, power };
  };

  const triggerVibration = (playerIndex: 0 | 1, duration = 120, intensity = 0.4) => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const connectedPads = Array.from(gamepads).filter((gp): gp is Gamepad => gp !== null);
    const pad = connectedPads[playerIndex];

    if (pad && 'vibrationActuator' in pad && pad.vibrationActuator) {
      pad.vibrationActuator
        .playEffect('dual-rumble', {
          startDelay: 0,
          duration,
          weakMagnitude: intensity * 0.5,
          strongMagnitude: intensity,
        })
        .catch(() => {});
    }
  };

  return { getPlayerInput, triggerVibration };
}