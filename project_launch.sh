#! /usr/bin/bash +x
cd $ACSL_WORK_DIR
source $ACSL_ROS2_DIR/bashrc
echo $PROJECT
echo $ROS_DOMAIN_ID

dup rosbridge
dup GUI

echo "sleep 10 seconds"
sleep 10
#unclutter -idle 0.1 -root
dup chrome
echo "complete launch"
