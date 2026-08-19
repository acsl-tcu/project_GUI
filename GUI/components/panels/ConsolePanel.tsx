"use client";
// コンソールタブ: 目標位置設定・初期推定値指定・start/stop/reset/save + teleop。
// 送信は management agent の HTTP→TCP 中継 (フル機能・応答あり) を第一とし、
// agent 不達時は rosbridge の /Robot{rid}/console2robot (int のみ・即発進) に落とす。

import React, { useCallback, useRef, useState } from "react";
import ROSLIB from "roslib";
import { GuiSettings } from "@/lib/settings";
import { sendConsoleCmd } from "@/lib/agent";
import { FLOOR_NUMS, floorRooms } from "@/lib/floorMap";
import Joystick from "@/components/Joystick";

interface LogEntry {
  time: string;
  dir: "tx" | "rx" | "err";
  text: string;
}

interface ConsolePanelProps {
  ros: ROSLIB.Ros | null;
  settings: GuiSettings;
  floor: number;
  setFloor: (f: number) => void;
}

const ConsolePanel: React.FC<ConsolePanelProps> = ({
  ros,
  settings,
  floor,
  setFloor,
}) => {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [initFloor, setInitFloor] = useState("");
  const [initCid, setInitCid] = useState("");
  const [initYaw, setInitYaw] = useState("");
  const [saveName, setSaveName] = useState("rover");
  const [manualCmd, setManualCmd] = useState("");
  const busyRef = useRef(false);

  const appendLog = useCallback((dir: LogEntry["dir"], text: string) => {
    const time = new Date().toLocaleTimeString("ja-JP", { hour12: false });
    setLog((l) => [...l.slice(-99), { time, dir, text }]);
  }, []);

  const fallbackTopic = useCallback(
    (cmd: string) => {
      if (!ros) return false;
      // int 配列で表現できるコマンドだけトピックに落とせる
      let data: number[] | null = null;
      if (cmd === "stop") data = [0, 0];
      else if (cmd.startsWith("target ")) {
        const nums = cmd
          .slice(7)
          .trim()
          .split(/[\s,[\]]+/)
          .filter(Boolean)
          .map(Number);
        if (nums.length >= 2 && nums.every((n) => Number.isInteger(n)))
          data = nums;
      }
      if (!data) return false;
      const topic = new ROSLIB.Topic({
        ros,
        name: `/Robot${settings.rid}/console2robot`,
        messageType: "std_msgs/Int8MultiArray",
      });
      topic.publish(
        new ROSLIB.Message({
          layout: {
            dim: [{ label: "length", size: data.length, stride: data.length }],
            data_offset: 0,
          },
          data,
        }),
      );
      appendLog("rx", `(topic fallback: /Robot${settings.rid}/console2robot [${data}] — 即時発進に注意)`);
      return true;
    },
    [ros, settings.rid, appendLog],
  );

  const send = useCallback(
    async (cmd: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      appendLog("tx", cmd);
      try {
        const res = await sendConsoleCmd(settings, cmd);
        appendLog("rx", res.reply || "(no reply)");
      } catch (e) {
        appendLog("err", `agent 不達: ${e instanceof Error ? e.message : e}`);
        if (!fallbackTopic(cmd)) {
          appendLog("err", "トピック代替も不可 (rosbridge 未接続 or 非対応コマンド)");
        }
      } finally {
        busyRef.current = false;
      }
    },
    [settings, appendLog, fallbackTopic],
  );

  const sendTarget = (targetFloor: number, targetId: number, room: string) => {
    setSelectedRoom(room);
    let cmd = `target ${targetFloor} ${targetId}`;
    if (initFloor !== "" && initCid !== "") {
      cmd += ` ${initFloor} ${initCid}`;
      if (initYaw !== "") cmd += ` ${initYaw}`;
    }
    void send(cmd);
  };

  const rooms = floorRooms(floor);
  const btn =
    "px-3 py-2 rounded font-semibold border transition-colors text-sm";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        {/* フロア選択 */}
        <section className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3 shadow-md shadow-black/20">
          <h2 className="text-sm text-slate-400 mb-2">目標位置 (standby 設定 → start で発進)</h2>
          <div className="flex gap-1 mb-3">
            {FLOOR_NUMS.map((f) => (
              <button
                key={f}
                className={`${btn} ${f === floor ? "bg-emerald-600 border-emerald-500 text-white" : "border-slate-600 text-slate-300 hover:bg-slate-800"}`}
                onClick={() => setFloor(f)}
              >
                {f}F
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {rooms.map((r) => (
              <button
                key={r.name}
                className={`${btn} ${selectedRoom === r.name ? "bg-emerald-600 border-emerald-500 text-white" : "border-emerald-700 text-emerald-400 hover:bg-slate-800"}`}
                onClick={() => sendTarget(floor, r.targetId, r.name)}
              >
                {r.name}
              </button>
            ))}
            {rooms.length === 0 && (
              <div className="text-slate-500 text-sm col-span-3">
                このフロアに登録された部屋はありません
              </div>
            )}
          </div>
        </section>

        {/* 初期推定値 */}
        <section className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3 shadow-md shadow-black/20">
          <h2 className="text-sm text-slate-400 mb-2">
            初期推定値 (入力すると target 送信時に付加され AMCL 再シードされる)
          </h2>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              className="w-24 rounded bg-slate-800 border border-slate-600 px-2 py-1 text-sm"
              placeholder="floor"
              value={initFloor}
              onChange={(e) => setInitFloor(e.target.value)}
              inputMode="numeric"
            />
            <input
              className="w-24 rounded bg-slate-800 border border-slate-600 px-2 py-1 text-sm"
              placeholder="node id"
              value={initCid}
              onChange={(e) => setInitCid(e.target.value)}
              inputMode="numeric"
            />
            <input
              className="w-28 rounded bg-slate-800 border border-slate-600 px-2 py-1 text-sm"
              placeholder="yaw [rad] 任意"
              value={initYaw}
              onChange={(e) => setInitYaw(e.target.value)}
              inputMode="decimal"
            />
            <button
              className={`${btn} border-slate-600 text-slate-300 hover:bg-slate-800`}
              onClick={() => {
                setInitFloor("");
                setInitCid("");
                setInitYaw("");
              }}
            >
              クリア
            </button>
          </div>
        </section>

        {/* 実行制御 */}
        <section className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3 shadow-md shadow-black/20">
          <h2 className="text-sm text-slate-400 mb-2">実行制御</h2>
          <div className="flex flex-wrap gap-2">
            <button
              className={`${btn} bg-emerald-700 border-emerald-500 text-white hover:bg-emerald-600`}
              onClick={() => void send("start")}
            >
              ▶ start
            </button>
            <button
              className={`${btn} bg-red-700 border-red-500 text-white hover:bg-red-600 px-6`}
              onClick={() => void send("stop")}
            >
              ■ STOP
            </button>
            <button
              className={`${btn} border-amber-600 text-amber-400 hover:bg-slate-800`}
              onClick={() => void send("reset")}
            >
              reset
            </button>
            <button
              className={`${btn} border-slate-600 text-slate-300 hover:bg-slate-800`}
              onClick={() => void send("hb")}
            >
              hb
            </button>
            <span className="inline-flex items-center gap-1">
              <input
                className="w-28 rounded bg-slate-800 border border-slate-600 px-2 py-1 text-sm"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
              <button
                className={`${btn} border-sky-600 text-sky-400 hover:bg-slate-800`}
                onClick={() => void send(`save ${saveName}`)}
              >
                save
              </button>
            </span>
          </div>
          <div className="flex gap-1 mt-3">
            <input
              className="flex-1 rounded bg-slate-800 border border-slate-600 px-2 py-1 text-sm font-mono"
              placeholder="任意コマンド (例: target 1 1 4 15 1.57)"
              value={manualCmd}
              onChange={(e) => setManualCmd(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && manualCmd.trim()) {
                  void send(manualCmd.trim());
                  setManualCmd("");
                }
              }}
            />
            <button
              className={`${btn} border-slate-600 text-slate-300 hover:bg-slate-800`}
              onClick={() => {
                if (manualCmd.trim()) {
                  void send(manualCmd.trim());
                  setManualCmd("");
                }
              }}
            >
              送信
            </button>
          </div>
        </section>
      </div>

      <div className="space-y-4">
        {/* コマンドログ */}
        <section className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3 shadow-md shadow-black/20">
          <h2 className="text-sm text-slate-400 mb-2">コマンドログ</h2>
          <div className="h-64 overflow-y-auto font-mono text-xs space-y-1 bg-slate-950 rounded p-2">
            {log.length === 0 && (
              <div className="text-slate-600">まだコマンドを送信していません</div>
            )}
            {[...log].reverse().map((e, i) => (
              <div
                key={log.length - i}
                className={
                  e.dir === "tx"
                    ? "text-sky-300"
                    : e.dir === "rx"
                      ? "text-emerald-300"
                      : "text-red-400"
                }
              >
                <span className="text-slate-500">{e.time}</span>{" "}
                {e.dir === "tx" ? "»" : e.dir === "rx" ? "«" : "!"} {e.text}
              </div>
            ))}
          </div>
        </section>

        {/* teleop */}
        <section className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-3 shadow-md shadow-black/20">
          <h2 className="text-sm text-slate-400 mb-2">
            手動操作 (/rover_twist 直接 publish)
          </h2>
          <div className="flex justify-center py-2">
            {ros ? (
              <Joystick ros={ros} />
            ) : (
              <div className="text-slate-500 text-sm py-8">
                rosbridge 未接続のため使用できません
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ConsolePanel;
