const panel = document.getElementById('operations');
function row(parent, values) {
  const p = document.createElement('p');
  p.textContent = values.join(' · ');
  parent.append(p);
  return p;
}
function channelTable(channels) {
  const table = document.createElement('table');
  table.setAttribute('aria-label', '클럽별 열린 채널');
  table.style.borderSpacing = '1em 0.35em';
  table.innerHTML = `<thead><tr>
    <th scope="col">클럽</th><th scope="col">열린 채널</th>
    <th scope="col">실제 접속</th><th scope="col">정원</th><th scope="col">AI 손님</th>
  </tr></thead>`;
  const names = { edm: 'EDM', hiphop: '힙합', social: '소셜 라운지', retro: '레트로 디스코' };
  for (const [id, name] of Object.entries(names)) {
    const group = table.createTBody();
    const first = group.insertRow();
    const heading = document.createElement('th');
    const active = channels.filter(channel => channel.clubId === id);
    heading.scope = 'rowgroup';
    heading.rowSpan = active.length || 1;
    heading.textContent = name;
    first.append(heading);
    if (!active.length) {
      const empty = first.insertCell();
      empty.colSpan = 4;
      empty.textContent = '열린 채널 없음';
      continue;
    }
    active.forEach((channel, index) => {
      const tr = index === 0 ? first : group.insertRow();
      tr.insertCell().textContent = channel.channelId;
      for (const count of [channel.people, channel.capacity, channel.ai])
        tr.insertCell().textContent = count + '명';
    });
  }
  return table;
}
async function load() {
  const [channels, reports, music, decisions] = await Promise.all(
    ['channels', 'reports', 'music', 'decisions'].map(async (name) => {
      const r = await fetch('/api/operator/' + name);
      if (!r.ok) throw Error();
      return r.json();
    }),
  );
  panel.replaceChildren();
  function section(title, items) {
    const h = document.createElement('h2');
    h.textContent = title;
    panel.append(h);
    if (!items.length) row(panel, ['없음']);
  }
  const title = document.createElement('h2');
  title.textContent = '채널 접속';
  panel.append(title, channelTable(channels));
  if (reports.length) {
    section('과거 신고 기록', reports);
    for (const r of reports)
      row(panel, [r.id, r.channel, r.target, r.note, r.last_action || '접수']);
  }
  if (decisions.length) {
    section('과거 운영 조치', decisions);
    for (const d of decisions)
      row(panel, [new Date(d.created).toLocaleString(), d.report_id, d.target, d.operator, d.action]);
  }
  section('음원 이용 권리', music);
  for (const t of music)
    row(panel, [
      t.id,
      t.club,
      t.playable ? '재생 가능' : '재생 보류',
      t.expires,
      t.approvedBy,
      t.evidence,
    ]);
}
function refresh() {
  load().catch(
    () => (document.querySelector('output').textContent = '운영 정보를 불러오지 못했습니다.'),
  );
}
document.getElementById('refresh').onclick = refresh;
refresh();
