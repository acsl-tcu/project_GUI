# 構成試行手順 (実験機 PC + RPi5 GUI サーバ + iPad)

対象ブランチ: `feature/gui-redesign` (main マージ前は各ホストで
`git fetch && git checkout feature/gui-redesign` を読み替えること)。

## 構成図

```
iPad ~~WLAN~~ AP/ルータ(192.168.197.0/24) ──有線── RPi5  : Next.js :3000 (+地図配信)
                       │
                       ~~6GHz WLAN~~ 実験機PC (例 .21)   : rf_rover 一式 (無変更)
                                                          + rosbridge :9090 (project_GUI 並置)
                                                          + management agent :7780
```

実験機側の既存デプロイ (`~/rover`, `project_launch.service`) には**一切手を入れない**。

## 1. 実験機 PC (ローバー)

### 1.1 project_GUI を並置デプロイ (初回のみ)

```bash
cd ~ && mkdir GUI && cd GUI
acsl init GUI 87        # RID はローバーと同じ (rf = 87)。同一 RID でないと橋渡しできない
# → clone 後に自動で acsl シェルに入る
```

既に `~/GUI` がある場合は `cd ~/GUI && gpull` で更新するだけでよい。

### 1.2 rosbridge コンテナ確認

```bash
acsl GUI                # ~/GUI の acsl シェルに入る
dup rosbridge           # dockerfiles/dockerfile.rosbridge から自動ビルド → 起動
dlogs rosbridge         # "Rosbridge WebSocket server started on port 9090" を確認
```

自動ビルドに失敗した場合の手動ビルド:

```bash
cd ~/GUI
docker build -f dockerfiles/dockerfile.rosbridge -t kasekiguchi/acsl-common:rosbridge$x86 .
dup rosbridge
```

### 1.3 management agent (systemd 常駐 + rosbridge 自動起動)

```bash
cd ~/GUI/management_agent
./install.sh ~/rover    # 引数 = 管理対象 (rf_rover デプロイ先)
systemctl --user status acsl-gui-agent    # active を確認
curl -s localhost:7780/api/health         # {"ok": true, ...} を確認
```

unit には `AGENT_START_BRIDGE=1` が入っており、**ホスト再起動時は agent が
`dup rosbridge` も自動実行**する。ローバー本体は従来どおり既存の
`project_launch.service` (または手動 `dup all EXP`) で起動する。

## 2. RPi5 (GUI Web サーバ)

Docker/acsl 不要。git + Node.js 18+ (Raspberry Pi OS bookworm 等) だけでよい。

```bash
# 2.1 リポジトリ取得
cd ~
git clone git@github.com:acsl-tcu/project_GUI.git
# 地図: 「環境共有アセット」規約 (~/ENV/<name>/repo) に従って配置。
# acsl 環境があるホストなら `env_sync bld10` 一発。RPi5 (acsl なし) では手動 clone:
mkdir -p ~/ENV/bld10
git clone git@github.com:acsl-tcu/environment_bld10.git ~/ENV/bld10/repo
# 以後の更新: git -C ~/ENV/bld10/repo pull

# 2.2 ビルド (RPi5 で数分)
cd ~/project_GUI/GUI
npm ci
npm run build

# 2.3 動作確認 (手動起動)
GUI_ENV=bld10 npm run start -- -p 3000     # → ~/ENV/bld10/repo/occupancy を配信
# 別端末から:
curl -s localhost:3000/api/floormap/4 | head -c 200   # 地図メタデータが返れば OK

# 2.4 systemd 化 (自動起動)
sed -e "s|@GUI_DIR@|$HOME/project_GUI/GUI|" \
    -e "s|@GUI_ENV@|bld10|" \
    ~/project_GUI/deploy/gui_web.service > ~/.config/systemd/user/gui_web.service
systemctl --user daemon-reload
systemctl --user enable --now gui_web.service
loginctl enable-linger "$USER"
```

## 3. ネットワーク

- AP/ルータ: サブネット 192.168.197.0/24。**AP のクライアント分離 (privacy separator) を無効**にする
  (iPad→実験機 PC の直接通信が必要)。
- 実験機 PC: 6GHz SSID、静的 IP (例 192.168.197.21)。
- RPi5: ルータに**有線**、静的 IP (例 192.168.197.10)。
- iPad: 同 WLAN に接続 (DHCP 可)。

## 4. iPad から使う

1. Safari で `http://192.168.197.10:3000` を開く
2. 右上「⚙ 接続設定」→ 実験機 PC ホストに `192.168.197.21`、Robot ID (通常 1) を入力して適用
3. ヘッダの `rosbridge` / `agent` バッジが両方緑になることを確認
4. ホーム画面に追加しておくと全画面のアプリ風に使える

## 5. 疎通チェックリスト

| 確認 | 期待 |
|---|---|
| ヘッダ rosbridge バッジ | 緑 (NG なら :9090 到達性 / dup rosbridge) |
| ヘッダ agent バッジ | 緑 (NG なら :7780 / systemctl --user status acsl-gui-agent) |
| HB タブ | status が 10Hz で更新、鮮度 OK (NG なら RID 不一致か rover 未起動を疑う) |
| コンソールタブで `hb` 送信 | 応答行がログに出る (agent → TCP:7720 中継) |
| 可視化タブ | 地図表示が「ローカル配信 (bld10_4F_slice.pgm)」になっている |
| 管理タブ | コンテナ一覧に rover / nav2 等が並ぶ |

## 6. よくあるハマり

- **rosbridge は緑だがトピックが来ない** → RID 不一致。rosbridge コンテナは `~/GUI/.acsl/bashrc` の
  `ROS_DOMAIN_ID` で動く。ローバー (87) と揃える (`setrid` 後 `drestart rosbridge`)。
- **agent NG** → user unit は SSH ログアウトで死ぬことがある → `loginctl enable-linger` を確認。
- **地図が「/map トピック」表示** → RPi5 の `GUI_ENV`/`GUI_MAP_DIR` 未設定、
  `~/ENV/<name>/repo` 未配備、またはファイル命名が `*_<N>F(_slice).yaml` 規約に
  合っていない。
- **iPad から実験機 PC に繋がらない** → AP のクライアント分離、または iPad が別サブネット。
