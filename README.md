# ThinkPad Camera Toggle — GNOME Extension

A GNOME Shell Quick Settings extension for toggling an Intel MIPI camera on ThinkPad laptops (and similar devices) that use the **Intel IPU6 / iVSC driver stack**. One click turns the camera pipeline on or off — including the physical LED.

---

## Background & Why This Exists

Modern ThinkPad models (e.g. X1 Carbon Gen 10+) ship with an **Intel MIPI camera** that is **not** a standard UVC webcam. Instead of appearing as a plug-and-play `/dev/video*` device, it relies on:

- **Intel IPU6 kernel modules** (`intel_ipu6`, `intel_ipu6_isys`)
- **`icamerasrc`** — a GStreamer source element from Intel's proprietary camera HAL
- **`v4l2loopback`** — a virtual V4L2 bridge that exposes the camera to regular apps

Lenovo ships a pre-built, kernel-signed driver that only works with **specific signed Ubuntu versions**. When you adapt or recompile the driver to work with other Ubuntu/kernel versions, the camera becomes functional — but with an important quirk:

> **The camera LED stays on as long as the `icamerasrc` GStreamer pipeline is running.** There is no simple `modprobe`/`rmmod` toggle once the pipeline is live.

Crucially, apps cannot start or even see the camera on their own — **no `/dev/video*` device exists until `camera-on.sh` is run manually.** Once the pipeline is started, the LED stays on until `camera-off.sh` is explicitly called. Without a convenient toggle, the user would have to drop into a terminal and kill the process by hand every time.

This extension solves that by:

1. **Camera ON**: reloading the Intel IPU6 modules, setting up the `v4l2loopback` virtual device, and launching a background GStreamer bridge (`icamerasrc → v4l2sink`) so any app can use `/dev/video0`
2. **Camera OFF**: killing `gst-launch-1.0`, which immediately stops the pipeline and **turns off the LED**

---

## Features

- One-click camera toggle in GNOME Quick Settings
- Kills the GStreamer pipeline on OFF — no more stuck LED
- Automatic state detection (checks for a running `gst-launch` / `icamerasrc` pipeline)
- Uses `pkexec` for secure privilege escalation (no permanent sudo or setuid)
- Minimal, native GNOME UI — no tray icons, no background daemons

---

## Prerequisites

- GNOME Shell 45–49
- Intel IPU6 drivers compiled and installed (`intel_ipu6`, `intel_ipu6_isys`)
- `icamerasrc` GStreamer plugin (from Intel's `ipu6-camera-hal`)
- `v4l2loopback` kernel module
- `gst-launch-1.0` (package `gstreamer1.0-tools`)
- `pkexec` (from PolicyKit)

---

## Installation

```bash
# Clone the repo
git clone https://github.com/yurividal/thinkpad-camera-toggle
cd thinkpad-camera-toggle

# Install via gnome-extensions CLI
zip -r /tmp/camera-toggle.zip extension.js metadata.json prefs.js \
    camera-on.sh camera-off.sh schemas/
gnome-extensions install --force /tmp/camera-toggle.zip
```

**Log out and log back in** — required on Wayland sessions to load a new extension UUID.

Then enable it:

```bash
gnome-extensions enable camera-toggle@yurividal.dev
```

Or use the **GNOME Extensions** app.

---

## How the Scripts Work

### `camera-on.sh`

Runs as root via `pkexec`. Steps:

1. Kills any stale `gst-launch-1.0` process
2. Reloads `intel_ipu6` and `intel_ipu6_isys` kernel modules to get a clean hardware state
3. Loads `v4l2loopback` at `/dev/video0` labelled "Intel MIPI Camera"
4. Launches a background GStreamer pipeline:

   ```
   icamerasrc
     → video/x-raw,format=NV12,width=1280,height=720
     → videoconvert
     → video/x-raw,format=YUY2,width=1280,height=720,framerate=30/1
     → v4l2sink device=/dev/video0
   ```

   This bridges the hardware MIPI camera to a standard V4L2 device that Zoom, Teams, OBS, and other apps can consume normally.

### `camera-off.sh`

Runs as root via `pkexec`. Steps:

1. Kills `gst-launch-1.0` — this immediately stops the pipeline and turns off the camera LED.

The LED state is tied to the GStreamer pipeline being active, **not** to kernel module load state. Simply unloading modules is not sufficient once the pipeline is running; killing the pipeline process is all that's needed.

---

## Usage

1. Click the camera icon in Quick Settings (top-right system panel)
2. Toggle on or off
3. Grant permission when prompted by PolicyKit
4. The camera starts (and `/dev/video0` becomes available to apps), or the pipeline shuts down and the LED goes dark

---

## License

GPL-2.0-or-later
