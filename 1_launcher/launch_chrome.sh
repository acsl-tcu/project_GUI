#!/usr/bin/bash

source /common/scripts/super_echo
echo "KIOSK START"
$(echo "exec google-chrome-stable --enable-features=WebUIDarkMode --force-dark-mode http://localhost:3000 --kiosk --no-sandbox")
