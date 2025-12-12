/**
 * RepositoryDisclosure Component
 *
 * Collapsible section for GitHub repository configuration.
 * Auto-expands if settings are invalid.
 */

import { h, FunctionComponent } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { Disclosure, Stack, Textbox, Text, Button } from '@create-figma-plugin/ui';
import { usePlugin } from '../../context/PluginContext';

export const RepositoryDisclosure: FunctionComponent = () => {
  const { settings, updateSettings, sendMessage, notify } = usePlugin();

  // Auto-expand if settings are incomplete
  const hasValidSettings = Boolean(settings?.owner && settings?.repo && settings?.branch);

  const [open, setOpen] = useState(!hasValidSettings);

  const handleSaveSettings = useCallback(() => {
    if (!settings) return;

    // Basic validation
    if (!settings.owner || !settings.repo || !settings.branch) {
      notify('error', 'Please fill in all required fields');
      return;
    }

    sendMessage({ type: 'SAVE_SETTINGS', payload: settings });
    notify('info', 'Settings saved');
    setOpen(false);
  }, [settings, sendMessage, notify]);

  if (!settings) return null;

  return (
    <Disclosure onClick={() => setOpen(!open)} open={open} title="GitHub Repository">
      <Stack space="small">
        <Textbox
          placeholder="octocat"
          value={settings.owner}
          onInput={(e) => updateSettings({ owner: e.currentTarget.value })}
        >
          <Text>Owner</Text>
        </Textbox>

        <Textbox
          placeholder="my-design-tokens"
          value={settings.repo}
          onInput={(e) => updateSettings({ repo: e.currentTarget.value })}
        >
          <Text>Repository Name</Text>
        </Textbox>

        <Textbox
          value={settings.branch}
          onInput={(e) => updateSettings({ branch: e.currentTarget.value })}
          placeholder="design-tokens"
        >
          <Text>Target Branch</Text>
        </Textbox>

        <Textbox
          value={settings.defaultBranch || ''}
          onInput={(e) => updateSettings({ defaultBranch: e.currentTarget.value })}
          placeholder="main"
        >
          <Text>Default Branch (Optional)</Text>
        </Textbox>

        <Textbox
          placeholder="tokens"
          value={settings.folder || ''}
          onInput={(e) => updateSettings({ folder: e.currentTarget.value })}
        >
          <Text>Folder Path (Optional)</Text>
        </Textbox>

        <Textbox
          placeholder="variables.json"
          value={settings.filename || 'variables.json'}
          onInput={(e) => updateSettings({ filename: e.currentTarget.value })}
        >
          <Text>Filename</Text>
        </Textbox>

        <Button onClick={handleSaveSettings} fullWidth>
          Save Repository Settings
        </Button>
      </Stack>
    </Disclosure>
  );
};
