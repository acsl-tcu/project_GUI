#! /usr/bin/bash

source /common/scripts/super_echo
if [[ ! -d node_modules ]]; then
  echo "SET UP GUI"
  npm i
fi
npm run dev
