/**
 * JsonViewer Component
 *
 * Displays the exported JSON with syntax highlighting and copy functionality.
 */

import { h, FunctionComponent } from 'preact';
import { useCallback } from 'preact/hooks';
import { Stack, Text, Muted, Bold, Button, Banner, IconInfoSmall24 } from '@create-figma-plugin/ui';
import { usePlugin } from '../../context/PluginContext';
import { stableStringify } from '../../../util/stableStringify';
import styles from './JsonViewer.module.css';

export const JsonViewer: FunctionComponent = () => {
  const { exportState, sendMessage } = usePlugin();

  const handleCopyJson = useCallback(
    (text: string, fileLabel: string) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      textarea.style.pointerEvents = 'none';
      document.body.appendChild(textarea);

      try {
        textarea.select();
        textarea.setSelectionRange(0, text.length);

        const successful = document.execCommand('copy');
        if (successful) {
          sendMessage({
            type: 'NOTIFY',
            level: 'info',
            message: `${fileLabel} copied to clipboard`,
          });
        } else {
          sendMessage({
            type: 'NOTIFY',
            level: 'error',
            message: 'Copy failed - please select and copy manually',
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        sendMessage({
          type: 'NOTIFY',
          level: 'error',
          message: `Copy failed: ${errorMsg}`,
        });
      } finally {
        document.body.removeChild(textarea);
      }
    },
    [sendMessage]
  );

  if (!exportState.data) {
    return (
      <Banner icon={<IconInfoSmall24 />}>
        <Text>Export variables to see preview</Text>
      </Banner>
    );
  }
  const bundle = exportState.data;
  const summary = bundle.summary;
  const documents = bundle.documents;
  const variablesCount = summary.variablesCount;
  const collectionsCount = summary.collectionsCount;
  const formatLabel = summary.format === 'figma-native' ? 'Figma-native' : 'DTCG';
  const exportTypeLabel = summary.exportType === 'perCollection' ? 'Per collection' : 'Single file';

  return (
    <Stack space="large">
      <Stack space="extraSmall">
        <Text>
          <Bold>Export Summary</Bold>
        </Text>
        <Text>
          <Muted>
            {variablesCount} variables • {collectionsCount} collections
          </Muted>
        </Text>
        <Text>
          <Muted>
            {formatLabel} · {exportTypeLabel}
          </Muted>
        </Text>
      </Stack>

      {documents.map((doc) => {
        const jsonText = stableStringify(doc.data, 2);
        return (
          <Stack key={doc.id} space="small">
            <Stack space="extraSmall">
              <Text>
                <Bold>{doc.label}</Bold>
              </Text>
              <Text>
                <Muted>{doc.relativePath}</Muted>
              </Text>
            </Stack>
            <div className={`${styles.jsonPreview} jsonPreview`}>
              <pre>
                <code>{jsonText}</code>
              </pre>
            </div>
            <Button onClick={() => handleCopyJson(jsonText, doc.fileName)} secondary fullWidth>
              Copy {doc.fileName}
            </Button>
          </Stack>
        );
      })}
    </Stack>
  );
};
