#!/usr/bin/bash

source /common/scripts/super_echo
echo "KIOSK START"
#$(echo "exec google-chrome-stable --enable-features=WebUIDarkMode --force-dark-mode http://localhost:3000 --kiosk --no-sandbox")
if id -u $hostUID >/dev/null 2>&1; then
  username=$(getent passwd 1000 | sed 's/:.*//' else)
  su ${username}
else
  adduser -m -u $hostUID dstudent
  su dstudent
fi
$(echo "exec chromium --enable-features=WebUIDarkMode --force-dark-mode http://localhost:3000 --kiosk --no-sandbox")
