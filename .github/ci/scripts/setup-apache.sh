#!/bin/bash

set -e

# set home directory permissions to be readable by apache
sudo chmod -R 755 $(pwd)

# install apache
sudo apt-get update --allow-unauthenticated
sudo apt-get install apache2

#wget https://mirrors.edge.kernel.org/ubuntu/pool/multiverse/liba/libapache-mod-fastcgi/libapache2-mod-fastcgi_2.4.7~0910052141-1.2_amd64.deb
#sudo dpkg -i libapache2-mod-fastcgi_2.4.7~0910052141-1.2_amd64.deb

sudo mv /etc/apache2/ports.conf /etc/apache2/ports.conf.default
echo "Listen 8080" | sudo tee /etc/apache2/ports.conf

ls -la /etc/php/7.3/fpm/pool.d/
ls -la /etc/php/7.3/fpm/

sudo cp -f .github/ci/files/apache/php-fpm.conf /etc/php/7.3/fpm/pool.d/www.conf
sudo cp -f .github/ci/files/apache/php-fpm.conf /etc/php/7.3/fpm/php-fpm.conf

cat /etc/php/7.3/fpm/pool.d/www.conf

sudo apache2ctl configtest
sudo systemctl status php7.0-fpm.service

sudo systemctl restart php7.3-fpm.service

sudo tail -f journalctl -xe

sudo a2enmod rewrite actions alias

sudo rm -f /etc/apache2/sites-available/*
sudo rm -f /etc/apache2/sites-enabled/*

sudo cp -f .github/ci/files/apache/apache-fpm.conf /etc/apache2/sites-available/pimcore-test.dev.conf

# enable pimcore-test.dev config
sudo ln -s /etc/apache2/sites-available/pimcore-test.dev.conf /etc/apache2/sites-enabled/pimcore-test.dev.conf

VHOSTCFG=/etc/apache2/sites-enabled/pimcore-test.dev.conf

# configure apache virtual hosts - config was copied in the individual setup scripts above (FPM)
sudo sed -e "s?%GITHUB_WORKSPACE_DIR%?$(pwd)?g" -i $VHOSTCFG
sudo sed -e "s?%PIMCORE_ENVIRONMENT%?$PIMCORE_ENVIRONMENT?g" -i $VHOSTCFG
sudo sed -e "s?%PIMCORE_TEST_DB_DSN%?$PIMCORE_TEST_DB_DSN?g" -i $VHOSTCFG
sudo sed -e "s?%PIMCORE_TEST_CACHE_REDIS_DATABASE%?$PIMCORE_TEST_CACHE_REDIS_DATABASE?g" -i $VHOSTCFG
sudo sed -e "s?%PIMCORE_TEST_PHP_VERSION%?$PIMCORE_TEST_PHP_VERSION?g" -i $VHOSTCFG

sudo apache2ctl configtest
sudo systemctl restart apache2.service
journalctl | tail
