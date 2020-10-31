#!/bin/bash
ISTIO_WAIT_SECONDS=30

if [ "$WAIT_FOR_ISTIO" != "false" ]; then
  echo "Waiting for envoy to become ready for a maximum of $ISTIO_WAIT_SECONDS seconds."
  attempts=0
  while ! curl -s -f http://127.0.0.1:15020/healthz/ready; do
    attempts=$((attempts+1))
    if [ "$attempts" -gt "$ISTIO_WAIT_SECONDS" ]; then
      echo "Envoy was not ready within 30 seconds."
      exit 1
    fi
    sleep 1
  done

  echo "Envoy is up."
fi

node /app/lib/index.js $*
