/**
 * TabLayout Component
 *
 * Main layout with horizontal tab navigation: Settings, Preview, Export.
 */

import { h, FunctionComponent } from 'preact';
import { useTabNavigation } from '../../hooks';
import { SettingsTab } from '../settings/SettingsTab';
import { PreviewTab } from '../preview/PreviewTab';
import { ExportTab } from '../export/ExportTab';
import styles from './TabLayout.module.css';

export const TabLayout: FunctionComponent = () => {
  const { activeTab, goToSettings, goToPreview, goToExport } = useTabNavigation('export');

  return (
    <div className={styles.container}>
      {/* Horizontal Tab Navigation */}
      <div className={styles.tabNav}>
        <button
          className={`${styles.tabButton} ${activeTab === 'settings' ? styles.active : ''}`}
          onClick={goToSettings}
        >
          Settings
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'preview' ? styles.active : ''}`}
          onClick={goToPreview}
        >
          Preview
        </button>
        <button
          className={`${styles.tabButton} ${activeTab === 'export' ? styles.active : ''}`}
          onClick={goToExport}
        >
          Export
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {activeTab === 'settings' && <SettingsTab />}
        {activeTab === 'preview' && <PreviewTab />}
        {activeTab === 'export' && <ExportTab />}
      </div>
    </div>
  );
};
