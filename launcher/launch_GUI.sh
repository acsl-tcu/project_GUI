#!/usr/bin/bash

source /common/scripts/super_echo
echo "NPM START"
eval "if [[ ! -d node_modules ]];then echo 'NPM INSTALL'; npm i; fi; npm run dev"
