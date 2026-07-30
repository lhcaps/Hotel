export function snapshotProtectedPort(pid) {
  if (pid === null) {
    return { kind: 'FREE' };
  }
  if (typeof pid === 'string' && /^\d+$/.test(pid) && Number(pid) > 0) {
    return { kind: 'OCCUPIED', pid: Number(pid) };
  }
  if (typeof pid === 'number' && Number.isInteger(pid) && pid > 0) {
    return { kind: 'OCCUPIED', pid };
  }
  throw new Error('Protected-port snapshot lookup returned an invalid owner.');
}

export function compareProtectedPortStates(before, after) {
  const ok = before.kind === after.kind && (before.kind === 'FREE' || before.pid === after.pid);
  return {
    ok,
    detail: ok
      ? before.kind === 'FREE'
        ? 'before=FREE after=FREE'
        : `before=OCCUPIED(${before.pid}) after=OCCUPIED(${after.pid})`
      : `before=${formatProtectedPortState(before)} after=${formatProtectedPortState(after)}`,
  };
}

export function formatProtectedPortState(state) {
  return state.kind === 'FREE' ? 'FREE' : `OCCUPIED(${state.pid})`;
}
