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
        _init(extensionPath, settings, onStateChanged) {
            super._init({
                title: 'Camera',
                iconName: 'camera-web-symbolic',
                toggleMode: true,
            });
            
            this._extensionPath = extensionPath;
            this._settings = settings;
            this._onStateChangedCb = onStateChanged;
            this.cameraOnScript = GLib.build_filenamev([extensionPath, 'camera-on.sh']);
            this.cameraOffScript = GLib.build_filenamev([extensionPath, 'camera-off.sh']);
            
            // Connect toggle signal
            this.connect('clicked', this._onToggled.bind(this));
            
            // Initialize camera state
            this._checkCameraState();
        }
        
        _updateState(isOn) {
            this.checked = isOn;
            this.subtitle = isOn ? 'Active' : 'Inactive';
            if (this._onStateChangedCb)
                this._onStateChangedCb(isOn);
        }
        
        _showOSD(isOn) {
            if (!this._settings.get_boolean('show-osd-notification'))
                return;
            const iconName = isOn ? 'camera-web-symbolic' : 'camera-disabled-symbolic';
            const icon = new Gio.ThemedIcon({ name: iconName });
            Main.osdWindowManager.show(icon, isOn ? 'Camera On' : 'Camera Off', -1);
        }
        
        _checkCameraState() {
            // Check if camera pipeline is running by using pgrep directly.
            // Avoids the self-match bug that occurs when embedding the pattern
            // inside a 'bash -c' string (bash's own cmdline contains the pattern).
            try {
                const proc = Gio.Subprocess.new(
                    ['pgrep', '-f', 'gst-launch-1.0 icamerasrc'],
                    Gio.SubprocessFlags.NONE
                );
                
                proc.wait_async(null, (source, result) => {
                    try {
                        source.wait_finish(result);
                        // pgrep exits 0 when a match is found, 1 when not
                        const isOn = source.get_exit_status() === 0;
                        this._updateState(isOn);
                    } catch (e) {
                        log(`Camera Toggle: Error checking state: ${e}`);
                        this._updateState(false);
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
            
            this._showOSD(isActive);
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
        _init(extensionPath, settings) {
            super._init();
            
            // Panel icon — visible when camera is active
            this._panelIcon = this._addIndicator();
            this._panelIcon.iconName = 'camera-web-symbolic';
            this._panelIcon.visible = false;
            
            this._toggle = new CameraToggle(
                extensionPath,
                settings,
                this._onCameraStateChanged.bind(this)
            );
            this.quickSettingsItems.push(this._toggle);
        }
        
        _onCameraStateChanged(isOn) {
            this._panelIcon.visible = isOn;
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
        this._indicator = new CameraSystemIndicator(this.path, this._settings);
        
        // Add to Quick Settings
        Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        this._applyWidgetWidth();
        
        // Listen for width changes
        this._widthChangedId = this._settings.connect('changed::widget-width', () => {
            this._recreateIndicator();
        });
    }
    
    _applyWidgetWidth() {
        if (this._settings.get_int('widget-width') !== 2)
            return;
        try {
            const grid = Main.panel.statusArea.quickSettings._grid;
            const toggle = this._indicator._toggle;
            grid.layout_manager.child_set_property(grid, toggle, 'column-span', 2);
        } catch (e) {
            log(`Camera Toggle: Could not apply 2-column width: ${e}`);
        }
    }
    
    _recreateIndicator() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = new CameraSystemIndicator(this.path, this._settings);
            Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
            this._applyWidgetWidth();
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
