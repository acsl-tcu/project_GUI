#!/usr/bin/bash

source /common/scripts/super_echo
echo "KIOSK START"
#$(echo "exec google-chrome-stable --enable-features=WebUIDarkMode --force-dark-mode http://localhost:3000 --kiosk --no-sandbox")
if id -u $hostUID >/dev/null 2>&1; then
  echo "== user exists ======================"
  username=$(getent passwd $hostUID | sed 's/:.*//' else)
  su ${username}
else
  echo "== user add ====================="
  groupadd -g ${hostGID} acslgroup
  adduser -m -u ${hostUID} -g ${hostGID} dstudent
  su dstudent
fi
$(echo "exec chromium --enable-features=WebUIDarkMode --force-dark-mode http://localhost:3000 --kiosk --no-sandbox")
