/**
 * StatusSummary Component
 *
 * Displays current export status and metadata.
 */

import { h, FunctionComponent } from 'preact';
import {
  Stack,
  Text,
  Bold,
  Muted,
  Inline,
  Divider,
  Banner,
  IconInfoSmall24,
  IconWarningSmall24,
  IconApprovedCheckmark24,
} from '@create-figma-plugin/ui';
import { usePlugin } from '../../context/PluginContext';

export const StatusSummary: FunctionComponent = () => {
  const { exportState, settings } = usePlugin();

  if (exportState.loading) {
    return (
      <Banner icon={<IconInfoSmall24 />}>
        <Text>Exporting variables...</Text>
      </Banner>
    );
  }

  if (exportState.error) {
    return (
      <Banner variant="warning" icon={<IconWarningSmall24 />}>
        <Text>{exportState.error}</Text>
      </Banner>
    );
  }

  if (!exportState.data) {
    return (
      <Banner icon={<IconInfoSmall24 />}>
        <Text>Export variables to begin</Text>
      </Banner>
    );
  }

  if (!settings) {
    return (
      <Banner variant="success" icon={<IconApprovedCheckmark24 />}>
        <Text>Variables successfully exported</Text>
      </Banner>
    );
  }

  const bundle = exportState.data;
  const variablesCount = bundle?.summary.variablesCount ?? 0;
  const collectionsCount = bundle?.summary.collectionsCount ?? 0;
  const formatLabel = bundle?.summary.format === 'figma-native' ? 'Figma-native' : 'DTCG';
  const exportTypeLabel =
    bundle?.summary.exportType === 'perCollection' ? 'Per collection' : 'Single file';

  return (
    <Stack space="small">
      <Banner variant="success" icon={<IconApprovedCheckmark24 />}>
        <Text>Variables successfully exported</Text>
      </Banner>

      <Divider />

      <Stack space="extraSmall">
        <Inline space="small">
          <Text>Variables:</Text>
          <Text>
            <Bold>{variablesCount}</Bold>
          </Text>
        </Inline>

        <Inline space="small">
          <Text>Collections:</Text>
          <Text>
            <Bold>{collectionsCount}</Bold>
          </Text>
        </Inline>

        <Inline space="small">
          <Text>Format:</Text>
          <Text>
            <Muted>
              {formatLabel} · {exportTypeLabel}
            </Muted>
          </Text>
        </Inline>

        <Inline space="small">
          <Text>Target:</Text>
          <Text>
            <Muted>
              {settings.owner}/{settings.repo}
            </Muted>
          </Text>
        </Inline>

        <Inline space="small">
          <Text>Target Branch:</Text>
          <Text>
            <Muted>{settings.branch}</Muted>
          </Text>
        </Inline>

        {settings.defaultBranch && settings.defaultBranch !== settings.branch ? (
          <Inline space="small">
            <Text>Default Branch:</Text>
            <Text>
              <Muted>{settings.defaultBranch}</Muted>
            </Text>
          </Inline>
        ) : null}
      </Stack>
    </Stack>
  );
};
