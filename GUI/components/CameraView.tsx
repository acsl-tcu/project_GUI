"use client";
// CompressedImage トピックの簡易表示 (旧 CameraData.tsx の置き換え)。

import React, { useState } from "react";
import ROSLIB from "roslib";
import { useTopic } from "@/lib/useRos";

interface CompressedImageMsg {
  format: string;
  data: string; // rosbridge は uint8[] を base64 文字列で送る
}

interface CameraViewProps {
  ros: ROSLIB.Ros | null;
  topic?: string;
}

const CameraView: React.FC<CameraViewProps> = ({
  ros,
  topic = "/color/image_raw/compressed",
}) => {
  const [src, setSrc] = useState<string>("");

  useTopic<CompressedImageMsg>(
    ros,
    topic,
    "sensor_msgs/CompressedImage",
    (msg) => setSrc(`data:image/jpeg;base64,${msg.data}`),
    { throttleRate: 200 },
  );

  return (
    <div className="rounded-xl border border-slate-700/70 bg-slate-900/70 p-2 shadow-md shadow-black/20">
      <div className="text-xs text-slate-400 mb-1">camera: {topic}</div>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="camera" className="w-full rounded" />
      ) : (
        <div className="text-slate-500 text-sm py-8 text-center">
          画像未受信
        </div>
      )}
    </div>
  );
};

export default CameraView;
