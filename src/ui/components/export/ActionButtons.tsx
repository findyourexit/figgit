/**
 * ActionButtons Component
 *
 * Primary export and commit action buttons.
 */

import { h, Fragment, FunctionComponent } from 'preact';
import { useCallback } from 'preact/hooks';
import {
  Stack,
  Button,
  Banner,
  Text,
  LoadingIndicator,
  IconInfoSmall24,
} from '@create-figma-plugin/ui';
import { usePlugin } from '../../context/PluginContext';

export const ActionButtons: FunctionComponent = () => {
  const { exportState, startExport, commitState, startCommit, settings, tokenPresent, notify } =
    usePlugin();

  const handleExport = useCallback(() => {
    startExport();
  }, [startExport]);

  const handleCommit = useCallback(() => {
    if (!exportState.data || !settings) {
      notify('error', 'Please export variables first');
      return;
    }

    if (!tokenPresent) {
      notify('error', 'Please save a GitHub token first');
      return;
    }

    startCommit(exportState.data, settings.dryRun || false, settings.commitPrefix || '');
  }, [exportState.data, settings, tokenPresent, startCommit, notify]);

  return (
    <Stack space="medium">
      <Button
        onClick={handleExport}
        disabled={exportState.loading}
        loading={exportState.loading}
        fullWidth
        secondary
      >
        Export Variables
      </Button>

      <Button
        onClick={handleCommit}
        disabled={!exportState.data || commitState.inProgress || !tokenPresent}
        loading={commitState.inProgress}
        fullWidth
      >
        {settings?.dryRun ? 'Dry Run' : 'Commit to GitHub'}
      </Button>

      {commitState.inProgress && (
        <LoadingIndicator>
          {settings?.dryRun ? 'Validating...' : 'Committing to GitHub...'}
        </LoadingIndicator>
      )}

      {commitState.success && !commitState.skipped && (
        <Banner variant="success" icon={<IconInfoSmall24 />}>
          <Text>
            Committed successfully!
            {commitState.url && (
              <>
                {' '}
                <a href={commitState.url} target="_blank" rel="noopener noreferrer">
                  View commit →
                </a>
              </>
            )}
          </Text>
        </Banner>
      )}

      {commitState.success && commitState.skipped && (
        <Banner icon={<IconInfoSmall24 />}>
          <Text>No changes detected (commit skipped)</Text>
        </Banner>
      )}

      {commitState.error && (
        <Banner variant="warning" icon={<IconInfoSmall24 />}>
          <Text>{commitState.error}</Text>
        </Banner>
      )}

      {exportState.error && (
        <Banner variant="warning" icon={<IconInfoSmall24 />}>
          <Text>{exportState.error}</Text>
        </Banner>
      )}
    </Stack>
  );
};
