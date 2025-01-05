#! /usr/bin/bash +x

source $ACSL_ROS2_DIR/bashrc
echo $PROJECT
echo $ROS_DOMAIN_ID

dup rosbridge
dup GUI

echo "sleep 10 seconds"
sleep 10
dup chrome
