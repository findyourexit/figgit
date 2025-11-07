/**
 * New UI Entry Point
 *
 * Renders the redesigned FigGit UI with @create-figma-plugin/ui components.
 */

import { h, render } from 'preact';
import { PluginProvider } from './context/PluginContext';
import { TabLayout } from './components/layout/TabLayout';

// Import Figma plugin UI base styles
// This provides all necessary styling for @create-figma-plugin/ui components
import '@create-figma-plugin/ui/css/base.css';

// Import Banner alignment fix
import './banner-fix.css';

// Render the app
const container = document.getElementById('react-page');
if (container) {
  render(
    <PluginProvider>
      <TabLayout />
    </PluginProvider>,
    container
  );
}
