#! /usr/bin/bash +x
# dup all <MODE> で呼ばれるプロジェクト起動スクリプト。
#   MODE:
#     bridge : rosbridge のみ (実験機 PC への並置デプロイ用)
#     web    : rosbridge + GUI (Next.js dev) — 開発用
#     kiosk  : rosbridge + GUI + chrome (現地キオスク運用, 既定)
cd $ACSL_WORK_DIR
source $ACSL_ROS2_DIR/bashrc
MODE="${1:-kiosk}"
echo "PROJECT=$PROJECT ROS_DOMAIN_ID=$ROS_DOMAIN_ID MODE=$MODE"

case "$MODE" in
  bridge)
    dup rosbridge
    ;;
  web)
    dup rosbridge
    dup GUI
    ;;
  kiosk | *)
    dup rosbridge
    dup GUI
    dup chrome
    ;;
esac

echo "complete launch ($MODE)"
