#! /bin/bash
# https://wiki.archlinux.jp/index.php/%E3%83%87%E3%82%B9%E3%82%AF%E3%83%88%E3%83%83%E3%83%97%E3%82%A8%E3%83%B3%E3%83%88%E3%83%AA
sed -i "s|\$ACSL_WORK_DIR|$ACSL_WORK_DIR|g" project_launch*.sh
sed -i "s|\$ACSL_ROS2_DIR|$ACSL_ROS2_DIR|g" project_launch*.sh

dup GUI
sed -i "s/ACSL_WORK_DIR/${ACSL_WORK_DIR}/" ./start_kiosk.desktop
desktop-file-install --dir=$HOME/.local/share/applications ./start_kiosk.desktop
update-desktop-database -v ~/.local/share/applications

gecho After display "Ready", reboot the system
dlogs GUI
