#!/bin/bash -e

echo "Starting logging ..."
sudo journalctl -u tuya2mqtt.service -f

echo "Done!"
