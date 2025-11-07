/**
 * DiffDisclosure Component
 *
 * Collapsible diff viewer showing changes vs remote file.
 */

import { h, FunctionComponent } from 'preact';
import { useState } from 'preact/hooks';
import { Disclosure } from '@create-figma-plugin/ui';
import { DiffViewer } from './DiffViewer';

export const DiffDisclosure: FunctionComponent = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Disclosure
      onClick={() => setIsOpen(!isOpen)}
      open={isOpen}
      title="View Diff (Compare to Repo)"
    >
      <DiffViewer />
    </Disclosure>
  );
};
