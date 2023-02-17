#!/usr/bin/env bash

echo 'CONVERTING TV SHOWS'
cd ./sickbeard_mp4_automator && ./manual.py -i ~/Downloads/completed/sonarr -a &&
cd ~/Downloads/completed/sonarr && mv * /disks/wdeasystore2/tv