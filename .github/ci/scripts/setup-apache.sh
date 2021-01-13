#!/bin/bash

set -e

# set home directory permissions to be readable by apache
sudo chmod 0755 $(pwd)

# install apache
sudo apt-get update --allow-unauthenticated
sudo apt-get install apache2 libapache2-mod-fastcgi
sudo a2enmod rewrite actions fastcgi alias env

phpenv config-add .github/server-config/php.ini

sudo rm -f /etc/apache2/sites-available/*
sudo rm -f /etc/apache2/sites-enabled/*

 # set up web server config
echo "Setting up FPM ..."

sudo cp -f .github/server-config/php-fpm.conf ~/.phpenv/versions/$(phpenv version-name)/etc/php-fpm.conf

echo "cgi.fix_pathinfo = 1" >> ~/.phpenv/versions/$(phpenv version-name)/etc/php.ini
~/.phpenv/versions/$(phpenv version-name)/sbin/php-fpm

sudo cp -f .github/server-config/apache-fpm.conf /etc/apache2/sites-available/pimcore-test.dev.conf

# enable pimcore-test.dev config
sudo ln -s /etc/apache2/sites-available/pimcore-test.dev.conf /etc/apache2/sites-enabled/pimcore-test.dev.conf

VHOSTCFG=/etc/apache2/sites-available/pimcore-test.dev.conf

# configure apache virtual hosts - config was copied in the individual setup scripts above (FPM)
sudo sed -e "s?%GITHUB_WORKSPACE_DIR%?$(pwd)?g" -i $VHOSTCFG
sudo sed -e "s?%PIMCORE_ENVIRONMENT%?$PIMCORE_ENVIRONMENT?g" -i $VHOSTCFG
sudo sed -e "s?%PIMCORE_TEST_DB_DSN%?$PIMCORE_TEST_DB_DSN?g" -i $VHOSTCFG
sudo sed -e "s?%PIMCORE_TEST_CACHE_REDIS_DATABASE%?$PIMCORE_TEST_CACHE_REDIS_DATABASE?g" -i $VHOSTCFG

sudo service apache2 restart