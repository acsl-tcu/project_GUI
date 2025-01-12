#! /bin/bash

desktop-file-install --dir=$HOME/.local/share/applications ~/start_kiosk.desktop
update-desktop-database -v ~/.local/share/applications
