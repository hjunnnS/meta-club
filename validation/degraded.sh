#!/bin/bash
set -eu
# Only G0 candidates' return traffic. Host and database interfaces are untouched.
tc_in() {
  docker run --rm --cap-drop ALL --cap-add NET_ADMIN --network "container:meta-club-g0-check-$1-1" nicolaka/netshoot:v0.14 tc "${@:2}"
}
configured=()
cleanup() {
  for service in "${configured[@]}"; do
    tc_in "$service" qdisc del dev eth0 root || true
  done
}
trap cleanup EXIT
for service in colyseus nakama; do
  port=7350
  if [ "$service" = colyseus ]; then port=7351; fi
  tc_in "$service" qdisc add dev eth0 root handle 1: prio bands 3 priomap 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
  configured+=("$service")
  tc_in "$service" qdisc add dev eth0 parent 1:3 handle 30: netem delay 150ms loss 2%
  tc_in "$service" filter add dev eth0 protocol ip parent 1: prio 1 u32 match ip protocol 6 0xff match ip sport "$port" 0xffff flowid 1:3
done
RUN_SUFFIX=-degraded node run.cjs colyseus nakama
for service in colyseus nakama; do
  tc_in "$service" -s qdisc show dev eth0
done
