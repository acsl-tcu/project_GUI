"use client";
// 可視化タブ (RViz-lite): /map, /amcl_pose, /rover_debug/ref_path,
// /rf_reference_point_stamped, /scan を 2D Canvas に描画。
// フロアグラフ (floor_map.json) をオーバレイ。ドラッグでパン、ホイール/ボタンでズーム。
// 注意: /scan は TF を引かず現在の推定姿勢基準の近似描画。

import React, { useCallback, useEffect, useRef, useState } from "react";
import ROSLIB from "roslib";
import { useTopic } from "@/lib/useRos";
import { floorNodes, floorEdges, floorRooms } from "@/lib/floorMap";
import CameraView from "@/components/CameraView";

interface Vec3 {
  x: number;
  y: number;
  z: number;
}
interface Quat extends Vec3 {
  w: number;
}
interface PoseWithCovMsg {
  pose: { pose: { position: Vec3; orientation: Quat }; covariance: number[] };
}
interface PathMsg {
  poses: { pose: { position: Vec3 } }[];
}
interface PointStampedMsg {
  point: Vec3;
}
interface LaserScanMsg {
  angle_min: number;
  angle_increment: number;
  range_min: number;
  range_max: number;
  ranges: (number | null)[];
}
interface OccupancyGridMsg {
  info: {
    resolution: number;
    width: number;
    height: number;
    origin: { position: Vec3; orientation: Quat };
  };
  data: number[];
}

interface RobotPose {
  x: number;
  y: number;
  yaw: number;
  covXY: number;
}

function quatYaw(q: Quat): number {
  return Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
}

interface VizPanelProps {
  ros: ROSLIB.Ros | null;
  settings: { rid: number };
  floor: number;
}

