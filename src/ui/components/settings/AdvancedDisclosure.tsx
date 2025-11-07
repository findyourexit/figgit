/**
 * AdvancedDisclosure Component
 *
 * Optional advanced settings like commit prefix and dry-run mode.
 * Defaults to "collapsed".
 */

import { h, FunctionComponent } from 'preact';
import { useState } from 'preact/hooks';
import { Disclosure, Stack, Textbox, Text, Muted, Toggle, Divider } from '@create-figma-plugin/ui';
import { usePlugin } from '../../context/PluginContext';

export const AdvancedDisclosure: FunctionComponent = () => {
  const { settings, updateSettings } = usePlugin();
  const [isOpen, setIsOpen] = useState(false);

  if (!settings) return null;

  return (
    <Disclosure onClick={() => setIsOpen(!isOpen)} open={isOpen} title="Advanced Options">
      <Stack space="small">
        <Textbox
          value={settings.commitPrefix || ''}
          onInput={(e) => updateSettings({ commitPrefix: e.currentTarget.value })}
          placeholder="feat:"
        >
          <Text>
            Commit Message Prefix <Muted>(Optional)</Muted>
          </Text>
        </Textbox>

        <Divider />

        <Toggle
          value={settings.dryRun || false}
          onValueChange={(value) => updateSettings({ dryRun: value })}
        >
          <Text>Dry Run Mode</Text>
          <Muted>Validate without committing</Muted>
        </Toggle>
      </Stack>
    </Disclosure>
  );
};
