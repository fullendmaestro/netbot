#!/bin/bash
set -e

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo su)"
  exit 1
fi

echo "1. Adding PHP PPA and Installing Required Packages..."
add-apt-repository ppa:ondrej/php -y
apt-get update
apt-get install -y acl curl fping git mariadb-client mariadb-server mtr-tiny nginx-full nmap php-cli php-common php-curl php-fpm php-gd php-gmp php-json php-mbstring php-mysql php-snmp php-xml php-zip php8.4-cli php8.4-common php8.4-curl php8.4-fpm php8.4-gd php8.4-gmp php8.4-mbstring php8.4-mysql php8.4-snmp php8.4-xml php8.4-zip python3-dotenv python3-pip python3-psutil python3-pymysql python3-redis python3-setuptools python3-systemd rrdtool snmp snmpd socat traceroute unzip whois

update-alternatives --set php /usr/bin/php8.4

echo "2. Adding librenms user and cloning repository..."
useradd librenms -d /opt/librenms -M -r -s "$(which bash)"
git clone https://github.com/librenms/librenms.git /opt/librenms

echo "3. Setting permissions..."
chown -R librenms:librenms /opt/librenms
chmod 771 /opt/librenms
setfacl -d -m g::rwx /opt/librenms/rrd /opt/librenms/logs /opt/librenms/bootstrap/cache/ /opt/librenms/storage/
setfacl -R -m g::rwx /opt/librenms/rrd /opt/librenms/logs /opt/librenms/bootstrap/cache/ /opt/librenms/storage/

echo "4. Installing PHP dependencies..."
su - librenms -c "/opt/librenms/scripts/composer_wrapper.php install --no-dev"

echo "5. Configuring MariaDB..."
systemctl enable --now mariadb
mysql -e "CREATE DATABASE IF NOT EXISTS librenms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER IF NOT EXISTS 'librenms'@'localhost' IDENTIFIED BY 'librenms_password';"
mysql -e "ALTER USER 'librenms'@'localhost' IDENTIFIED BY 'librenms_password';"
mysql -e "GRANT ALL PRIVILEGES ON librenms.* TO 'librenms'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "6. Configuring PHP-FPM..."
cp /etc/php/8.4/fpm/pool.d/www.conf /etc/php/8.4/fpm/pool.d/librenms.conf
sed -i 's/\[www\]/\[librenms\]/g' /etc/php/8.4/fpm/pool.d/librenms.conf
sed -i 's/user = www-data/user = librenms/g' /etc/php/8.4/fpm/pool.d/librenms.conf
sed -i 's/group = www-data/group = librenms/g' /etc/php/8.4/fpm/pool.d/librenms.conf
sed -i 's|listen = /run/php/.*|listen = /run/php-fpm-librenms.sock|g' /etc/php/8.4/fpm/pool.d/librenms.conf
rm -f /etc/php/8.4/fpm/pool.d/www.conf
systemctl disable --now php8.1-fpm || true
systemctl enable php8.4-fpm
systemctl restart php8.4-fpm

echo "7. Configuring NGINX..."
cat <<'NGINX' > /etc/nginx/conf.d/librenms.conf
server {
    listen      80;
    server_name _;
    root        /opt/librenms/html;
    index       index.php;
    charset     utf-8;
    gzip on;
    gzip_types text/css application/javascript text/javascript application/x-javascript image/svg+xml text/plain text/xsd text/xsl text/xml image/x-icon;
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }
    location ~ [^/]\.php(/|$) {
        fastcgi_pass unix:/run/php-fpm-librenms.sock;
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        include fastcgi.conf;
    }
    location ~ /\.(?!well-known).* {
        deny all;
    }
}
NGINX
rm -f /etc/nginx/sites-enabled/default
systemctl restart nginx

echo "8. Configuring SNMP, Cron, and Scheduler..."
cp /opt/librenms/snmpd.conf.example /etc/snmp/snmpd.conf
sed -i 's/RANDOMSTRINGGOESHERE/public/g' /etc/snmp/snmpd.conf
curl -s -o /usr/bin/distro https://raw.githubusercontent.com/librenms/librenms-agent/master/snmp/distro
chmod +x /usr/bin/distro
systemctl enable --now snmpd

cp /opt/librenms/dist/librenms.cron /etc/cron.d/librenms
cp /opt/librenms/dist/librenms-scheduler.service /opt/librenms/dist/librenms-scheduler.timer /etc/systemd/system/
systemctl enable --now librenms-scheduler.timer
cp /opt/librenms/misc/librenms.logrotate /etc/logrotate.d/librenms

ln -sf /opt/librenms/lnms /usr/bin/lnms
cp /opt/librenms/misc/lnms-completion.bash /etc/bash_completion.d/

echo "========================================================="
echo "✅ LibreNMS Server Installation Complete!"
echo "Database User: librenms"
echo "Database Pass: librenms_password"
echo "========================================================="