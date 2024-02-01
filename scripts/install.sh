#!/usr/bin/env bash
set -eo pipefail

CURRENT_DIR=$(cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd)
echo "1. Installation"
"${CURRENT_DIR}/install_deps_ubuntu.sh"
echo "2. Deps"
pip3 install -r requirements.txt && npm install
echo "3. Installation"
"${CURRENT_DIR}/build_sc_web.sh"