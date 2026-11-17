#!/usr/bin/env bash
# 빌드해서 gateway의 /var/www/option에 올린다. ssh 설정에 gateway 호스트가 있어야 한다.
#   bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

npm ci
npm run build

# shortcut: 지우고 다시 푸는 사이 1초 안쪽으로 빈 화면이 날 수 있다. 사용자가 늘면 폴더 교체 방식으로 바꾼다
tar -C dist -cf - . | ssh gateway 'set -e; cd /var/www/option; find . -mindepth 1 -delete; tar -xf -'
echo '배포 완료: https://1.230.71.10/option/'
