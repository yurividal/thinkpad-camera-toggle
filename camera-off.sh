#!/bin/bash
# Camera OFF script — called via pkexec (already root, no sudo needed)
pkill -f gst-launch-1.0 || true   # exit 0 even if no process was running
echo "Camera and LED are now OFF."
