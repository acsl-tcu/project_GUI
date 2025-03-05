import React, { useEffect, useRef, useState } from 'react';
import ROSLIB from 'roslib';

interface RosCmdProps {
  ros: ROSLIB.Ros | null;
}

const RosCmd: React.FC<RosCmdProps> = ({ ros, rid }) => {
  const padRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const cmdVel = useRef(new ROSLIB.Topic({
    ros: ros,
    name: '/rover_twist',
    messageType: 'geometry_msgs/Twist'
  }));
  const Topic = useRef(new ROSLIB.Topic({
    ros: ros,
    name: '/Robot' + rid + '/console2robot',
    messageType: 'std_msgs/msg/Int8MultiArray'
  }));
  const [twist, setTwist] = useState<ROSLIB.Message>(new ROSLIB.Message({
    linear: { x: 0, y: 0, z: 0 },
    angular: { x: 0, y: 0, z: 0 }
  }));

  useEffect(() => {

    const pad = padRef.current;
    const handle = handleRef.current;

    if (!pad || !handle) {
      return;
    }

    const padRect = pad.getBoundingClientRect();
    // const rect = pad.getBoundingClientRect();
    // console.log('要素の幅:', rect.width);
    // console.log('要素の高さ:', rect.height);
    // console.log('要素の上端からの距離:', rect.top); // y 
    // console.log('要素の左端からの距離:', rect.left); // x
    // console.log('要素の下端からの距離:', rect.bottom);
    // console.log('要素の右端からの距離:', rect.right);
    const moveHandle = (e: MouseEvent) => {
      let x = e.clientX - padRect.left - handle.offsetWidth / 2;
      let y = e.clientY - padRect.top - handle.offsetHeight / 2;
      const r = (pad.offsetWidth - handle.offsetWidth) / 2;
      const cx = r, cy = r;

      const dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
      if (dist > r) {
        x = (x - cx) * r / dist + cx;
        y = (y - cy) * r / dist + cy;
      }

      handle.style.left = `${x}px`;
      handle.style.top = `${y}px`;

      const nx = ((x - cx) / r);
      const ny = ((cy - y) / r);
      setTwist(new ROSLIB.Message({
        linear: { x: parseFloat(ny.toFixed(3)), y: 0.0, z: 0.0 },
        angular: { x: 0.0, y: 0.0, z: -parseFloat(nx.toFixed(3)) }
      }));
      cmdVel.current.publish(twist);
    };

    const stopHandle = () => {
      document.removeEventListener('mousemove', moveHandle);
      document.removeEventListener('mouseup', stopHandle);
      handle.style.left = '100px';
      handle.style.top = '100px';
      setTwist(new ROSLIB.Message({
        linear: { x: 0.0, y: 0.0, z: 0.0 },
        angular: { x: 0.0, y: 0.0, z: 0.0 }
      }));
      cmdVel.current.publish(twist);

      const msg = new ROSLIB.Message({ layout: { dim: [{ label: "length", size: 2, stride: 2 }], data_offset: 0 }, data: [0, 0] });
      Topic.current.publish(msg);
    };

    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      document.addEventListener('mousemove', moveHandle);
      document.addEventListener('mouseup', stopHandle);
    });

    return () => {
      handle.removeEventListener('mousedown', (e: MouseEvent) => {
        document.removeEventListener('mousemove', moveHandle);
        document.removeEventListener('mouseup', stopHandle);
      });
    };
  }, [ros, twist]);

  return (
    <div>
      <div id="pad" ref={padRef} style={{ width: '250px', height: '250px', position: 'relative', background: '#eee' }}>
        <div id="handle" ref={handleRef} style={{ width: '50px', height: '50px', position: 'absolute', background: '#ccc', borderRadius: '50%', cursor: 'pointer', left: '100px', top: '100px' }} />
      </div>
    </div>
  );
};

export default RosCmd;
