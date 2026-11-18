#!/usr/bin/env bash
# Install the kUSD relay as a self-contained copy in ~/.local/share/kusd-relay (nothing there may point
# back into a git checkout) and its systemd user unit. Keeps an existing store.json. Re-run after changes.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
dest="${KUSD_RELAY_DIR:-$HOME/.local/share/kusd-relay}"

mkdir -p "$dest/wasm"
cp "$repo"/lib/kusd/{relay,client,file-store,fetch-limit}.mjs "$dest/"
cp "$repo"/lib/kusd/wasm/{kusd_client_wasm.mjs,kusd_client_wasm_bg.wasm,SOURCE.json} "$dest/wasm/"
sed "s#'../../lib/kusd/#'./#g" "$here/server.mjs" > "$dest/server.mjs"
# pinned covenant IDs of the current deployment, from the bundled showcase snapshot
node --input-type=module -e "
  import { readFileSync, writeFileSync } from 'node:fs';
  import { pinsFromSnapshot } from '$dest/relay.mjs';
  writeFileSync('$dest/pins.json', JSON.stringify(pinsFromSnapshot(JSON.parse(readFileSync('$repo/public/kusd/snapshot.json', 'utf8'))), null, 2) + '\n');
"
mkdir -p "$HOME/.config/systemd/user"
cp "$here/kusd-relay.service" "$HOME/.config/systemd/user/kusd-relay.service"

if grep -rIl -e "$repo" -e /home/murr/kusd- "$dest" --exclude=store.json; then
  echo "refusing: the files above reference a checkout" >&2
  exit 1
fi
systemctl --user daemon-reload
echo "installed to $dest (pins: $(tr -d '\n ' < "$dest/pins.json" | cut -c1-80)...)"
