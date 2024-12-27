"use client"
import React, { useEffect } from 'react';
import ROSLIB from 'roslib';

interface RosConnectionProps {
  rosUrl: string;
  rosDomainId: number;
  setRos: (ros: ROSLIB.Ros) => void;
}

const Rosconnection: React.FC<RosConnectionProps> = ({ rosUrl, rosDomainId, setRos }) => {

  useEffect(() => {
    const ros = new ROSLIB.Ros({
      url: rosUrl,
      options: {
        ros_domain_id: rosDomainId // ROS_DOMAIN_IDを設定する
      }
    });

    ros.on("connection", () => {
      setRos(ros);
      const statusElement = document.getElementById("status");
      if (statusElement) {
        statusElement.innerHTML = "successful";
      }
      console.log('Connected to ROSBridge WebSocket server.');
    });

    ros.on('error', function (error: Error) {
      console.log('Error connecting to ROSBridge WebSocket server: ', error);
    });

    ros.on('close', function () {
      console.log('Connection to ROSBridge WebSocket server closed.');
    });

    return () => {
      ros.close();
    };
  }, [rosUrl, rosDomainId, setRos]);
  return ("no ROS connection");
}

export default Rosconnection;