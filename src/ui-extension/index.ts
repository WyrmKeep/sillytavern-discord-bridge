import './styles.css';
import { mountSettingsPanel } from './settings-panel.js';

const container = document.createElement('div');
container.id = 'discord-bridge-extension';
document.body.append(container);

void mountSettingsPanel(container);
