#!/bin/sh
# gateways throttle; progress is cached, so just retry until it finishes
for i in 1 2 3 4 5 6 7 8 9 10; do
  node build-data.mjs --images && exit 0
  echo "attempt $i failed, retrying"; sleep 5
done
exit 1
