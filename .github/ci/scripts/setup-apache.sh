#!/bin/bash

set -e

# set home directory permissions to be readable by apache
sudo chmod -R 755 $(pwd)

# install apache
sudo apt-get update --allow-unauthenticated
sudo apt-get install apache2
sudo a2enmod rewrite actions alias
sudo apt-get install -y php7.3-fpm
sudo service php7.3-fpm start

sudo mv /etc/apache2/ports.conf /etc/apache2/ports.conf.default
echo "Listen 8080" | sudo tee /etc/apache2/ports.conf

sudo cp -f .github/ci/files/apache/php-fpm.conf /etc/php/7.3/fpm/pool.d/www.conf


tail -f journalctl -xe
sudo systemctl restart php7.3-fpm.service

sudo rm -f /etc/apache2/sites-available/*
sudo rm -f /etc/apache2/sites-enabled/*

sudo cp -f .github/ci/files/apache/apache-fpm.conf /etc/apache2/sites-available/pimcore-test.dev.conf
sudo ln -s /etc/apache2/sites-available/pimcore-test.dev.conf /etc/apache2/sites-enabled/pimcore-test.dev.conf

VHOSTCFG=/etc/apache2/sites-enabled/pimcore-test.dev.conf

# configure apache virtual hosts - config was copied in the individual setup scripts above (FPM)
sudo sed -e "s?%GITHUB_WORKSPACE_DIR%?$(pwd)?g" -i $VHOSTCFG
sudo sed -e "s?%PIMCORE_ENVIRONMENT%?$PIMCORE_ENVIRONMENT?g" -i $VHOSTCFG
sudo sed -e "s?%PIMCORE_TEST_DB_DSN%?$PIMCORE_TEST_DB_DSN?g" -i $VHOSTCFG
sudo sed -e "s?%PIMCORE_TEST_CACHE_REDIS_DATABASE%?$PIMCORE_TEST_CACHE_REDIS_DATABASE?g" -i $VHOSTCFG
sudo sed -e "s?%PIMCORE_TEST_PHP_VERSION%?$PIMCORE_TEST_PHP_VERSION?g" -i $VHOSTCFG

sudo systemctl restart apache2.service
