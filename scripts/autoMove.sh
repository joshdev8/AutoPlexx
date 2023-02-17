#!/usr/bin/env bash

## meant to be run as a cron job every x amount of minutes

if ps -ef | grep -v grep | grep ffmpeg ; then
	"ffmpeg already running!"
	exit 0
else
	"ffmpeg NOT running, executing scripts"
	## MOVING TV SHOWS FROM SONARR ##
	echo 'CONVERTING TV SHOWS'
	cd ./sickbeard_mp4_automator && ./manual.py -i ~/Downloads/completed/sonarr -a &&
	cd ~/Downloads/completed/sonarr && mv *.mp4 /disks/wdeasystore2/tv

	## MOVING MOVIES FROM RADARR ##
	echo 'CONVERTING MOVIES'
	cd ./sickbeard_mp4_automator && ./manual.py -i ~/Downloads/completed/radarr -a &&
	cd ~/Downloads/completed/radarr && mv *.mp4 /disks/wdeasystore2/movies
fi