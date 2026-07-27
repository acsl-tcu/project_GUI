"use client";
// HB タブ: /Robot{rid}/Heartbeat (std_msgs/String, 10Hz) の可視化。
// 機体側 watchdog (2s) に合わせ、受信間隔で OK / WARN / LOST を判定する。

import React, { useEffect, useRef, useState } from "react";
import ROSLIB from "roslib";
import { useTopic } from "@/lib/useRos";
import { parseHb, HbFields } from "@/lib/hb";
import { GuiSettings } from "@/lib/settings";

interface StringMsg {
  data: string;
}

interface HBPanelProps {
  ros: ROSLIB.Ros | null;
  settings: GuiSettings;
}

const HISTORY_MAX = 60;

const HBPanel: React.FC<HBPanelProps> = ({ ros, settings }) => {
  const [hb, setHb] = useState<HbFields | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const lastRxRef = useRef<number>(0);
  const [ageSec, setAgeSec] = useState<number | null>(null);

  useTopic<StringMsg>(
    ros,
    `/Robot${settings.rid}/Heartbeat`,
    "std_msgs/String",
    (msg) => {
      lastRxRef.current = Date.now();
      setHb(parseHb(msg.data));
      setHistory((h) => [...h.slice(-(HISTORY_MAX - 1)), msg.data]);
    },
    { throttleRate: 200 },
  );

  useEffect(() => {
    const t = setInterval(() => {
      setAgeSec(
        lastRxRef.current ? (Date.now() - lastRxRef.current) / 1000 : null,
      );
    }, 250);
    return () => clearInterval(t);
  }, []);

  const fresh =
    ageSec == null ? "none" : ageSec < 2 ? "ok" : ageSec < 5 ? "warn" : "lost";
  const freshLabel = {
    none: "未受信",
    ok: `OK (${ageSec?.toFixed(1)}s)`,
    warn: `WARN (${ageSec?.toFixed(1)}s)`,
    lost: `LOST (${ageSec?.toFixed(0)}s)`,
  }[fresh];
  const freshClass = {
    none: "bg-slate-700 text-slate-300",
    ok: "bg-emerald-600 text-white",
    warn: "bg-amber-500 text-black",
    lost: "bg-red-600 text-white",
  }[fresh];

  const Card = ({ title, value }: { title: string; value?: string }) => (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-3">
      <div className="text-xs text-slate-400">{title}</div>
      <div className="font-mono text-sm mt-1 break-all">{value ?? "--"}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={`px-4 py-2 rounded-full font-bold ${freshClass}`}>
          HB {freshLabel}
        </span>
        <span className="text-2xl font-bold text-slate-100">
          {hb?.status ?? "--"}
        </span>
        {hb?.seek && (
          <span className="px-2 py-1 rounded bg-purple-700 text-white text-xs">
            {hb.seek}
          </span>
        )}
        <span className="ml-auto text-xs text-slate-500 font-mono">
          /Robot{settings.rid}/Heartbeat t={hb?.t?.toFixed(1) ?? "--"}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card title="Goal [floor, id]" value={hb?.goal && `[${hb.goal}]`} />
        <Card title="Local [gid, gid_xy]" value={hb?.local && `[${hb.local}]`} />
        <Card
          title={`Est (${hb?.estSrc ?? "?"}) floor/cid`}
          value={
            hb?.estFloor != null ? `${hb.estFloor}F node ${hb.estCid}` : undefined
          }
        />
        <Card
          title="Est pose [x, y, yaw]"
          value={
            hb?.estX != null
              ? `${hb.estX.toFixed(2)}, ${hb.estY?.toFixed(2)}, ${hb.estYaw?.toFixed(2)}`
              : undefined
          }
        />
        <Card title="seg [cid > nid]" value={hb?.seg && `[${hb.seg}]`} />
        <Card title="Route" value={hb?.route && `[${hb.route}]`} />
        <Card title="cov [σx, σy, σyaw]" value={hb?.cov && `[${hb.cov}]`} />
        <Card title="LiDAR / gain / rate" value={
          hb ? `L[${hb.lidar ?? "-"}] k:${hb.gain ?? "-"} r:${hb.rate ?? "-"}` : undefined
        } />
      </div>

      <section className="rounded-lg border border-slate-700 bg-slate-900 p-3">
        <h2 className="text-sm text-slate-400 mb-2">
          生ログ (直近 {HISTORY_MAX} 件)
        </h2>
        <pre className="h-64 overflow-auto bg-slate-950 rounded p-2 text-[10px] leading-4 text-slate-300 whitespace-pre-wrap break-all">
          {history.length ? [...history].reverse().join("\n") : "HB 未受信"}
        </pre>
      </section>
    </div>
  );
};

export default HBPanel;
