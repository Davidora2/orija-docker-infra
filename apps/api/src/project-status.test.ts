import { describe, expect, it } from 'vitest';

/** Mirrors Plan UX Active / Paused / Done labels used by web + mobile. */
function projectStatusLabel(status: string): string {
  if (status === 'DONE') return 'Done';
  if (status === 'PAUSED') return 'Paused';
  return 'Active';
}

function projectStatusRank(status: string): number {
  if (status === 'DONE') return 2;
  if (status === 'PAUSED') return 1;
  return 0;
}

describe('project lifecycle status', () => {
  it('labels Active / Paused / Done for Plan UX', () => {
    expect(projectStatusLabel('ACTIVE')).toBe('Active');
    expect(projectStatusLabel('PAUSED')).toBe('Paused');
    expect(projectStatusLabel('DONE')).toBe('Done');
  });

  it('sorts Active before Paused before Done', () => {
    const statuses = ['DONE', 'ACTIVE', 'PAUSED'];
    expect(
      [...statuses].sort(
        (a, b) => projectStatusRank(a) - projectStatusRank(b),
      ),
    ).toEqual(['ACTIVE', 'PAUSED', 'DONE']);
  });
});
