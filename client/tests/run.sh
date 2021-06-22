#!/usr/bin/env sh
if [[ -n "${CI}" ]]; then
  export DISPLAY=":99"
  export LD_LIBRARY_PATH="/usr/lib64/"
  yum -y install xorg-x11-server-Xvfb && rm -rf /var/cache/yum
  Xvfb :99 -screen 0 640x480x8 -nolisten tcp &
fi

npm test

exitCode=$?

if [[ -n "${CI}" ]]; then
  pkill Xvfb
  echo "Xvfb has been stopped"
fi

exit $exitCode
