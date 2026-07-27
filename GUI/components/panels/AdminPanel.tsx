"use client";
// 管理タブ: management agent 経由のコンテナ管理 + YAML パラメータ編集 + システム状態。

import React, { useCallback, useEffect, useState } from "react";
import { GuiSettings } from "@/lib/settings";
import {
  AgentHealth,
  ContainerInfo,
  containerLogs,
  getConfig,
  getHealth,
  listConfigs,
  listContainers,
  projectAction,
  putConfig,
  restartContainer,
  stopContainer,
} from "@/lib/agent";

interface AdminPanelProps {
  settings: GuiSettings;
}

// 誤操作防止: 1 回目のクリックで確認状態になり、3 秒以内の再クリックで実行
function useConfirm(): [string | null, (key: string, fn: () => void) => void] {
  const [pending, setPending] = useState<string | null>(null);
  const ask = useCallback(
    (key: string, fn: () => void) => {
      if (pending === key) {
        setPending(null);
        fn();
      } else {
        setPending(key);
        setTimeout(() => setPending((p) => (p === key ? null : p)), 3000);
      }
    },
    [pending],
  );
  return [pending, ask];
}

const AdminPanel: React.FC<AdminPanelProps> = ({ settings }) => {
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [healthErr, setHealthErr] = useState("");
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [logsFor, setLogsFor] = useState("");
  const [logsText, setLogsText] = useState("");
  const [busy, setBusy] = useState("");
  const [actionOut, setActionOut] = useState("");
  const [pendingConfirm, askConfirm] = useConfirm();

  const [mode, setMode] = useState("EXP");
  const [modeConfig, setModeConfig] = useState("");

  const [configFiles, setConfigFiles] = useState<string[]>([]);
  const [configPath, setConfigPath] = useState("");
  const [configText, setConfigText] = useState("");
  const [configDirty, setConfigDirty] = useState(false);
  const [configMsg, setConfigMsg] = useState("");

  const refresh = useCallback(async () => {
    try {
      const h = await getHealth(settings);
      setHealth(h);
      setHealthErr("");
    } catch (e) {
      setHealth(null);
      setHealthErr(e instanceof Error ? e.message : String(e));
    }
    try {
      const c = await listContainers(settings);
      setContainers(c.containers);
    } catch {
      setContainers([]);
    }
  }, [settings]);

  useEffect(() => {
    void refresh();
    if (!autoRefresh) return;
    const t = setInterval(() => void refresh(), 5000);
    return () => clearInterval(t);
  }, [refresh, autoRefresh]);

  useEffect(() => {
    listConfigs(settings)
      .then((r) => setConfigFiles(r.files))
      .catch(() => setConfigFiles([]));
  }, [settings]);

  const runAction = async (label: string, fn: () => Promise<{ output: string }>) => {
    setBusy(label);
    setActionOut(`${label} 実行中...`);
    try {
      const r = await fn();
      setActionOut(`${label} 完了:\n${r.output}`);
    } catch (e) {
      setActionOut(`${label} 失敗: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy("");
      void refresh();
    }
  };

  const openConfig = async (path: string) => {
    setConfigPath(path);
    setConfigMsg("");
    setConfigDirty(false);
    try {
      const r = await getConfig(settings, path);
      setConfigText(r.content);
    } catch (e) {
      setConfigText("");
      setConfigMsg(`読み込み失敗: ${e instanceof Error ? e.message : e}`);
    }
  };

  const saveConfig = async () => {
    if (!configPath) return;
    try {
      const r = await putConfig(settings, configPath, configText);
      setConfigDirty(false);
      setConfigMsg(
        `保存しました (${r.output})。反映には該当コンテナの再起動が必要です (rover 設定なら drestart rover)。`,
      );
    } catch (e) {
      setConfigMsg(`保存失敗: ${e instanceof Error ? e.message : e}`);
    }
  };

  const btn =
    "px-2 py-1 rounded border text-xs font-semibold disabled:opacity-40";
  const confirmBtn = (key: string, label: string, cls: string, fn: () => void) => (
    <button
      className={`${btn} ${pendingConfirm === key ? "bg-red-600 border-red-400 text-white" : cls}`}
      disabled={busy !== ""}
      onClick={() => askConfirm(key, fn)}
    >
      {pendingConfirm === key ? "確認: もう一度" : label}
    </button>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        {/* システム状態 */}
        <section className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <h2 className="text-sm text-slate-400 mb-2">実験機 PC システム状態</h2>
          {health ? (
            <div className="text-sm font-mono space-y-1">
              <div>host: {health.hostname}</div>
              <div>uptime: {health.uptime}</div>
              <div>
                project_launch.service:{" "}
                <span
                  className={
                    health.project_launch === "active"
                      ? "text-emerald-400"
                      : "text-amber-400"
                  }
                >
                  {health.project_launch}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-red-400 text-sm">
              management agent に接続できません
              {healthErr && (
                <div className="text-xs text-slate-500 mt-1">{healthErr}</div>
              )}
            </div>
          )}
        </section>

        {/* コンテナ一覧 */}
        <section className="rounded-lg border border-slate-700 bg-slate-900 p-3">
          <div className="flex items-center mb-2">
            <h2 className="text-sm text-slate-400">コンテナ</h2>
            <label className="ml-auto flex items-center gap-1 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              自動更新
            </label>
            <button
              className={`${btn} border-slate-600 text-slate-300 ml-2`}
              onClick={() => void refresh()}
            >
              更新
            </button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 text-left">
                <th className="py-1">name</th>
                <th>state</th>
                <th>status</th>
                <th className="text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((c) => (
                <tr key={c.name} className="border-t border-slate-800">
                  <td className="py-1 font-mono">{c.name}</td>
                  <td>
                    <span
                      className={
                        c.state === "running"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {c.state}
                    </span>
                  </td>
                  <td className="text-slate-400">{c.status}</td>
                  <td className="text-right space-x-1 whitespace-nowrap">
                    {confirmBtn(
                      `restart:${c.name}`,
                      "drestart",
                      "border-amber-600 text-amber-400",
                      () =>
                        void runAction(`drestart ${c.name}`, () =>
                          restartContainer(settings, c.name),
                        ),
                    )}
                    {confirmBtn(
                      `stop:${c.name}`,
                      "stop",
                      "border-red-700 text-red-400",
                      () =>
                        void runAction(`stop ${c.name}`, () =>
                          stopContainer(settings, c.name),
                        ),
                    )}
                    <button
                      className={`${btn} border-slate-600 text-slate-300`}
                      onClick={async () => {
                        setLogsFor(c.name);
                        setLogsText("取得中...");
                        try {
                          const r = await containerLogs(settings, c.name, 200);
                          setLogsText(r.logs);
                        } catch (e) {
                          setLogsText(String(e));
                        }
                      }}
                    >
                      logs
                    </button>
                  </td>
                </tr>
              ))}
              {containers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-2 text-slate-500">
                    (コンテナ情報なし)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center gap-2 mt-3 pt-2 border-t border-slate-800">
            <span className="text-xs text-slate-400">プロジェクト一括:</span>
            <input
              className="w-24 rounded bg-slate-800 border border-slate-600 px-2 py-1 text-xs font-mono"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              placeholder="MODE"
            />
            <input
              className="w-36 rounded bg-slate-800 border border-slate-600 px-2 py-1 text-xs font-mono"
              value={modeConfig}
              onChange={(e) => setModeConfig(e.target.value)}
              placeholder="config.yaml (任意)"
            />
            {confirmBtn(
              "project:up",
              `dup all ${mode}`,
              "border-emerald-600 text-emerald-400",
              () =>
                void runAction(`dup all ${mode}`, () =>
                  projectAction(settings, "up", mode, modeConfig || undefined),
                ),
            )}
            {confirmBtn(
              "project:down",
              "drm all",
              "border-red-700 text-red-400",
              () => void runAction("drm all", () => projectAction(settings, "down")),
            )}
          </div>
          {actionOut && (
            <pre className="mt-2 max-h-40 overflow-auto bg-slate-950 rounded p-2 text-[10px] text-slate-300 whitespace-pre-wrap">
              {actionOut}
            </pre>
          )}
        </section>

        {/* ログ表示 */}
        {logsFor && (
          <section className="rounded-lg border border-slate-700 bg-slate-900 p-3">
            <div className="flex items-center mb-2">
              <h2 className="text-sm text-slate-400">logs: {logsFor}</h2>
              <button
                className={`${btn} border-slate-600 text-slate-300 ml-auto`}
                onClick={() => setLogsFor("")}
              >
                閉じる
              </button>
            </div>
            <pre className="h-64 overflow-auto bg-slate-950 rounded p-2 text-[10px] text-slate-300 whitespace-pre-wrap">
              {logsText}
            </pre>
          </section>
        )}
      </div>

      {/* パラメータ (YAML) */}
      <section className="rounded-lg border border-slate-700 bg-slate-900 p-3">
        <h2 className="text-sm text-slate-400 mb-2">
          パラメータチューニング (config/*.yaml)
        </h2>
        <div className="flex gap-2 mb-2">
          <select
            className="flex-1 rounded bg-slate-800 border border-slate-600 px-2 py-1 text-sm font-mono"
            value={configPath}
            onChange={(e) => void openConfig(e.target.value)}
          >
            <option value="">-- ファイル選択 --</option>
            {configFiles.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <button
            className={`${btn} ${configDirty ? "border-emerald-500 text-emerald-300 bg-emerald-900" : "border-slate-600 text-slate-400"}`}
            disabled={!configDirty}
            onClick={() => void saveConfig()}
          >
            保存 (.bak 退避)
          </button>
        </div>
        <textarea
          className="w-full h-[480px] rounded bg-slate-950 border border-slate-700 p-2 font-mono text-xs text-slate-200"
          spellCheck={false}
          value={configText}
          onChange={(e) => {
            setConfigText(e.target.value);
            setConfigDirty(true);
          }}
          placeholder="ファイルを選択してください"
        />
        {configMsg && (
          <div className="mt-2 text-xs text-amber-300">{configMsg}</div>
        )}
        <div className="mt-2 text-[11px] text-slate-500">
          注意: 設定は起動時読み込みのみ。保存後は該当コンテナを drestart すること。
          Saturation.maxv / maxw は実行中 slam_jump.normal_* で上書きされるため、
          速度上限は slam_jump 側を編集する。
        </div>
      </section>
    </div>
  );
};

export default AdminPanel;
