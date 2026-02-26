import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class CameraTogglePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        
        // Create main page
        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic'
        });
        
        // Appearance settings group
        const appearanceGroup = new Adw.PreferencesGroup({
            title: 'Appearance Settings',
            description: 'Configure how Camera Toggle appears in Quick Settings'
        });
        
        // Widget width setting
        appearanceGroup.add(this._createWidthRow(settings));
        
        page.add(appearanceGroup);
        
        // Behavior settings group
        const behaviorGroup = new Adw.PreferencesGroup({
            title: 'Behavior',
            description: 'Configure how Camera Toggle behaves when activated'
        });
        
        behaviorGroup.add(this._createOSDRow(settings));
        
        page.add(behaviorGroup);
        window.add(page);
    }
    
    _createWidthRow(settings) {
        const widthRow = new Adw.ActionRow({
            title: 'Widget Width',
            subtitle: 'Choose how wide the widget should be in Quick Settings'
        });
        
        const widthDropdown = new Gtk.DropDown({
            model: Gtk.StringList.new(['1 column (standard)', '2 columns (wide)']),
            valign: Gtk.Align.CENTER
        });
        
        // Set current value (convert 1,2 to 0,1 for dropdown)
        const currentWidth = settings.get_int('widget-width');
        widthDropdown.selected = currentWidth - 1;
        
        // Connect to settings
        widthDropdown.connect('notify::selected', () => {
            const selectedWidth = widthDropdown.selected + 1; // Convert 0,1 to 1,2
            settings.set_int('widget-width', selectedWidth);
        });
        
        widthRow.add_suffix(widthDropdown);
        return widthRow;
    }
    
    _createOSDRow(settings) {
        const osdRow = new Adw.SwitchRow({
            title: 'Show on-screen notification',
            subtitle: 'Display a brief overlay when the camera is toggled on or off'
        });
        
        settings.bind(
            'show-osd-notification',
            osdRow,
            'active',
            Gio.SettingsBindFlags.DEFAULT
        );
        
        return osdRow;
    }
}
