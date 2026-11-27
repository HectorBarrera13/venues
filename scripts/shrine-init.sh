#!/usr/bin/env bash
# One-time bootstrap of the venue-db replica set on the shrine host.
#
# Prisma's MongoDB connector needs a single-node replica set (rs0) for
# relation writes (see VEN-701 / compose.yaml). docker compose starts it via
# the api container's healthcheck, but Shrine resources have no init hook, so
# after the FIRST deploy of the subagentes team the set must be initiated once.
#
# Run this ON THE HOST THAT RUNS SHRINE (apps.tail9a6ddb.ts.net), after
# "shrine deploy team subagentes" has created the containers.
#
# Usage:
#   ./scripts/shrine-init.sh [container] [member-host]
#
#   container     Shrine resource container. Default: subagentes.venue-db
#   member-host   The hostname the API resolves for the db. Verify it first
#                 with: shrine describe resource venue-db   (its exported host)
set -euo pipefail

CONTAINER="${1:-subagentes.venue-db}"
MEMBER_HOST="${2:-$CONTAINER}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Container '$CONTAINER' is not running. Deploy first: shrine deploy team subagentes" >&2
  exit 1
fi

echo "Initiating rs0 on $CONTAINER (member: $MEMBER_HOST:27017)"
docker exec "$CONTAINER" mongosh --quiet --eval "
  try {
    print('already initiated, ok=' + rs.status().ok);
  } catch (e) {
    print('initiating: ok=' + rs.initiate({_id: 'rs0', members: [{ _id: 0, host: '${MEMBER_HOST}:27017' }]}).ok);
  }
"

echo "Waiting for PRIMARY..."
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER" mongosh --quiet --eval "db.hello().isWritablePrimary" | grep -q true; then
    echo "rs0 is PRIMARY. venue-db ready for prisma db push."
    exit 0
  fi
  sleep 1
done
echo "replica set did not reach PRIMARY in 30s; check: docker logs $CONTAINER" >&2
exit 1
