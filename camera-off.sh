#!/bin/bash
# Camera OFF script — called via pkexec (already root, no sudo needed)
pkill -f gst-launch-1.0
echo "Camera and LED are now OFF."
