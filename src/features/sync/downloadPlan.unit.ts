import { test, expect } from '@playwright/test';
import { planDownloads } from './downloadPlan';
import type { RemoteFile } from './providers/types';

const file = (
  kind: 'chunk' | 'snapshot',
  device: string,
  seq: number
): RemoteFile => ({
  id: `${kind}-${device}-${seq}`,
  name:
    kind === 'chunk' ? `chunk_${device}_${seq}.bin` : `snapshot_${device}.bin`,
  appProperties: { kind, device, seq: String(seq) },
});

const ids = (plan: ReturnType<typeof planDownloads>) =>
  plan.downloads.map((ref) => ref.file.id);

test('downloads only unseen chunks of other devices', () => {
  const files = [
    file('chunk', 'mine', 1),
    file('chunk', 'other', 1),
    file('chunk', 'other', 2),
    file('chunk', 'other', 3),
    { id: 'vault', name: 'vault.json', appProperties: { kind: 'vault' } },
  ];
  const plan = planDownloads(files, 'mine', new Map([['other', 1]]));
  expect(ids(plan)).toEqual(['chunk-other-2', 'chunk-other-3']);
  expect(plan.cursors.get('other')).toBe(3);
  expect(ids(planDownloads(files, 'mine', plan.cursors))).toEqual([]);
});

test('reads the snapshot first when compaction removed unseen chunks', () => {
  const files = [file('snapshot', 'other', 50), file('chunk', 'other', 51)];
  const lagging = planDownloads(files, 'mine', new Map([['other', 10]]));
  expect(ids(lagging)).toEqual(['snapshot-other-50', 'chunk-other-51']);
  expect(lagging.cursors.get('other')).toBe(51);
  // A device that is up to date skips the snapshot.
  expect(ids(planDownloads(files, 'mine', new Map([['other', 50]])))).toEqual([
    'chunk-other-51',
  ]);
  // A device whose next chunk still exists does not need the snapshot.
  expect(
    ids(
      planDownloads(
        [...files, file('chunk', 'other', 11)],
        'mine',
        new Map([['other', 10]])
      )
    )
  ).toEqual(['chunk-other-11', 'chunk-other-51']);
});

test('replays every device, including this one, when asked to', () => {
  const files = [
    file('snapshot', 'mine', 5),
    file('chunk', 'mine', 6),
    file('chunk', 'other', 1),
  ];
  expect(
    ids(planDownloads(files, 'mine', new Map([['other', 1]]), true))
  ).toEqual(['snapshot-mine-5', 'chunk-mine-6', 'chunk-other-1']);
});
