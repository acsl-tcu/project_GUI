#! /usr/bin/bash +x

source $ACSL_ROS2_DIR/bashrc
echo $PROJECT
echo $ROS_DOMAIN_ID

dup rosbridge
dup GUI
sleep 10
dup chrome
