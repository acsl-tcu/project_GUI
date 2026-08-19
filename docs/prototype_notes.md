# プロトタイプ実装メモ (feature/gui-redesign)

全体設計は `gui_redesign_proposal.md` 参照。ここは実装の構成と動かし方のみ。

## フロントエンド (GUI/)

```
app/page.tsx                 タブシェル + ヘッダ (接続状態バッジ / 接続設定)
lib/settings.ts              接続設定 (host/port/RID/token) を localStorage 管理
lib/useRos.ts                rosbridge 接続 hook (5s 自動再接続) + useTopic
lib/agent.ts                 management agent REST クライアント
lib/hb.ts                    Heartbeat 文字列パーサ
lib/floorMap.ts              floor_map.json ヘルパ (ノード/エッジ/部屋)
components/Joystick.tsx      teleop (/rover_twist, PointerEvents = iPad 対応)
components/CameraView.tsx    CompressedImage 表示
components/panels/
  ConsolePanel.tsx           目標位置・初期推定値・start/stop/reset/save・コマンドログ
  VizPanel.tsx               2D Canvas (map/pose/path/scan/フロアグラフ, パン/ズーム)
  HBPanel.tsx                HB フィールド分解 + 鮮度 (OK<2s/WARN<5s/LOST) + 生ログ
  AdminPanel.tsx             コンテナ管理 / dup all / YAML エディタ / システム状態
types/roslib.d.ts            roslib の最小型定義
```

設計上のポイント:

- コンソール送信は **agent (HTTP→TCP:7720) が第一**。応答が GUI のログに出る。
  agent 不達時は `/Robot{rid}/console2robot` (Int8MultiArray) へフォールバック
  (int のみ・即時発進なので注意表示を出す)。
- タブは unmount せず CSS hidden 切替 (購読と履歴の維持)。
- 危険操作 (drestart / drm all / dup all) は 3 秒以内の 2 回クリックで実行する確認方式。
- 旧 `RID_IN_PAGE` sed / `RosConnection` / `CMD` / `RosDataButton` / `CameraData` は廃止・置換。

## management agent (management_agent/)

- `agent.py` — Python 標準ライブラリのみ。API 一覧は提案書 §4.5。
- コンテナ再起動は `.acsl/bashrc` を source して `drestart` を呼ぶ
  (RID 引き継ぎのため `docker restart` は使わない)。`DUP_SKIP_RID_CHECK=1` 付き。
- YAML 保存はパストラバーサル防止 (`config/` 配下限定) + `.bak` 退避。
- 導入: `./install.sh ~/rover` (systemd user unit + linger)。手動なら
  `ACSL_WORK_DIR=~/rover python3 agent.py`。

## 動作確認手順

```bash
# --- 実験機 PC ---
dup all EXP                     # 機体 (rosbridge が要る場合: dup rosbridge)
cd <project_GUI>/management_agent && ./install.sh ~/rover

# --- GUI サーバ (開発時は同一マシンでも可) ---
cd <project_GUI>/GUI
npm i
npm run dev                     # 本番: npm run build && npm run start
# → http://<GUIサーバ>:3000 を iPad で開き、⚙接続設定に実験機 PC の IP を入力
```

## 2 回目の更新で入ったもの

- **現 infra レイアウトへ全面移行**: `1_launcher/`→`launcher/`, `2_ros_packages/`→`packages/`,
  `3_dockerfiles/`→`dockerfiles/` (compose override も `dockerfiles/` 配下へ)。
- **dockerfile 再構築**: `dockerfile.GUI` (rosbridge+Node+Chromium) と
  軽量な `dockerfile.rosbridge` (実験機 PC 並置用、`dup rosbridge` で自動ビルド)。
  rf_rover 側は無変更。
- **project_launch.sh をモード化**: `dup all bridge` (rosbridge のみ) / `web` / `kiosk` (既定)。
- **agent の rosbridge 自動起動**: unit の `AGENT_START_BRIDGE=1` で起動時に `dup rosbridge`。
  実験機 PC の追加 systemd は agent 1 本で済む (既存 project_launch.service と競合しない)。
- **フロア地図のローカル配信**: GUI サーバの `GUI_MAP_DIR` に environment の occupancy を
  指すと `/api/floormap/<floor>` (+`/image`) が map_server 形式 yaml+PGM/PNG を配信。
  Viz はこれを優先し **/map トピックは購読しない** (無線のフロア切替スパイク解消)。
  無ければ従来どおり /map にフォールバック。
- 見た目の刷新: ダークテーマ固定 + セグメントタブ + 生存ドット付きステータスピル。
- 試行手順: `docs/setup_guide.md`。

## 既知の制約 / TODO (Phase 1 以降)

- `/scan` 描画は TF を引かず推定姿勢基準の近似 (LiDAR 取付オフセット未考慮)。
- ローカル地図はファイル命名規約 `*_<N>F(_slice).yaml` 依存 (bld10 準拠)。他環境は要確認。
- キオスクの `launch_GUI.sh` は `npm run dev` のまま (現地キオスク用途なら build+start 化したい)。
- YAML エディタは構文チェックなし (保存前の yaml lint は Phase 2)。
- ドローン対応・3D 表示 (three.js 導入済み)・costmap 表示は Phase 2 以降。
