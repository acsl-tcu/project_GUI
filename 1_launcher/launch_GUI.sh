#!/usr/bin/bash

source /common/scripts/super_echo
echo "NPM START"
#$(echo "exec chmod a+x ./start_GUI.sh && ./start_GUI.sh")
eval "if [[ ! -d node_modules ]];then npm i; fi; npm run dev"
