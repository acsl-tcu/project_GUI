import React, { useEffect, useRef, useState } from 'react';
import ROSLIB from 'roslib';

interface RosCmdProps {
  ros: ROSLIB.Ros | null;
  rid: number;
}
// function throttle<T extends (event: Event, now: number) => void>(
//   callback: T,
//   limit: number
// ): (event: Event) => void {
function throttle<T extends MouseEvent | TouchEvent>(
  callback: (event: T, now: number) => void,
  limit: number
): (event: T) => void {
  //function throttle<T extends (...args: any[]) => void>(callback: T, limit: number): (...args: Parameters<T>) => void {
  let lastTime = 0;
  //(...args: Parameters<T>): void => {
  return (event: T): void => {
    const now = Date.now();
    if (now - lastTime >= limit) {
      lastTime = now;
      callback(event, now);
    }
  };
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
    const moveHandle = (e: MouseEvent | TouchEvent, timestamp: number) => {
      let ex: number;
      let ey: number;
      if (e instanceof MouseEvent) {
        ex = e.clientX;
        ey = e.clientY;
      } else if (e instanceof TouchEvent) {
        ex = e.touches[0].clientX;
        ey = e.touches[0].clientY;
      } else {
        ex = 0.0;
        ey = 0.0;
      }
      let x = ex - padRect.left - handle.offsetWidth / 2;
      let y = ey - padRect.top - handle.offsetHeight / 2;
      const r = (pad.offsetWidth - handle.offsetWidth) / 2;
      const cx = r, cy = r;

      const dist = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
      if (dist > r) {
        x = (x - cx) * r / dist + cx;
        y = (y - cy) * r / dist + cy;
      }

      handle.style.left = `${x}px`;
      handle.style.top = `${y}px`;

      const nx = Math.max(-0.3, Math.min(0.3, ((x - cx) / r)));
      const ny = Math.min(0.5, ((cy - y) / r));
      setTwist(new ROSLIB.Message({
        linear: { x: parseFloat(ny.toFixed(3)), y: 0.0, z: timestamp },
        angular: { x: 0.0, y: 0.0, z: -parseFloat(nx.toFixed(3)) }
      }));
      cmdVel.current.publish(twist);
    };

    const stopHandle = (e: MouseEvent | TouchEvent, timestamp: number) => {
      // document.removeEventListener('mousemove', moveHandle);
      // document.removeEventListener('mouseup', stopHandle);
      handle.style.left = '100px';
      handle.style.top = '100px';
      setTwist(new ROSLIB.Message({
        linear: { x: 0.0, y: 0.0, z: timestamp },
        angular: { x: 0.0, y: 0.0, z: 0.0 }
      }));
      cmdVel.current.publish(twist);

      const msg = new ROSLIB.Message({ layout: { dim: [{ label: "length", size: 2, stride: 2 }], data_offset: 0 }, data: [0, 0] });
      Topic.current.publish(msg);
    };
    // 10Hz = 100ms間隔で実行されるよう制限
    const throttledMoveHandle = throttle((e: MouseEvent | TouchEvent, now: number) => {
      if (
        pad &&
        e.target instanceof Node &&
        pad.contains(e.target)
      ) {
        return moveHandle(e, now);
      } else {
        return stopHandle(e, now);
      }
    }, 100);
    const throttledStopHandle = throttle(stopHandle, 100);



    // handle.addEventListener('mousedown', (e: MouseEvent) => {
    //   e.preventDefault();
    //   document.addEventListener('mousemove', throttledMoveHandle);
    //   document.addEventListener('mouseup', throttledStopHandle);
    // });
    // handle.addEventListener('touchstart', (e: TouchEvent) => {
    //   e.preventDefault();
    //   document.addEventListener('touchmove', throttledMoveHandle);
    //   document.addEventListener('touchend', throttledStopHandle);
    // });

    const handleMouseDown = () => {
      document.addEventListener('mousemove', throttledMoveHandle);
      document.addEventListener('mouseup', throttledStopHandle);
    };

    const handleTouchStart = () => {
      document.addEventListener('touchmove', throttledMoveHandle);
      document.addEventListener('touchend', throttledStopHandle);
    };

    handle.addEventListener('mousedown', handleMouseDown);
    handle.addEventListener('touchstart', handleTouchStart);

    return () => {
      handle.removeEventListener('mousedown', handleMouseDown);
      handle.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('mousemove', throttledMoveHandle);
      document.removeEventListener('mouseup', throttledStopHandle);
      document.removeEventListener('touchmove', throttledMoveHandle);
      document.removeEventListener('touchend', throttledStopHandle);
    };
  }, [ros, twist]);
  //  }, [ros, twist]);

  return (
    <div>
      <div id="pad" ref={padRef} style={{ width: '250px', height: '250px', position: 'relative', background: '#eee' }}>
        <div id="handle" ref={handleRef} style={{ width: '50px', height: '50px', position: 'absolute', background: '#ccc', borderRadius: '50%', cursor: 'pointer', left: '100px', top: '100px' }} />
      </div>
    </div>
  );
};

export default RosCmd;
