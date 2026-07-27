#!/usr/bin/env bash
# management agent を systemd user unit として導入する。
# 実験機 PC 上で実行: ./install.sh [ACSL_WORK_DIR]
#   ACSL_WORK_DIR: 対象プロジェクトのデプロイ先 (例 ~/rover)。
#                  省略時は環境変数 ACSL_WORK_DIR を使う。
set -euo pipefail

WORK="${1:-${ACSL_WORK_DIR:-}}"
if [[ -z "$WORK" ]]; then
  echo "usage: $0 <ACSL_WORK_DIR>   (例: $0 ~/rover)" >&2
  exit 1
fi
WORK="$(cd "$WORK" && pwd)"
DIR="$(cd "$(dirname "$0")" && pwd)"

mkdir -p "$HOME/.config/systemd/user"
sed -e "s|@AGENT_PY@|$DIR/agent.py|" \
    -e "s|@ACSL_WORK_DIR@|$WORK|" \
    "$DIR/acsl-gui-agent.service" \
    > "$HOME/.config/systemd/user/acsl-gui-agent.service"

systemctl --user daemon-reload
systemctl --user enable --now acsl-gui-agent.service
# ログアウト後も user unit を動かし続ける
loginctl enable-linger "$USER" || true

echo "== installed. 状態確認: systemctl --user status acsl-gui-agent"
echo "== ログ: journalctl --user -u acsl-gui-agent -f"
