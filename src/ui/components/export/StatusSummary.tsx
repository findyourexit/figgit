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
import { ExportRoot } from '../../../shared/types';
import { DtcgRoot, DtcgFigmaExtensions } from '../../../shared/dtcg-types';

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

  // Extract metadata from either legacy or DTCG format
  let variablesCount = 0;
  let collectionsCount = 0;

  if ('meta' in exportState.data) {
    // Legacy format (ExportRoot)
    const data = exportState.data as ExportRoot;
    variablesCount = data.meta.variablesCount;
    collectionsCount = data.meta.collectionsCount;
  } else if ('$extensions' in exportState.data && exportState.data.$extensions?.['com.figma']) {
    // DTCG format (DtcgRoot)
    const data = exportState.data as DtcgRoot;
    const figmaExt = data.$extensions?.['com.figma'] as DtcgFigmaExtensions | undefined;
    variablesCount = figmaExt?.variablesCount ?? 0;
    collectionsCount = figmaExt?.collectionsCount ?? 0;
  }

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
          <Text>Target:</Text>
          <Text>
            <Muted>
              {settings.owner}/{settings.repo}
            </Muted>
          </Text>
        </Inline>

        <Inline space="small">
          <Text>Branch:</Text>
          <Text>
            <Muted>{settings.branch}</Muted>
          </Text>
        </Inline>
      </Stack>
    </Stack>
  );
};
