#!/bin/bash

set -eu

mkdir -p var/config

sudo chown -R www-data:www-data var

cp -r .github/ci/files/app app
cp -r .github/ci/files/bin/console bin/console
cp -r .github/ci/files/web web

cp .github/ci/files/extensions.template.php var/config/extensions.php
cp app/config/parameters.example.yml app/config/parameters.yml
