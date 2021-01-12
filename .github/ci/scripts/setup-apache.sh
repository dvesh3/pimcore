#!/bin/bash

set -e

# set home directory permissions to be readable by apache
sudo chmod 0755 $PIMCORE_PROJECT_ROOT

# install apache
sudo apt-get update --allow-unauthenticated
sudo apt-get install apache2

wget https://mirrors.edge.kernel.org/ubuntu/pool/multiverse/liba/libapache-mod-fastcgi/libapache2-mod-fastcgi_2.4.7~0910052141-1.2_amd64.deb
sudo dpkg -i libapache2-mod-fastcgi_2.4.7~0910052141-1.2_amd64.deb

sudo mv /etc/apache2/ports.conf /etc/apache2/ports.conf.default
echo "Listen 8010" | sudo tee /etc/apache2/ports.conf

sudo a2dissite 000-default

sudo cp -f .github/ci/files/apache/apache-fpm.conf /etc/apache2/sites-available/pimcore-test.dev.conf

VHOSTCFG=/etc/apache2/sites-available/pimcore-test.dev.conf

echo "test pwd:"
sudo journalctl | tail
echo $(pwd)

# configure apache virtual hosts - config was copied in the individual setup scripts above (FPM)
sudo sed -e "s?%GITHUB_WORKSPACE_DIR%?$(pwd)?g" -i $VHOSTCFG
sudo sed -e "s?%PIMCORE_ENVIRONMENT%?$PIMCORE_ENVIRONMENT?g" -i $VHOSTCFG
sudo sed -e "s?%PIMCORE_TEST_DB_DSN%?$PIMCORE_TEST_DB_DSN?g" -i $VHOSTCFG
sudo sed -e "s?%PIMCORE_TEST_CACHE_REDIS_DATABASE%?$PIMCORE_TEST_CACHE_REDIS_DATABASE?g" -i $VHOSTCFG

sudo a2ensite pimcore-test.dev

sudo systemctl restart apache2
cat systemctl status apache2.service