/**
 * DiffViewer Component
 *
 * Displays a token-level diff between the local DTCG export and the remote
 * file stored in GitHub. Helps users understand what changes will be committed
 * before they commit.
 *
 * Features:
 * - Automatically fetches remote data when opened
 * - Recursively traverses nested DTCG token structure
 * - Categorizes changes as added, removed, or changed
 * - Shows counts and first 10 items per category
 * - Handles loading, error, and "no remote file" states
 */

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
  VerticalSpace,
} from '@create-figma-plugin/ui';
import { usePlugin } from '../../context/PluginContext';
import { stableStringify } from '../../../util/stableStringify';
import styles from './DiffViewer.module.css';

/**
 * Summary counts of changes detected in the diff.
 */
interface DiffCounts {
  /** Number of tokens added (present in local but not remote) */
  added: number;
  /** Number of tokens removed (present in remote but not local) */
  removed: number;
  /** Number of tokens changed (present in both but with different values) */
  changed: number;
}

/**
 * Represents a single token change in the diff.
 */
interface TokenChange {
  /** Dot-separated path to the token (e.g., "color.bg.primary") */
  path: string;
  /** Type of change detected */
  type: 'added' | 'removed' | 'changed';
  /** Token value before change (only present for 'changed' and 'removed') */
  before?: unknown;
  /** Token value after change (only present for 'changed' and 'added') */
  after?: unknown;
}

