#!/bin/bash

set -e
set -o xtrace

if [[ -n "${CI}" ]]; then
  apt-get update
  apt-get install -y xvfb libsecret-1-0 iproute2
  Xvfb :99 -screen 0 640x480x8 -nolisten tcp &
  XVFB_PID=$!
  export DISPLAY=":99"
fi

npm test

if [[ -n "${CI}" ]]; then
  kill $XVFB_PID
  echo "Xvfb has been stopped"
fi
