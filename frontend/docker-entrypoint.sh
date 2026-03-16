#!/bin/sh
set -e

# AUTH_USERNAME ve AUTH_PASSWORD artik kullanilmiyor, Nginx'ten basic auth kaldirildi

# nginx config'deki $INTERNAL_SECRET → gerçek değerle değiştir
envsubst '$INTERNAL_SECRET' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'