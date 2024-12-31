import React, { useEffect, useState } from 'react';
import ROSLIB from 'roslib';

interface CameraDataProps {
  ros: ROSLIB.Ros | null;
}

const CameraData: React.FC<CameraDataProps> = ({ ros }) => {
  const [imgData, setImgData] = useState<string>('');

  useEffect(() => {
    if (!ros) {
      return;
    }

    const image = new ROSLIB.Topic({
      ros: ros,
      name: '/color/image_raw/compressed',
      messageType: 'sensor_msgs/CompressedImage'
    });

    image.subscribe((message: ROSLIB.Message) => {
      console.log('Received image');
      const data = "data:image/png;base64," + message.data;
      setImgData(data);
    });

    // return () => {
    //   image.unsubscribe();
    // };
  }, [ros]);

  return (
    <>
      <div className="mb-4 w-[48rem] bg-white rounded-lg shadow-lg">
        <div className="p-4">
          <h2 className="text-xl font-bold">Camera Image</h2>
          <h3 className="mb-2 text-gray-600">Subscribe image_raw</h3>
          <div>
            <img src={imgData || null} alt="Camera Data" />
          </div>
        </div>
      </div>
    </>
  );
}

export default CameraData;
