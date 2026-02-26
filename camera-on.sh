#!/bin/bash
# Camera ON script — called via pkexec (already root, no sudo needed)

echo "--- Camera Wake-Up Sequence Initiated ---"

# 1. Kill any existing camera processes
pkill -9 gst-launch-1.0 2>/dev/null

# 2. Reset the Intel Driver stack
modprobe -r intel_ipu6_isys intel_ipu6 2>/dev/null
modprobe intel_ipu6
modprobe intel_ipu6_isys

# 3. Ensure the Virtual Bridge is loaded
modprobe v4l2loopback video_nr=0 card_label="Intel MIPI Camera" exclusive_caps=1 2>/dev/null

# 4. Wait for the hardware nodes to appear in /dev
echo "Waiting for hardware nodes to settle..."
sleep 2

# 5. Launch the GStreamer pipeline in the BACKGROUND so pkexec returns
echo "Hardware ready. Starting Bridge..."
nohup gst-launch-1.0 icamerasrc ! \
  video/x-raw,format=NV12,width=1280,height=720 ! \
  videoconvert ! \
  video/x-raw,format=YUY2,width=1280,height=720,framerate=30/1 ! \
  v4l2sink device=/dev/video0 \
  > /tmp/camera-pipeline.log 2>&1 &

echo "Camera pipeline started (PID: $!)"
