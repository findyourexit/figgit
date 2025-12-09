import { h, FunctionComponent } from 'preact';
import { useEffect, useMemo } from 'preact/hooks';
import {
  Stack,
  Text,
  Muted,
  Bold,
  Banner,
  LoadingIndicator,
  IconInfoSmall24,
} from '@create-figma-plugin/ui';
import { usePlugin } from '../../context/PluginContext';
import { stableStringify } from '../../../util/stableStringify';
import type { ExportDocument } from '../../../types/export';
import type { FigmaNativeExportDocument } from '../../../shared/figma-native-types';
import styles from './DiffViewer.module.css';

interface DiffCounts {
  added: number;
  removed: number;
  changed: number;
}

interface DocumentDiffResult {
  doc: ExportDocument;
  counts: DiffCounts;
  added: string[];
  removed: string[];
  changed: string[];
  remoteMissing: boolean;
  error?: string;
}

export const DiffViewer: FunctionComponent = () => {
  const { exportState, remoteDataState, fetchRemoteData, settings } = usePlugin();

  useEffect(() => {
    if (
      settings &&
      exportState.data &&
      exportState.data.documents.length &&
      !remoteDataState.loading &&
      !remoteDataState.fetched
    ) {
      const paths = exportState.data.documents.map((doc) => doc.relativePath);
      fetchRemoteData(paths);
    }
  }, [
    settings,
    exportState.data,
    remoteDataState.loading,
    remoteDataState.fetched,
    fetchRemoteData,
  ]);

  if (!exportState.data) {
    return (
      <Banner icon={<IconInfoSmall24 />}>
        <Text>Export variables to see diff</Text>
      </Banner>
    );
  }

  if (remoteDataState.loading) {
    return <LoadingIndicator>Fetching remote files...</LoadingIndicator>;
  }

  if (remoteDataState.error) {
    return (
      <Banner variant="warning" icon={<IconInfoSmall24 />}>
        <Text>Error: {remoteDataState.error}</Text>
      </Banner>
    );
  }

  const diffs = useMemo(() => {
    if (!exportState.data) return [];
    return exportState.data.documents.map((doc) => {
      const remote = remoteDataState.files.find((file) => file.path === doc.relativePath);
      return computeDocumentDiff(doc, remote);
    });
  }, [exportState.data, remoteDataState.files]);

  const hasAnyChanges = diffs.some(
    (diff) =>
      diff.remoteMissing ||
      diff.error ||
      diff.counts.added ||
      diff.counts.removed ||
      diff.counts.changed
  );

  if (!hasAnyChanges) {
    return (
      <Banner variant="success" icon={<IconInfoSmall24 />}>
        <Text>No changes - local and remote files are identical</Text>
      </Banner>
    );
  }

  return (
    <Stack space="medium">
      {diffs.map((diff) => (
        <DocumentDiffSection key={diff.doc.id} diff={diff} />
      ))}
    </Stack>
  );
};

