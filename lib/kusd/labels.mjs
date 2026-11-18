// Display labels for /kusd that depend on the live check, kept pure so they can be tested.

const STATUS = ['Live', 'Frozen', 'Settled']; // ag/oracle.ag STATUS_LIVE / FROZEN / SETTLED

// staleOracle: true / false from /api/kusd/status, null when the chain couldn't be checked.
export function oracleStatusLabel(status, staleOracle) {
  const name = STATUS[status] ?? String(status);
  if (status !== 0) return name;
  if (staleOracle === true) return 'Live · stale, freezable';
  if (staleOracle === false) return 'Live';
  return 'Live as of snapshot';
}
