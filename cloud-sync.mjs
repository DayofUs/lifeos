// An insert must leave an existing row alone. An update must match the revision
// that was read before the user chose to save.
export async function writeCloudSnapshot({ endpoint, userId, headers, snapshot, observedRevision, send = fetch, now = Date.now() }) {
  const url = new URL(endpoint + '/rest/v1/kitchen_state');
  url.searchParams.set('select', 'updated_at');
  const creating = observedRevision === null;
  const revisionTime = creating ? now : Math.max(now, Date.parse(observedRevision) + 1);
  const updated_at = new Date(revisionTime).toISOString();
  const body = { data: snapshot, updated_at };
  if (creating) {
    url.searchParams.set('on_conflict', 'user_id');
    body.user_id = userId;
  } else {
    url.searchParams.set('user_id', 'eq.' + userId);
    url.searchParams.set('updated_at', 'eq.' + observedRevision);
  }
  const result = await send(url, {
    method: creating ? 'POST' : 'PATCH',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      Prefer: creating ? 'resolution=ignore-duplicates,return=representation' : 'return=representation'
    },
    body: JSON.stringify(body)
  });
  if (!result.ok) throw Error('Could not save the cloud copy (' + result.status + ').');
  const rows = await result.json();
  return rows.length === 1 ? rows[0].updated_at : null;
}

export function kitchenStorageKey(base, project, userId) {
  return project && userId
    ? base + ':account:' + JSON.stringify([project.replace(/\/+$/, ''), userId])
    : base;
}
