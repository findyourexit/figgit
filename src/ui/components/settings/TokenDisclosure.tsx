/**
 * TokenDisclosure Component
 *
 * Collapsible section for GitHub token management.
 */

import { h, FunctionComponent } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import {
  Disclosure,
  Stack,
  Textbox,
  Text,
  Muted,
  Button,
  Banner,
  Inline,
  VerticalSpace,
  IconApprovedCheckmark24,
} from '@create-figma-plugin/ui';
import { usePlugin } from '../../context/PluginContext';

export const TokenDisclosure: FunctionComponent = () => {
  const { tokenPresent, sendMessage, notify } = usePlugin();
  const [tokenInput, setTokenInput] = useState('');
  const [isOpen, setIsOpen] = useState(!tokenPresent);
  const [isValidating, setIsValidating] = useState(false);

  const handleSaveToken = useCallback(() => {
    if (!tokenInput.trim()) {
      notify('error', 'Please enter a token');
      return;
    }
    sendMessage({ type: 'SAVE_TOKEN', token: tokenInput.trim() });
    setTokenInput('');
    setIsOpen(false);
    notify('success', 'Token saved successfully');
  }, [tokenInput, sendMessage, notify]);

  const handleClearToken = useCallback(() => {
    sendMessage({ type: 'CLEAR_TOKEN' });
    setIsOpen(true);
    notify('success', 'Token cleared');
  }, [sendMessage, notify]);

  const handleValidateToken = useCallback(() => {
    setIsValidating(true);
    sendMessage({ type: 'VALIDATE_TOKEN' });
    // Reset after a timeout (validation response would come through messages)
    setTimeout(() => setIsValidating(false), 3000);
  }, [sendMessage]);

  return (
    <Disclosure onClick={() => setIsOpen(!isOpen)} open={isOpen} title="GitHub Token">
      {tokenPresent ? (
        <Stack space="small">
          <Banner variant="success" icon={<IconApprovedCheckmark24 />}>
            <Text>Token is configured</Text>
          </Banner>

          <Inline space="small">
            <Button onClick={handleValidateToken} disabled={isValidating} secondary>
              {isValidating ? 'Validating...' : 'Validate Token'}
            </Button>
            <Button onClick={handleClearToken} secondary>
              Clear Token
            </Button>
          </Inline>

          <Text>
            <Muted>Token is stored securely in Figma&apos;s client storage</Muted>
          </Text>
        </Stack>
      ) : (
        <Stack space="small">
          <Text>
            <Muted>
              Enter a GitHub Personal Access Token with <strong>repo</strong> permissions.
            </Muted>
          </Text>

          <Textbox
            value={tokenInput}
            onInput={(e) => setTokenInput(e.currentTarget.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          >
            <Text>Personal Access Token</Text>
          </Textbox>

          <Button onClick={handleSaveToken} disabled={!tokenInput.trim()} fullWidth>
            Save Token
          </Button>

          <VerticalSpace space="extraSmall" />

          <Text>
            <Muted>
              <a
                href="https://github.com/settings/tokens/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                Create a new token →
              </a>
            </Muted>
          </Text>
        </Stack>
      )}
    </Disclosure>
  );
};
