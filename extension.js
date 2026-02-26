import St from 'gi://St';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

// Camera Toggle for Quick Settings
const CameraToggle = GObject.registerClass(
    class CameraToggle extends QuickSettings.QuickToggle {
        _init(extensionPath) {
            super._init({
                title: 'Camera',
                iconName: 'camera-web-symbolic',
                toggleMode: true,
            });
            
            this._extensionPath = extensionPath;
            this.cameraOnScript = GLib.build_filenamev([extensionPath, 'camera-on.sh']);
            this.cameraOffScript = GLib.build_filenamev([extensionPath, 'camera-off.sh']);
            
            // Connect toggle signal
            this.connect('clicked', this._onToggled.bind(this));
            
            // Initialize camera state
            this._checkCameraState();
        }
        
        _checkCameraState() {
            // Check if camera pipeline is running
            try {
                const proc = Gio.Subprocess.new(
                    ['bash', '-c', 'pgrep -f "gst-launch.*icamerasrc" >/dev/null 2>&1 && echo on || echo off'],
                    Gio.SubprocessFlags.STDOUT_PIPE
                );
                
                proc.wait_async(null, (source, result) => {
                    try {
                        source.wait_finish(result);
                        const stdout = proc.get_stdout_pipe();
                        const reader = new Gio.DataInputStream({ base_stream: stdout });
                        const [line] = reader.read_line(null);
                        
                        if (line) {
                            const output = new TextDecoder().decode(line).trim();
                            this.set_active(output === 'on');
                        }
                    } catch (e) {
                        log(`Camera Toggle: Error checking state: ${e}`);
                        this.set_active(false);
                    }
                });
            } catch (e) {
                log(`Camera Toggle: Failed to check camera state: ${e}`);
            }
        }
        
        _onToggled() {
            const isActive = this.checked;
            const script = isActive ? this.cameraOnScript : this.cameraOffScript;
            
            log(`Camera Toggle: Toggling camera ${isActive ? 'ON' : 'OFF'}`);
            
            this._executeScript(script);
        }
        
        _executeScript(scriptPath) {
            const command = [
                'pkexec',
                'bash',
                scriptPath
            ];
            
            try {
                const proc = Gio.Subprocess.new(
                    command,
                    Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
                );
                
                proc.wait_async(null, (source, result) => {
                    try {
                        const success = source.wait_finish(result);
                        if (success && source.get_successful()) {
                            log(`Camera Toggle: Script executed successfully`);
                            // Refresh state after script execution
                            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                                this._checkCameraState();
                                return GLib.SOURCE_REMOVE;
                            });
                        } else {
                            logError(new Error('Script failed'), `Failed to run script: ${scriptPath}`);
                        }
                    } catch (e) {
                        logError(e, 'Failed to wait for script');
                    }
                });
            } catch (e) {
                logError(e, 'Failed to execute script');
            }
        }
        
        destroy() {
            super.destroy();
        }
    }
);

// System Indicator for Quick Settings
const CameraSystemIndicator = GObject.registerClass(
    class CameraSystemIndicator extends QuickSettings.SystemIndicator {
        _init(extensionPath) {
            super._init();
            
            this._toggle = new CameraToggle(extensionPath);
            this.quickSettingsItems.push(this._toggle);
        }
        
        destroy() {
            this._toggle?.destroy();
            super.destroy();
        }
    }
);

// Main extension class
export default class CameraToggleExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._indicator = null;
        this._settings = null;
        this._widthChangedId = null;
    }
    
    enable() {
        this._settings = this.getSettings();
        this._indicator = new CameraSystemIndicator(this.path);
        
        // Add to Quick Settings
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        
        // Listen for width changes
        this._widthChangedId = this._settings.connect('changed::widget-width', () => {
            this._recreateIndicator();
        });
    }
    
    _recreateIndicator() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = new CameraSystemIndicator(this.path);
            Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        }
    }
    
    disable() {
        if (this._widthChangedId) {
            this._settings.disconnect(this._widthChangedId);
            this._widthChangedId = null;
        }
        
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        
        this._settings = null;
    }
}
