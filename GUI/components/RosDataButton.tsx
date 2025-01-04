import React, { useRef } from 'react';
import ROSLIB from 'roslib';
import bld_data from '../../floor_map.json';
interface RosDataButtonProps {
  ros: ROSLIB.Ros | null;
  data_key: number;
  rid: number;
  contents: string;
  selected: string;
  setSelected: React.Dispatch<React.SetStateAction<string>>;
}

const RosDataButton: React.FC<RosDataButtonProps> = ({ ros, data_key, rid, contents, selected, setSelected }) => {
  const Topic = useRef(new ROSLIB.Topic({
    ros: ros,
    name: '/Robot' + rid + '/console2robot',
    messageType: 'std_msgs/Int8MultiArray'
  }));

  const handleClick = () => {
    const tid = bld_data[String(data_key)][contents];
    const msg = new ROSLIB.Message({ layout: { dim: [{ label: "length", size: 2, stride: 2 }], data_offset: 0 }, data: [parseInt(data_key, 10), tid[0]] });
    console.log("click!! : " + JSON.stringify(msg, null, 2) + "======")
    Topic.current.publish(msg);
    setSelected(contents);
  };

  return (
    <div className="flex justify-center items-center col-span-1" key={"Button" + data_key + contents} >
      <button className={`py-2 ${contents === selected ? "text-white bg-green-500" : "text-green-500"} w-full text-destructive-foreground border border-green-500 font-semibold rounded hover:bg-green-100 active:border-b-0`} onClick={handleClick}>{contents}</button>
    </div >
  );
}

export default RosDataButton;