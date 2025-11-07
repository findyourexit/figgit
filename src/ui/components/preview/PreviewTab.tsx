/**
 * PreviewTab Component
 *
 * Displays JSON export preview and diff viewer.
 */

import { h, FunctionComponent } from 'preact';
import { Container, VerticalSpace } from '@create-figma-plugin/ui';
import { JsonViewer } from './JsonViewer';
import { DiffDisclosure } from './DiffDisclosure';

export const PreviewTab: FunctionComponent = () => {
  return (
    <Container space="medium">
      <VerticalSpace space="medium" />

      <JsonViewer />

      <VerticalSpace space="large" />

      <DiffDisclosure />

      <VerticalSpace space="medium" />
    </Container>
  );
};
