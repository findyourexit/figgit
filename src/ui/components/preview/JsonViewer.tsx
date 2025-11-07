/**
 * JsonViewer Component
 *
 * Displays the exported JSON with syntax highlighting and copy functionality.
 */

import { h, FunctionComponent } from 'preact';
import { useCallback } from 'preact/hooks';
import {
  Stack,
  Text,
  Muted,
  Bold,
  Button,
  Banner,
  VerticalSpace,
  IconInfoSmall24,
} from '@create-figma-plugin/ui';
import { usePlugin } from '../../context/PluginContext';
import { stableStringify } from '../../../util/stableStringify';
import styles from './JsonViewer.module.css';

export const JsonViewer: FunctionComponent = () => {
  const { exportState, sendMessage } = usePlugin();

  const handleCopyJson = useCallback(() => {
    if (!exportState.data) return;

    const text = stableStringify(exportState.data, 2);

    // Create a temporary textarea element for reliable clipboard copying
    // This is the recommended approach for iframe environments like Figma plugins
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed'; // Prevent scrolling to bottom
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);

    try {
      // Select the text
      textarea.select();
      textarea.setSelectionRange(0, text.length);

      // Execute copy command
      const successful = document.execCommand('copy');

      if (successful) {
        // Send success notification to Figma (green toast)
        sendMessage({
          type: 'NOTIFY',
          level: 'info',
          message: 'JSON copied to clipboard',
        });
      } else {
        // Fallback: notify user to manually copy
        sendMessage({
          type: 'NOTIFY',
          level: 'error',
          message: 'Copy failed - please select and copy manually',
        });
      }
    } catch (err) {
      // Error case: show red toast with error message
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      sendMessage({
        type: 'NOTIFY',
        level: 'error',
        message: `Copy failed: ${errorMsg}`,
      });
    } finally {
      // Clean up the temporary textarea
      document.body.removeChild(textarea);
    }
  }, [exportState.data, sendMessage]);

  if (!exportState.data) {
    return (
      <Banner icon={<IconInfoSmall24 />}>
        <Text>Export variables to see preview</Text>
      </Banner>
    );
  }

  const jsonText = stableStringify(exportState.data, 2);

  // Extract metadata based on format
  let variablesCount = 0;
  let collectionsCount = 0;

  if ('meta' in exportState.data) {
    // Legacy format
    const meta = exportState.data.meta as { variablesCount?: number; collectionsCount?: number };
    variablesCount = meta.variablesCount || 0;
    collectionsCount = meta.collectionsCount || 0;
  } else if ('$extensions' in exportState.data) {
    // DTCG format
    const figmaExt = exportState.data.$extensions?.['com.figma'] as
      | Record<string, unknown>
      | undefined;
    variablesCount = (figmaExt?.variablesCount as number) || 0;
    collectionsCount = (figmaExt?.collectionsCount as number) || 0;
  }

  return (
    <Stack space="small">
      <Text>
        <Bold>Export Data</Bold>
      </Text>
      <Text>
        <Muted>
          {variablesCount} variables • {collectionsCount} collections
        </Muted>
      </Text>

      <VerticalSpace space="small" />

      <div className={`${styles.jsonPreview} jsonPreview`}>
        <pre>
          <code>{jsonText}</code>
        </pre>
      </div>

      <VerticalSpace space="small" />

      <Button onClick={handleCopyJson} secondary fullWidth>
        Copy to Clipboard
      </Button>
    </Stack>
  );
};