const VizPanel: React.FC<VizPanelProps> = ({ ros, floor }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef<RobotPose | null>(null);
  const pathRef = useRef<[number, number][]>([]);
  const refPointRef = useRef<[number, number] | null>(null);
  const scanRef = useRef<LaserScanMsg | null>(null);
  const mapRef = useRef<{
    canvas: HTMLCanvasElement;
    originX: number;
    originY: number;
    width: number;
    height: number;
    resolution: number;
  } | null>(null);

  // ビュー状態 (メートル座標の中心 + px/m スケール)
  const viewRef = useRef({ cx: 20, cy: 5, scale: 12, fitted: false });
  const [follow, setFollow] = useState(false);
  const [poseText, setPoseText] = useState("--");
  const [showCamera, setShowCamera] = useState(false);

  useTopic<PoseWithCovMsg>(
    ros,
    "/amcl_pose",
    "geometry_msgs/PoseWithCovarianceStamped",
    (msg) => {
      const p = msg.pose.pose;
      poseRef.current = {
        x: p.position.x,
        y: p.position.y,
        yaw: quatYaw(p.orientation),
        covXY: Math.max(msg.pose.covariance[0] ?? 0, msg.pose.covariance[7] ?? 0),
      };
    },
    { throttleRate: 200 },
  );
  // slam_toolbox 構成用フォールバック
  useTopic<PoseWithCovMsg>(
    ros,
    "/pose",
    "geometry_msgs/PoseWithCovarianceStamped",
    (msg) => {
      const p = msg.pose.pose;
      poseRef.current = {
        x: p.position.x,
        y: p.position.y,
        yaw: quatYaw(p.orientation),
        covXY: Math.max(msg.pose.covariance[0] ?? 0, msg.pose.covariance[7] ?? 0),
      };
    },
    { throttleRate: 200 },
  );

  useTopic<PathMsg>(
    ros,
    "/rover_debug/ref_path",
    "nav_msgs/Path",
    (msg) => {
      pathRef.current = (msg.poses ?? []).map((p) => [
        p.pose.position.x,
        p.pose.position.y,
      ]);
    },
    { throttleRate: 500 },
  );

  useTopic<PointStampedMsg>(
    ros,
    "/rf_reference_point_stamped",
    "geometry_msgs/PointStamped",
    (msg) => {
      refPointRef.current = [msg.point.x, msg.point.y];
    },
    { throttleRate: 200 },
  );

  useTopic<LaserScanMsg>(
    ros,
    "/scan",
    "sensor_msgs/LaserScan",
    (msg) => {
      scanRef.current = msg;
    },
    { throttleRate: 500 },
  );

  useTopic<OccupancyGridMsg>(
    ros,
    "/map",
    "nav_msgs/OccupancyGrid",
    (msg) => {
      const { width, height, resolution, origin } = msg.info;
      if (!width || !height) return;
      const cv = document.createElement("canvas");
      cv.width = width;
      cv.height = height;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const img = ctx.createImageData(width, height);
      for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
          const v = msg.data[row * width + col];
          // canvas は y 下向きなので上下反転して書き込む (world y 上向きに合わせる)
          const di = ((height - 1 - row) * width + col) * 4;
          let r = 30, g = 41, b = 59, a = 255; // unknown: slate
          if (v === 0) {
            r = 15; g = 23; b = 42; // free: 暗
          } else if (v > 0) {
            const t = Math.min(1, v / 100);
            r = 148 + t * 80; g = 163 + t * 60; b = 184 + t * 40; // occupied: 明
          }
          img.data[di] = r;
          img.data[di + 1] = g;
          img.data[di + 2] = b;
          img.data[di + 3] = a;
        }
      }
      ctx.putImageData(img, 0, 0);
      mapRef.current = {
        canvas: cv,
        originX: origin.position.x,
        originY: origin.position.y,
        width,
        height,
        resolution,
      };
    },
    { throttleRate: 5000 },
  );

  const fitView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const nodes = floorNodes(floor);
    for (const [x, y] of nodes) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const m = mapRef.current;
    if (m) {
      minX = Math.min(minX, m.originX);
      maxX = Math.max(maxX, m.originX + m.width * m.resolution);
      minY = Math.min(minY, m.originY);
      maxY = Math.max(maxY, m.originY + m.height * m.resolution);
    }
    if (!isFinite(minX)) return;
    const w = Math.max(maxX - minX, 5);
    const h = Math.max(maxY - minY, 5);
    viewRef.current.cx = (minX + maxX) / 2;
    viewRef.current.cy = (minY + maxY) / 2;
    viewRef.current.scale = Math.min(canvas.width / w, canvas.height / h) * 0.9;
    viewRef.current.fitted = true;
  }, [floor]);

  // 描画ループ
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let stop = false;

    const draw = () => {
      if (stop) return;
      const parent = canvas.parentElement;
      if (parent) {
        const w = parent.clientWidth;
        const h = Math.max(360, Math.min(560, Math.round(w * 0.62)));
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (!viewRef.current.fitted) fitView();
      if (follow && poseRef.current) {
        viewRef.current.cx = poseRef.current.x;
        viewRef.current.cy = poseRef.current.y;
      }
      const { cx, cy, scale } = viewRef.current;
      const W = canvas.width, H = canvas.height;
      const w2sx = (x: number) => W / 2 + (x - cx) * scale;
      const w2sy = (y: number) => H / 2 - (y - cy) * scale;

      ctx.fillStyle = "#020617";
      ctx.fillRect(0, 0, W, H);

      // OccupancyGrid
      const m = mapRef.current;
      if (m) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          m.canvas,
          w2sx(m.originX),
          w2sy(m.originY + m.height * m.resolution),
          m.width * m.resolution * scale,
          m.height * m.resolution * scale,
        );
      }

      // フロアグラフ
      const nodes = floorNodes(floor);
      ctx.strokeStyle = "rgba(100,116,139,0.5)";
      ctx.lineWidth = 1;
      for (const [i, j] of floorEdges(floor)) {
        const a = nodes[i], b = nodes[j];
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(w2sx(a[0]), w2sy(a[1]));
        ctx.lineTo(w2sx(b[0]), w2sy(b[1]));
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(148,163,184,0.7)";
      nodes.forEach(([x, y], i) => {
        ctx.beginPath();
        ctx.arc(w2sx(x), w2sy(y), 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(100,116,139,0.8)";
        ctx.font = "9px monospace";
        ctx.fillText(String(i), w2sx(x) + 4, w2sy(y) - 4);
        ctx.fillStyle = "rgba(148,163,184,0.7)";
      });
      // 部屋ラベル
      ctx.font = "11px sans-serif";
      for (const r of floorRooms(floor)) {
        ctx.fillStyle = "#7dd3fc";
        ctx.beginPath();
        ctx.arc(w2sx(r.x), w2sy(r.y), 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(r.name, w2sx(r.x) + 6, w2sy(r.y) + 4);
      }

      // 参照経路
      const path = pathRef.current;
      if (path.length > 1) {
        ctx.strokeStyle = "#34d399";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w2sx(path[0][0]), w2sy(path[0][1]));
        for (const [x, y] of path.slice(1)) ctx.lineTo(w2sx(x), w2sy(y));
        ctx.stroke();
      }
      // 参照点
      const rp = refPointRef.current;
      if (rp) {
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.arc(w2sx(rp[0]), w2sy(rp[1]), 6, 0, Math.PI * 2);
        ctx.fill();
      }

      const pose = poseRef.current;
      // LiDAR (推定姿勢基準の近似)
      const scan = scanRef.current;
      if (scan && pose) {
        ctx.fillStyle = "rgba(248,113,113,0.8)";
        const n = scan.ranges.length;
        const step = Math.max(1, Math.floor(n / 720));
        for (let i = 0; i < n; i += step) {
          const r = scan.ranges[i];
          if (r == null || !isFinite(r) || r < scan.range_min || r > scan.range_max)
            continue;
          const a = pose.yaw + scan.angle_min + i * scan.angle_increment;
          const x = pose.x + r * Math.cos(a);
          const y = pose.y + r * Math.sin(a);
          ctx.fillRect(w2sx(x) - 1, w2sy(y) - 1, 2, 2);
        }
      }

      // 自己位置
      if (pose) {
        const sx = w2sx(pose.x), sy = w2sy(pose.y);
        const covR = Math.sqrt(Math.max(pose.covXY, 0)) * 2 * scale;
        if (covR > 2) {
          ctx.strokeStyle = "rgba(96,165,250,0.5)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(sx, sy, covR, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = "#60a5fa";
        ctx.beginPath();
        ctx.arc(sx, sy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#dbeafe";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(
          sx + 16 * Math.cos(pose.yaw),
          sy - 16 * Math.sin(pose.yaw),
        );
        ctx.stroke();
        setPoseText(
          `x=${pose.x.toFixed(2)} y=${pose.y.toFixed(2)} yaw=${pose.yaw.toFixed(2)}`,
        );
      }
    };

    const timer = setInterval(draw, 100);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [floor, follow, fitView]);

  // パン / ズーム操作
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dragging = false;
    let lastX = 0, lastY = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const v = viewRef.current;
      v.cx -= (e.clientX - lastX) / v.scale;
      v.cy += (e.clientY - lastY) / v.scale;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onUp = () => {
      dragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      v.scale *= e.deltaY < 0 ? 1.15 : 1 / 1.15;
      v.scale = Math.max(1, Math.min(200, v.scale));
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, []);

  const zoom = (k: number) => {
    viewRef.current.scale = Math.max(1, Math.min(200, viewRef.current.scale * k));
  };

  const btn =
    "px-2 py-1 rounded border border-slate-600 text-slate-300 text-xs hover:bg-slate-800";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button className={btn} onClick={() => { viewRef.current.fitted = false; }}>
          全体表示
        </button>
        <button className={btn} onClick={() => zoom(1.3)}>＋</button>
        <button className={btn} onClick={() => zoom(1 / 1.3)}>－</button>
        <label className="flex items-center gap-1 text-slate-300 text-xs">
          <input
            type="checkbox"
            checked={follow}
            onChange={(e) => setFollow(e.target.checked)}
          />
          機体追従
        </label>
        <label className="flex items-center gap-1 text-slate-300 text-xs">
          <input
            type="checkbox"
            checked={showCamera}
            onChange={(e) => setShowCamera(e.target.checked)}
          />
          カメラ表示
        </label>
        <span className="ml-auto font-mono text-xs text-slate-400">
          {poseText}
        </span>
      </div>
      <div className="rounded-lg border border-slate-700 overflow-hidden">
        <canvas ref={canvasRef} style={{ touchAction: "none", display: "block" }} />
      </div>
      <div className="text-xs text-slate-500">
        表示: /map ・ /amcl_pose (青) ・ /rover_debug/ref_path (緑) ・
        /rf_reference_point_stamped (黄) ・ /scan (赤, 推定姿勢基準の近似) ・
        floor_map {floor}F グラフ
      </div>
      {showCamera && <CameraView ros={ros} />}
    </div>
  );
};

export default VizPanel;
