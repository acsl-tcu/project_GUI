# project_GUI

ROS トピックベースの機体操作 Web GUI (コンソール / 可視化 / HB / 管理)。

- 設計・アーキテクチャ: [docs/gui_redesign_proposal.md](docs/gui_redesign_proposal.md)
- 実装メモ: [docs/prototype_notes.md](docs/prototype_notes.md)
- **実験機 PC + RPi5 + iPad での試行手順: [docs/setup_guide.md](docs/setup_guide.md)**

## 構成

| ディレクトリ | 内容 |
|---|---|
| `GUI/` | Next.js アプリ (iPad 等のブラウザから利用) |
| `management_agent/` | 機体ホスト常駐の管理 REST API (コンテナ操作 / YAML 編集 / コンソール中継) |
| `launcher/` | コンテナ内起動スクリプト (rosbridge / GUI / chrome) |
| `dockerfiles/` | `dockerfile.GUI` (フル) / `dockerfile.rosbridge` (実験機 PC 用軽量) |
| `deploy/` | GUI サーバ用 systemd unit テンプレート |

## Setup (キオスク運用: 同一マシンで GUI+ブラウザ表示)

Follow [acsl install and Usage chapter](https://github.com/acsl-tcu/acsl).

```bash
mkdir GUI
cd GUI
acsl init GUI RID
./setup.sh
```

## Usage (Manual execute)

```bash
acsl GUI
dup all            # kiosk モード (rosbridge + GUI + chrome)
dup all bridge     # rosbridge のみ (実験機 PC への並置デプロイ用)
dup all web        # rosbridge + GUI (開発用)
```

GUI サーバ (RPi5 等) 単体で動かす場合は Docker 不要:

```bash
cd GUI && npm ci && npm run build
GUI_ENV=bld10 npm run start -- -p 3000   # 地図は ~/ENV/bld10/repo/occupancy から配信
```
