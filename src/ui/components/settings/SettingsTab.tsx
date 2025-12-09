/**
 * SettingsTab Component
 *
 * Contains repository configuration, token management, and advanced options.
 * Organized using collapsible Disclosure components.
 */

import { h, FunctionComponent } from 'preact';
import { Container, VerticalSpace } from '@create-figma-plugin/ui';
import { RepositoryDisclosure } from './RepositoryDisclosure';
import { TokenDisclosure } from './TokenDisclosure';
import { ExportOptionsDisclosure } from './ExportOptionsDisclosure';
import { AdvancedDisclosure } from './AdvancedDisclosure';

export const SettingsTab: FunctionComponent = () => {
  return (
    <Container space="medium">
      <VerticalSpace space="medium" />

      <RepositoryDisclosure />

      <VerticalSpace space="medium" />

      <TokenDisclosure />

      <VerticalSpace space="medium" />

      <ExportOptionsDisclosure />

      <VerticalSpace space="medium" />

      <AdvancedDisclosure />

      <VerticalSpace space="medium" />
    </Container>
  );
};
