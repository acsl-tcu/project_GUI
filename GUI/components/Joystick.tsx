"use client";
// /rover_twist へ publish する teleop ジョイスティック (旧 CMD.tsx の置き換え)。
// Pointer Events 化で iPad タッチ対応。押下中は 10Hz で連続 publish、離すと 0 を送る。

import React, { useEffect, useRef } from "react";
import ROSLIB from "roslib";

const MAX_V_FWD = 0.5;
const MAX_V_BACK = 0.3;
const MAX_W = 0.3;
const PAD = 220;
const HANDLE = 56;

interface JoystickProps {
  ros: ROSLIB.Ros;
}

const Joystick: React.FC<JoystickProps> = ({ ros }) => {
  const padRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const vwRef = useRef<{ v: number; w: number }>({ v: 0, w: 0 });
  const activeRef = useRef(false);

  useEffect(() => {
    const pad = padRef.current;
    const handle = handleRef.current;
    if (!pad || !handle) return;

    const topic = new ROSLIB.Topic({
      ros,
      name: "/rover_twist",
      messageType: "geometry_msgs/Twist",
    });

    const publish = () => {
      const { v, w } = vwRef.current;
      topic.publish(
        new ROSLIB.Message({
          linear: { x: v, y: 0.0, z: 0.0 },
          angular: { x: 0.0, y: 0.0, z: w },
        }),
      );
    };

    const center = (PAD - HANDLE) / 2;
    const radius = center;

    const setHandle = (dx: number, dy: number) => {
      handle.style.left = `${center + dx}px`;
      handle.style.top = `${center + dy}px`;
    };
    setHandle(0, 0);

    const onMove = (e: PointerEvent) => {
      if (!activeRef.current) return;
      const rect = pad.getBoundingClientRect();
      let dx = e.clientX - rect.left - PAD / 2;
      let dy = e.clientY - rect.top - PAD / 2;
      const dist = Math.hypot(dx, dy);
      if (dist > radius) {
        dx = (dx * radius) / dist;
        dy = (dy * radius) / dist;
      }
      setHandle(dx, dy);
      const ny = -dy / radius; // 上 = 前進
      const nx = dx / radius; // 右 = 右旋回 (wz は負)
      const v = ny >= 0 ? ny * MAX_V_FWD : ny * MAX_V_BACK;
      vwRef.current = {
        v: parseFloat(v.toFixed(3)),
        w: parseFloat((-nx * MAX_W).toFixed(3)),
      };
    };

    const stop = () => {
      activeRef.current = false;
      setHandle(0, 0);
      vwRef.current = { v: 0, w: 0 };
      publish(); // 即時に停止コマンド
    };

    const onDown = (e: PointerEvent) => {
      activeRef.current = true;
      handle.setPointerCapture(e.pointerId);
      onMove(e);
    };

    handle.addEventListener("pointerdown", onDown);
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", stop);
    handle.addEventListener("pointercancel", stop);

    const timer = setInterval(() => {
      if (activeRef.current) publish();
    }, 100);

    return () => {
      clearInterval(timer);
      handle.removeEventListener("pointerdown", onDown);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", stop);
      handle.removeEventListener("pointercancel", stop);
    };
  }, [ros]);

  return (
    <div
      ref={padRef}
      className="relative rounded-full bg-slate-800 border border-slate-600 select-none"
      style={{ width: PAD, height: PAD, touchAction: "none" }}
    >
      <div
        ref={handleRef}
        className="absolute rounded-full bg-slate-400 cursor-pointer shadow-lg"
        style={{ width: HANDLE, height: HANDLE, touchAction: "none" }}
      />
    </div>
  );
};

export default Joystick;
