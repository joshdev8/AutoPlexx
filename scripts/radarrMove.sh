#!/usr/bin/env bash

echo 'CONVERTING MOVIES'
cd ./sickbeard_mp4_automator && ./manual.py -i ~/Downloads/completed/radarr -a &&
cd ~/Downloads/completed/radarr && mv * /disks/wdeasystore2/movies