function DocumentDiffSection({ diff }: { diff: DocumentDiffResult }) {
  return (
    <div className={styles.diffSection}>
      <Stack space="extraSmall">
        <Text>
          <Bold>{diff.doc.label}</Bold>
        </Text>
        <Text>
          <Muted>{diff.doc.relativePath}</Muted>
        </Text>
      </Stack>

      {diff.error && (
        <Banner variant="warning" icon={<IconInfoSmall24 />}>
          <Text>{diff.error}</Text>
        </Banner>
      )}

      {!diff.error && diff.remoteMissing && (
        <Banner icon={<IconInfoSmall24 />}>
          <Text>Remote file not found. Committing will create this file.</Text>
        </Banner>
      )}

      {!diff.error &&
        !diff.remoteMissing &&
        diff.counts.added === 0 &&
        diff.counts.removed === 0 &&
        diff.counts.changed === 0 && (
          <Banner variant="success" icon={<IconInfoSmall24 />}>
            <Text>No changes detected for this document</Text>
          </Banner>
        )}

      {!diff.error && (diff.counts.added || diff.counts.removed || diff.counts.changed) ? (
        <div className={styles.diffContent}>
          {diff.added.length > 0 && (
            <div>
              <Text>
                <Bold className={styles.addedLabel}>+ Added ({diff.added.length})</Bold>
              </Text>
              <ul className={styles.tokenList}>
                {diff.added.slice(0, 10).map((path) => (
                  <li key={`added-${path}`} className={styles.addedItem}>
                    <Text>
                      <Muted>+ {path}</Muted>
                    </Text>
                  </li>
                ))}
                {diff.added.length > 10 && (
                  <li className={styles.moreItem}>
                    <Text>
                      <Muted>... and {diff.added.length - 10} more</Muted>
                    </Text>
                  </li>
                )}
              </ul>
            </div>
          )}

          {diff.changed.length > 0 && (
            <div>
              <Text>
                <Bold className={styles.changedLabel}>~ Changed ({diff.changed.length})</Bold>
              </Text>
              <ul className={styles.tokenList}>
                {diff.changed.slice(0, 10).map((path) => (
                  <li key={`changed-${path}`} className={styles.changedItem}>
                    <Text>
                      <Muted>~ {path}</Muted>
                    </Text>
                  </li>
                ))}
                {diff.changed.length > 10 && (
                  <li className={styles.moreItem}>
                    <Text>
                      <Muted>... and {diff.changed.length - 10} more</Muted>
                    </Text>
                  </li>
                )}
              </ul>
            </div>
          )}

          {diff.removed.length > 0 && (
            <div>
              <Text>
                <Bold className={styles.removedLabel}>- Removed ({diff.removed.length})</Bold>
              </Text>
              <ul className={styles.tokenList}>
                {diff.removed.slice(0, 10).map((path) => (
                  <li key={`removed-${path}`} className={styles.removedItem}>
                    <Text>
                      <Muted>- {path}</Muted>
                    </Text>
                  </li>
                ))}
                {diff.removed.length > 10 && (
                  <li className={styles.moreItem}>
                    <Text>
                      <Muted>... and {diff.removed.length - 10} more</Muted>
                    </Text>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function computeDocumentDiff(
  doc: ExportDocument,
  remote?: { path: string; data?: unknown | null; error?: string }
): DocumentDiffResult {
  if (remote?.error) {
    return {
      doc,
      counts: { added: 0, removed: 0, changed: 0 },
      added: [],
      removed: [],
      changed: [],
      remoteMissing: false,
      error: `Failed to load remote file (${remote.error})`,
    };
  }

  const remoteMissing = !remote || remote.data === null;
  if (doc.format === 'dtcg') {
    const localMap = flattenDtcgTokens(doc.data as Record<string, unknown>);
    const remoteMap =
      !remoteMissing && isObject(remote?.data)
        ? flattenDtcgTokens(remote?.data as Record<string, unknown>)
        : new Map<string, unknown>();
    const diff = diffMaps(localMap, remoteMap);
    return {
      ...diff,
      doc,
      remoteMissing: remoteMissing && remote?.error === undefined,
      error: undefined,
    };
  }

  const localNative = doc.data as FigmaNativeExportDocument;
  const localMap = flattenNativeVariables(localNative);
  const remoteMap =
    !remoteMissing && isFigmaNativeExportDocument(remote?.data)
      ? flattenNativeVariables(remote?.data)
      : new Map<string, unknown>();
  const diff = diffMaps(localMap, remoteMap);
  return {
    ...diff,
    doc,
    remoteMissing: remoteMissing && remote?.error === undefined,
    error: undefined,
  };
}

function diffMaps(
  localMap: Map<string, unknown>,
  remoteMap: Map<string, unknown>
): Pick<DocumentDiffResult, 'counts' | 'added' | 'removed' | 'changed'> {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  localMap.forEach((value, path) => {
    if (!remoteMap.has(path)) {
      added.push(path);
      return;
    }
    const remoteValue = remoteMap.get(path);
    if (stableStringify(value) !== stableStringify(remoteValue)) {
      changed.push(path);
    }
  });

  remoteMap.forEach((_, path) => {
    if (!localMap.has(path)) {
      removed.push(path);
    }
  });

  return {
    counts: { added: added.length, removed: removed.length, changed: changed.length },
    added,
    removed,
    changed,
  };
}

function flattenDtcgTokens(obj: Record<string, unknown>, prefix = ''): Map<string, unknown> {
  const tokens = new Map<string, unknown>();
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object') {
      if ('$value' in (value as Record<string, unknown>)) {
        tokens.set(path, value);
      } else {
        const nested = flattenDtcgTokens(value as Record<string, unknown>, path);
        nested.forEach((tokenValue, tokenPath) => tokens.set(tokenPath, tokenValue));
      }
    }
  }
  return tokens;
}

function flattenNativeVariables(doc: FigmaNativeExportDocument): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const collection of doc.collections) {
    const base = collection.name;
    collection.variables.forEach((variable) => {
      const relativePath = variable.path || variable.name;
      map.set(`${base}/${relativePath}`, variable.valueByMode);
    });
  }
  return map;
}

function isFigmaNativeExportDocument(value: unknown): value is FigmaNativeExportDocument {
  if (!isObject(value)) {
    return false;
  }

  const maybeDoc = value as Partial<FigmaNativeExportDocument>;
  if (!Array.isArray(maybeDoc.collections)) {
    return false;
  }

  const countsAreNumbers =
    typeof maybeDoc.collectionsCount === 'number' && typeof maybeDoc.variablesCount === 'number';
  if (!countsAreNumbers) {
    return false;
  }

  return maybeDoc.collections.every((collection) =>
    Boolean(
      isObject(collection) &&
      typeof collection.name === 'string' &&
      Array.isArray(collection.variables)
    )
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}
