import React, { useEffect, useState } from 'react';
import ROSLIB from 'roslib';
import Card from 'react-bootstrap/Card';

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

    return () => {
      image.unsubscribe();
    };
  }, [ros]);

  return (
    <>
      <Card className="mb-4" style={{ width: '48rem' }}>
        <Card.Body>
          <Card.Title>Camera Image</Card.Title>
          <Card.Subtitle className="mb-2 text-muted">Subscribe image_raw</Card.Subtitle>
          <Card.Text>
            <img src={imgData} alt="Camera Data" />
          </Card.Text>
        </Card.Body>
      </Card>
    </>
  );
}

export default CameraData;
