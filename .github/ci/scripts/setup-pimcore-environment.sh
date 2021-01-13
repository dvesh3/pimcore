#!/bin/bash

set -eu

mkdir -p var/config
mkdir -p var/logs

sudo chmod 0777 var/logs

cp -r .github/ci/files/app app
cp -r .github/ci/files/bin/console bin/console
cp -r .github/ci/files/web web

cp .github/ci/files/extensions.template.php var/config/extensions.php
cp app/config/parameters.example.yml app/config/parameters.yml
