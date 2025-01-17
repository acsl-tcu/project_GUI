#!/usr/bin/bash

source /common/scripts/super_echo
echo "ROS bridge"
export ROS_AUTOMATIC_DISCOVERY_RANGE=LOCALHOST
export ROS_STATIC_PEERS=$(ip a | grep 192 | grep -o 'inet [0-9]\+\.[0-9]\+\.[0-9]\+\.[0-9]\+' | grep -o [0-9].*)
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
#$(echo "exec ros2 launch rosbridge_server rosbridge_websocket_launch.xml")
