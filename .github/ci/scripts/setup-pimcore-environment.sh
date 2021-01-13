#!/bin/bash

set -eu

mkdir -p var/config

HTTPDUSER=$(ps axo user,comm | grep -E '[a]pache|[h]ttpd|[_]www|[w]ww-data|[n]ginx' | grep -v root | head -1 | cut -d\  -f1)
sudo setfacl -dR -m u:"$HTTPDUSER":rwX -m u:$(whoami):rwX var
sudo setfacl -R -m u:"$HTTPDUSER":rwX -m u:$(whoami):rwX var

cp -r .github/ci/files/app app
cp -r .github/ci/files/bin/console bin/console
cp -r .github/ci/files/web web

cp .github/ci/files/extensions.template.php var/config/extensions.php
cp app/config/parameters.example.yml app/config/parameters.yml