export const DiffViewer: FunctionComponent = () => {
  const { exportState, remoteDataState, fetchRemoteData, settings } = usePlugin();

  // Fetch remote data on mount if not already fetched
  useEffect(() => {
    if (settings && !remoteDataState.loading && !remoteDataState.fetched) {
      fetchRemoteData();
    }
  }, [settings, remoteDataState.loading, remoteDataState.fetched, fetchRemoteData]);

  /**
   * Computes the diff between local and remote DTCG data.
   *
   * This memoized calculation:
   * 1. Recursively collects all token paths from both local and remote data
   * 2. Compares tokens using stable JSON serialization
   * 3. Categorizes changes as added, removed, or changed
   * 4. Returns structured diff data for rendering
   *
   * Re-runs only when local or remote data changes.
   */
  const diff = useMemo(() => {
    if (!exportState.data || !remoteDataState.data) return null;

    const changes: TokenChange[] = [];

    /**
     * Recursively walks the DTCG nested structure and collects all token paths.
     *
     * DTCG tokens are identified by the presence of a `$value` property.
     * Groups are identified by nested objects without `$value`.
     *
     * @param obj - Object to traverse (token group or root)
     * @param prefix - Current path prefix for nested traversal
     * @returns Map of token path → token object
     */
    const collectTokenPaths = (obj: Record<string, unknown>, prefix = ''): Map<string, unknown> => {
      const tokens = new Map<string, unknown>();

      for (const [key, value] of Object.entries(obj)) {
        // Skip DTCG metadata keys ($extensions, $type, etc.)
        if (key.startsWith('$')) continue;

        const path = prefix ? `${prefix}.${key}` : key;

        if (value && typeof value === 'object') {
          // Check if this is a token (has $value) or a group
          if ('$value' in value) {
            tokens.set(path, value);
          } else {
            // It's a group, recurse into children

            const nested = collectTokenPaths(value as Record<string, unknown>, path);
            nested.forEach((v, k) => tokens.set(k, v));
          }
        }
      }

      return tokens;
    };

    // Collect all token paths from both local and remote data
    const localTokens = collectTokenPaths(exportState.data as Record<string, unknown>);
    const remoteTokens = collectTokenPaths(remoteDataState.data as Record<string, unknown>);

    // Find added tokens (present in local but not in remote)
    localTokens.forEach((value, path) => {
      if (!remoteTokens.has(path)) {
        changes.push({ path, type: 'added', after: value });
      } else {
        // Token exists in both - check if value changed
        const remoteValue = remoteTokens.get(path);
        const localStr = stableStringify(value);
        const remoteStr = stableStringify(remoteValue);
        if (localStr !== remoteStr) {
          changes.push({ path, type: 'changed', before: remoteValue, after: value });
        }
      }
    });

    // Find removed tokens (present in remote but not in local)
    remoteTokens.forEach((value, path) => {
      if (!localTokens.has(path)) {
        changes.push({ path, type: 'removed', before: value });
      }
    });

    // Calculate summary counts by type
    const counts: DiffCounts = {
      added: changes.filter((c) => c.type === 'added').length,
      removed: changes.filter((c) => c.type === 'removed').length,
      changed: changes.filter((c) => c.type === 'changed').length,
    };

    return { changes, counts };
  }, [exportState.data, remoteDataState.data]);

  if (!exportState.data) {
    return (
      <Banner icon={<IconInfoSmall24 />}>
        <Text>Export variables to see diff</Text>
      </Banner>
    );
  }

  if (remoteDataState.loading) {
    return <LoadingIndicator>Fetching remote file...</LoadingIndicator>;
  }

  if (remoteDataState.error) {
    return (
      <Banner variant="warning" icon={<IconInfoSmall24 />}>
        <Text>Error: {remoteDataState.error}</Text>
      </Banner>
    );
  }

  if (!remoteDataState.data) {
    return (
      <Banner icon={<IconInfoSmall24 />}>
        <Text>Variables haven't been committed yet. All exported variables will be additions.</Text>
      </Banner>
    );
  }

  if (
    !diff ||
    (diff.counts.added === 0 && diff.counts.removed === 0 && diff.counts.changed === 0)
  ) {
    return (
      <Banner variant="success" icon={<IconInfoSmall24 />}>
        <Text>No changes - local and remote are identical</Text>
      </Banner>
    );
  }

  const addedTokens = diff.changes.filter((c) => c.type === 'added');
  const removedTokens = diff.changes.filter((c) => c.type === 'removed');
  const changedTokens = diff.changes.filter((c) => c.type === 'changed');

  return (
    <Stack space="small">
      <div>
        <Text>
          <Bold>Diff Preview</Bold>
        </Text>
        <VerticalSpace space="extraSmall" />
        <Text>
          <Muted>
            {diff.counts.added} added · {diff.counts.removed} removed · {diff.counts.changed}{' '}
            changed
          </Muted>
        </Text>
      </div>

      <div className={styles.diffContent}>
        {addedTokens.length > 0 && (
          <div className={styles.diffSection}>
            <Text>
              <Bold className={styles.addedLabel}>+ Added ({addedTokens.length})</Bold>
            </Text>
            <ul className={styles.tokenList}>
              {addedTokens.slice(0, 10).map((change) => (
                <li key={change.path} className={styles.addedItem}>
                  <Text>
                    <Muted>+ {change.path}</Muted>
                  </Text>
                </li>
              ))}
              {addedTokens.length > 10 && (
                <li className={styles.moreItem}>
                  <Text>
                    <Muted>... and {addedTokens.length - 10} more</Muted>
                  </Text>
                </li>
              )}
            </ul>
          </div>
        )}

        {changedTokens.length > 0 && (
          <div className={styles.diffSection}>
            <Text>
              <Bold className={styles.changedLabel}>~ Changed ({changedTokens.length})</Bold>
            </Text>
            <ul className={styles.tokenList}>
              {changedTokens.slice(0, 10).map((change) => (
                <li key={change.path} className={styles.changedItem}>
                  <Text>
                    <Muted>~ {change.path}</Muted>
                  </Text>
                </li>
              ))}
              {changedTokens.length > 10 && (
                <li className={styles.moreItem}>
                  <Text>
                    <Muted>... and {changedTokens.length - 10} more</Muted>
                  </Text>
                </li>
              )}
            </ul>
          </div>
        )}

        {removedTokens.length > 0 && (
          <div className={styles.diffSection}>
            <Text>
              <Bold className={styles.removedLabel}>- Removed ({removedTokens.length})</Bold>
            </Text>
            <ul className={styles.tokenList}>
              {removedTokens.slice(0, 10).map((change) => (
                <li key={change.path} className={styles.removedItem}>
                  <Text>
                    <Muted>- {change.path}</Muted>
                  </Text>
                </li>
              ))}
              {removedTokens.length > 10 && (
                <li className={styles.moreItem}>
                  <Text>
                    <Muted>... and {removedTokens.length - 10} more</Muted>
                  </Text>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </Stack>
  );
};
