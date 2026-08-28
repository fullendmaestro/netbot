#!/bin/bash
set -e

echo "1. Adding GNS3 PPA and installing dependencies..."
sudo add-apt-repository -y ppa:gns3/ppa
sudo apt-get update
sudo apt-get install -y gns3-server qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils ubridge dynamips

echo "2. Adding user to virtualization groups..."
sudo usermod -aG ubridge,libvirt,kvm $USER

echo "3. Configuring GNS3 Server..."
mkdir -p ~/.config/GNS3/2.2/
cat <<EOF > ~/.config/GNS3/2.2/gns3_server.conf
[Server]
host = 0.0.0.0
port = 3080
auto_start = True
auth = False
EOF

echo "4. Creating Systemd Service..."
sudo bash -c "cat <<EOF > /etc/systemd/system/gns3.service
[Unit]
Description=GNS3 Server
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=/usr/bin/gns3server
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF"

sudo systemctl daemon-reload
sudo systemctl enable --now gns3

echo "========================================================="
echo "✅ GNS3 Server Installation Complete!"
sudo systemctl status gns3 --no-pager
echo "========================================================="