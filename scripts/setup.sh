#!/bin/bash
set -e

if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo su)"
  exit 1
fi

# Prompt the user for the base URL
echo "========================================================="
read -p "Enter the Base URL for LibreNMS (e.g., http://192.168.1.50 or https://nms.example.com): " USER_BASE_URL

# Ensure the user didn't leave it blank
if [ -z "$USER_BASE_URL" ]; then
  echo "❌ Error: Base URL cannot be empty. Exiting."
  exit 1
fi
echo "========================================================="

echo "1. Fixing Python Dependencies via pip..."
# Install the required Python packages directly from LibreNMS requirements
pip3 install -r /opt/librenms/requirements.txt

echo "2. Setting Base URL..."
# Apply the user-provided base_url to the web UI
su - librenms -c "lnms config:set base_url $USER_BASE_URL"

echo "3. Configuring LibreNMS Dispatcher Service..."
# Prevent duplicate polling by disabling existing cron-based pollers 
rm -f /etc/cron.d/librenms

# Ensure python3-systemd is installed (required for watchdog service)
apt-get update
apt-get install -y python3-systemd

# Setup the Dispatcher Watchdog Service
cp /opt/librenms/misc/librenms-watchdog.service /etc/systemd/system/librenms.service
systemctl daemon-reload
systemctl enable --now librenms.service

echo "4. Restricting Processing to Dispatcher..."
# Tell LibreNMS to use the dispatcher for scheduling
su - librenms -c "lnms config:set schedule_type.poller dispatcher"
su - librenms -c "lnms config:set schedule_type.services dispatcher"
su - librenms -c "lnms config:set schedule_type.discovery dispatcher"
su - librenms -c "lnms config:set schedule_type.alerting dispatcher"
su - librenms -c "lnms config:set schedule_type.billing dispatcher"

echo "========================================================="
echo "✅ LibreNMS Services and Fixes Applied Successfully!"
echo "🌐 Base URL set to: $USER_BASE_URL"
echo "========================================================="