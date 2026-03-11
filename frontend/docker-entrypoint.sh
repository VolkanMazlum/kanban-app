#!/bin/sh
set -e

# .htpasswd dosyasını env'den oluştur
# AUTH_USERNAME ve AUTH_PASSWORD docker-compose'dan gelir
htpasswd -cb /etc/nginx/.htpasswd "$AUTH_USERNAME" "$AUTH_PASSWORD"

# nginx config'deki $INTERNAL_SECRET → gerçek değerle değiştir
envsubst '$INTERNAL_SECRET' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'