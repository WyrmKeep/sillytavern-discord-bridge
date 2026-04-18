import './styles.css';
import { mountSettingsPanelInExtensionsMenu } from './settings-panel.js';

function initialize(): void {
  void mountSettingsPanelInExtensionsMenu();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}
