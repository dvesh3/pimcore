#!/bin/bash

set -eu

mkdir -p var/config

cp -r .github/ci/files/app app
cp -r .github/ci/files/bin/console bin/console
cp -r .github/ci/files/web web

HTTPDUSER=$(ps axo user,comm | grep -E '[a]pache|[h]ttpd|[_]www|[w]ww-data|[n]ginx' | grep -v root | head -1 | cut -d\  -f1)
sudo setfacl -dR -m u:"$HTTPDUSER":rwX -m u:$(whoami):rwX app/config bin composer.json var web
sudo setfacl -R -m u:"$HTTPDUSER":rwX -m u:$(whoami):rwX app/config bin composer.json var web

cp .github/ci/files/extensions.template.php var/config/extensions.php
cp app/config/parameters.example.yml app/config/parameters.yml
