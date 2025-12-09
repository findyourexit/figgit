import { h, FunctionComponent } from 'preact';
import { useState } from 'preact/hooks';
import { Disclosure, Stack, Text, Muted, Button, Inline, Bold } from '@create-figma-plugin/ui';
import { usePlugin } from '../../context/PluginContext';

export const ExportOptionsDisclosure: FunctionComponent = () => {
  const { settings, updateSettings, sendMessage } = usePlugin();
  const [isOpen, setIsOpen] = useState(false);

  if (!settings) return null;

  const format = settings.exportFormat || 'dtcg';
  const exportType = settings.exportType || 'singleFile';

  const handleFormatChange = (nextFormat: 'dtcg' | 'figma-native') => {
    if (!settings || nextFormat === format) return;
    const nextExportType = nextFormat === 'dtcg' ? 'singleFile' : exportType;
    const nextSettings = {
      ...settings,
      exportFormat: nextFormat,
      exportType: nextExportType,
    };
    updateSettings(nextSettings);
    sendMessage({ type: 'SAVE_SETTINGS', payload: nextSettings });
  };

  const handleExportTypeChange = (nextType: 'singleFile' | 'perCollection') => {
    if (!settings || nextType === exportType) return;
    if (perCollectionDisabled && nextType === 'perCollection') return;
    const nextSettings = { ...settings, exportType: nextType };
    updateSettings(nextSettings);
    sendMessage({ type: 'SAVE_SETTINGS', payload: nextSettings });
  };

  const perCollectionDisabled = format === 'dtcg';

  return (
    <Disclosure onClick={() => setIsOpen(!isOpen)} open={isOpen} title="Export Options">
      <Stack space="small">
        <Stack space="extraSmall">
          <Text>
            <Bold>Format</Bold>
          </Text>
          <Muted>Select the structure for exported files.</Muted>
          <Inline space="small">
            <Button
              secondary={format !== 'dtcg'}
              onClick={() => handleFormatChange('dtcg')}
              fullWidth
            >
              DTCG (Design Tokens)
            </Button>
            <Button
              secondary={format !== 'figma-native'}
              onClick={() => handleFormatChange('figma-native')}
              fullWidth
            >
              Figma-native JSON
            </Button>
          </Inline>
        </Stack>

        <Stack space="extraSmall">
          <Text>
            <Bold>Document Output</Bold>
          </Text>
          <Muted>Choose how many JSON files to generate.</Muted>
          <Inline space="small">
            <Button
              secondary={exportType !== 'singleFile'}
              onClick={() => handleExportTypeChange('singleFile')}
              fullWidth
            >
              Single file
            </Button>
            <Button
              secondary={exportType !== 'perCollection'}
              onClick={() => handleExportTypeChange('perCollection')}
              disabled={perCollectionDisabled}
              fullWidth
            >
              Per collection
            </Button>
          </Inline>
          {perCollectionDisabled && (
            <Text>
              <Muted>DTCG format always exports as a single file.</Muted>
            </Text>
          )}
        </Stack>
      </Stack>
    </Disclosure>
  );
};
