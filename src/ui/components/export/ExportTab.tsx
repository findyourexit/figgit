/**
 * ExportTab Component
 *
 * Primary action tab for exporting and committing variables.
 */

import { h, FunctionComponent } from 'preact';
import { Container, VerticalSpace } from '@create-figma-plugin/ui';
import { StatusSummary } from './StatusSummary';
import { ActionButtons } from './ActionButtons';

export const ExportTab: FunctionComponent = () => {
  return (
    <Container space="medium">
      <VerticalSpace space="medium" />

      <StatusSummary />

      <VerticalSpace space="large" />

      <ActionButtons />

      <VerticalSpace space="medium" />
    </Container>
  );
};
