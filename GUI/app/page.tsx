"use client"
import React, { useState } from 'react';
import CameraData from '../components/CameraData';
import RosCmd from '../components/CMD';
import Rosconnection from '../components/RosConnection';
import RosDataButton from '../components/RosDataButton';
import bld_data from '../components/floor_map.json';

//  grid-rows-[20px_1fr_20px] 
export default function Home() {
  const [ros, setRos] = useState(null);
  const floor_nums = [...Array(5)].map((_, i) => i + 1);
  const [floor, setFloor] = useState(4);
  const [room, setRoom] = useState("");
  const keys = Object.keys(bld_data[floor])
  const places = keys.filter(key => { return key !== "node" && key !== "adjacency" && key !== "elevator_hall" && key !== "elevator" && bld_data[floor][key].length > 0; });
  const rid = 1 // robot id : TODO 
  return (
    <main>
      <Rosconnection rosUrl="ws://localhost:9090" rosDomainId={87} setRos={setRos} />
      <br />
      {ros && <>
        <div key="SellectFloor" className="grid grid-cols-1 gap-4  content-stretch py-2">
          <div className="col-span-1 flex items-center justify-center">
            {floor_nums.map((i, index) => (
              <button key={"floor" + i}
                type="button"
                className={`px-4 py-2 text-sm font-medium text-gray-900 bg-white border border-gray-200 ${index === 0 ? "rounded-s-lg" : index === floor_nums.length - 1 ? "rounded-e-lg" : ""} ${i === floor ? "dark:bg-green-500" : "dark:bg-gray-800"} hover:bg-gray-100 hover:text-blue-700 focus:z-10 focus:ring-2 focus:ring-blue-700 focus:text-blue-700 dark:border-gray-700 dark:text-white dark:hover:text-white dark:hover:bg-gray-700 dark:focus:ring-blue-500 dark:focus:text-white`}
                onClick={() => setFloor(i)}>
                {i}F
              </button>))}
          </div>
        </div>
        <div key="SetTarget" className="grid grid-cols-[repeat(auto-fit,minmax(theme(spacing.60),1fr))] gap-4 content-stretch py-2">
          {places.map((i) => {
            return (<RosDataButton key={"Robot" + rid + "-" + i} ros={ros} data_key={floor} rid={rid} contents={i} selected={room} setSelected={setRoom} />);
          })}
        </div>
        <div key="GUI" className="grid grid-cols-2 gap-4 content-stretch">
          <div key="MoveVehicle" className="col-span-1">
            <h1 className="flex justify-center">ROS Control Panel</h1>
            <div className="flex justify-center items-center">
              <RosCmd ros={ros} />
            </div>
          </div>
          <div key="ViewMap" className="col-span-1">
            <h1>Camera Data</h1>
            <div className="flex justify-center items-center">
              <CameraData ros={ros} />
            </div>
          </div>
        </div >
      </>
      }
    </main >
  );
}
