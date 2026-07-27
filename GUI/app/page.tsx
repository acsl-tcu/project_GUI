"use client";
// ACSL Rover GUI: コンソール / 可視化 / HB / 管理 の 4 タブ構成。
// 接続先 (実験機 PC のホスト・ポート・RID) は右上の設定から変更し localStorage に保存。

import React, { useEffect, useState } from "react";
import {
  GuiSettings,
  defaultSettings,
  loadSettings,
  saveSettings,
  rosbridgeUrl,
} from "@/lib/settings";
import { getHealth } from "@/lib/agent";
import { useRos } from "@/lib/useRos";
import ConsolePanel from "@/components/panels/ConsolePanel";
import VizPanel from "@/components/panels/VizPanel";
import HBPanel from "@/components/panels/HBPanel";
import AdminPanel from "@/components/panels/AdminPanel";

type Tab = "console" | "viz" | "hb" | "admin";

const TABS: { id: Tab; label: string }[] = [
  { id: "console", label: "コンソール" },
  { id: "viz", label: "可視化" },
  { id: "hb", label: "HB" },
  { id: "admin", label: "管理" },
];

export default function Home() {
  const [settings, setSettings] = useState<GuiSettings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("console");
  const [showSettings, setShowSettings] = useState(false);
  const [agentOk, setAgentOk] = useState<boolean | null>(null);
  const [floor, setFloor] = useState(4);

  // localStorage は client でのみ読める (hydration mismatch 回避)
  useEffect(() => {
    setSettings(loadSettings());
    setLoaded(true);
  }, []);

  const { ros, status, reconnect } = useRos(
    loaded ? rosbridgeUrl(settings) : "ws://localhost:9090",
  );

  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    const ping = () =>
      getHealth(settings)
        .then(() => alive && setAgentOk(true))
        .catch(() => alive && setAgentOk(false));
    void ping();
    const t = setInterval(ping, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [settings, loaded]);

  const applySettings = (s: GuiSettings) => {
    setSettings(s);
    saveSettings(s);
  };

  const rosBadge = {
    connected: ["rosbridge OK", "bg-emerald-600"],
    connecting: ["rosbridge 接続中", "bg-amber-500"],
    closed: ["rosbridge 切断", "bg-red-600"],
    error: ["rosbridge エラー", "bg-red-600"],
  }[status];

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 backdrop-blur px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-lg mr-2">
            ACSL Rover GUI{" "}
            <span className="text-xs text-slate-500 font-normal">
              Robot{settings.rid} @ {settings.roverHost}
            </span>
          </span>
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`px-4 py-1.5 rounded-t text-sm font-semibold ${
                  tab === t.id
                    ? "bg-slate-800 text-white border-b-2 border-emerald-500"
                    : "text-slate-400 hover:text-white"
                }`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 text-xs">
            <button
              className={`px-2 py-1 rounded text-white ${rosBadge[1]}`}
              onClick={reconnect}
              title="クリックで再接続"
            >
              {rosBadge[0]}
            </button>
            <span
              className={`px-2 py-1 rounded text-white ${
                agentOk == null
                  ? "bg-slate-700"
                  : agentOk
                    ? "bg-emerald-600"
                    : "bg-red-600"
              }`}
            >
              agent {agentOk == null ? "--" : agentOk ? "OK" : "NG"}
            </span>
            <button
              className="px-2 py-1 rounded border border-slate-600 text-slate-300 hover:bg-slate-800"
              onClick={() => setShowSettings((v) => !v)}
            >
              ⚙ 接続設定
            </button>
          </div>
        </div>
        {showSettings && (
          <SettingsForm
            settings={settings}
            onApply={(s) => {
              applySettings(s);
              setShowSettings(false);
            }}
          />
        )}
      </header>

      <div className="p-3 max-w-7xl mx-auto">
        {/* タブは hidden 切替 (購読・履歴を維持するため unmount しない) */}
        <div className={tab === "console" ? "" : "hidden"}>
          <ConsolePanel
            ros={ros}
            settings={settings}
            floor={floor}
            setFloor={setFloor}
          />
        </div>
        <div className={tab === "viz" ? "" : "hidden"}>
          <VizPanel ros={ros} settings={settings} floor={floor} />
        </div>
        <div className={tab === "hb" ? "" : "hidden"}>
          <HBPanel ros={ros} settings={settings} />
        </div>
        <div className={tab === "admin" ? "" : "hidden"}>
          <AdminPanel settings={settings} />
        </div>
      </div>
    </main>
  );
}

function SettingsForm({
  settings,
  onApply,
}: {
  settings: GuiSettings;
  onApply: (s: GuiSettings) => void;
}) {
  const [form, setForm] = useState<GuiSettings>(settings);
  useEffect(() => setForm(settings), [settings]);

  const field = (label: string, node: React.ReactNode) => (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      {node}
    </label>
  );
  const input = "rounded bg-slate-800 border border-slate-600 px-2 py-1 text-sm";

  return (
    <div className="mt-2 flex flex-wrap items-end gap-3 rounded-lg border border-slate-700 bg-slate-900 p-3">
      {field(
        "実験機 PC ホスト/IP",
        <input
          className={`${input} w-44`}
          value={form.roverHost}
          onChange={(e) => setForm({ ...form, roverHost: e.target.value })}
        />,
      )}
      {field(
        "rosbridge port",
        <input
          className={`${input} w-24`}
          value={form.rosbridgePort}
          inputMode="numeric"
          onChange={(e) =>
            setForm({ ...form, rosbridgePort: Number(e.target.value) || 9090 })
          }
        />,
      )}
      {field(
        "agent port",
        <input
          className={`${input} w-24`}
          value={form.agentPort}
          inputMode="numeric"
          onChange={(e) =>
            setForm({ ...form, agentPort: Number(e.target.value) || 7780 })
          }
        />,
      )}
      {field(
        "Robot ID",
        <input
          className={`${input} w-20`}
          value={form.rid}
          inputMode="numeric"
          onChange={(e) => setForm({ ...form, rid: Number(e.target.value) || 1 })}
        />,
      )}
      {field(
        "agent token (任意)",
        <input
          className={`${input} w-36`}
          value={form.agentToken}
          onChange={(e) => setForm({ ...form, agentToken: e.target.value })}
        />,
      )}
      <button
        className="px-4 py-1.5 rounded bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
        onClick={() => onApply(form)}
      >
        適用
      </button>
    </div>
  );
}
