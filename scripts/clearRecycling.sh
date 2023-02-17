#!/usr/bin/env bash

read -p "Are you sure? " -n 1 -r
echo    # (optional) move to a new line
if [[ $REPLY =~ ^[Yy]$ ]]
then
    # do dangerous stuff
    echo 'CLEARING RECYCLING BIN'
    cd ~/Downloads/completed/recyclingBin && rm -Rf * && cd ~/Downloads/completed && tree;
    echo 'done'