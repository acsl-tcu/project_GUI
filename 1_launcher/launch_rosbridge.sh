#!/usr/bin/bash

source /common/scripts/super_echo
echo "ROS bridge"
$(echo "exec ros2 launch rosbridge_server rosbridge_websocket_launch.xml --ros-args --remap __ns:=/${HOSTNAME}")
