#!/usr/bin/env bash
# gateway에서 한 번만 sudo로 실행한다. 이후 배포(deploy.sh)는 sudo 없이 된다.
#   sudo bash ~/option-frontend/gateway-setup.sh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo 'sudo로 실행하세요'; exit 1; }
[ "$(hostname)" = gateway ] || { echo 'gateway에서 실행하세요'; exit 1; }

here=$(cd "$(dirname "$0")" && pwd)
owner=${SUDO_USER:-promevious}
sites=(/etc/nginx/sites-available/gateway-health /etc/nginx/conf.d/hangarae-funnel.conf)
include='    include snippets/option-frontend.conf;'
stamp=$(date -u +%Y%m%dT%H%M%SZ)

install -d -o "$owner" -g "$owner" -m 755 /var/www/option
install -m 644 "$here/option-frontend.conf" /etc/nginx/snippets/option-frontend.conf

backups=()
for f in "${sites[@]}"; do
    grep -qF 'snippets/option-frontend.conf' "$f" && continue
    cp -p "$f" "$f.before-option-frontend-$stamp"
    backups+=("$f")
    # 두 파일 모두 /api/ 블록 바로 위에 이 주석이 한 번씩 있다
    grep -c '# Option API: retain /api/' "$f" | grep -qx 1
    sed -i "s|^\(\s*\)# Option API: retain /api/|$include\n\n&|" "$f"
done

if nginx -t && systemctl reload nginx; then
    echo "적용 완료. 배포 폴더 /var/www/option (소유자 $owner)"
else
    for f in "${backups[@]}"; do cp -p "$f.before-option-frontend-$stamp" "$f"; done
    nginx -t && systemctl reload nginx
    echo '실패해서 원래 설정으로 되돌렸습니다'
    exit 1
fi
