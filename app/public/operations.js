const panel = document.getElementById('operations');
function row(parent, values) {
  const p = document.createElement('p');
  p.textContent = values.join(' · ');
  parent.append(p);
  return p;
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
  section('채널 접속', channels);
  for (const c of channels)
    row(panel, [c.channelId, '실제 ' + c.people + '/' + c.capacity + '명', 'AI ' + c.ai + '명']);
  section('신고', reports);
  for (const r of reports) {
    const p = row(panel, [r.id, r.channel, r.target, r.note, r.last_action || '접수']);
    for (const [action, label] of [
      ['reviewed', '확인 기록'],
      ['mute', '채팅 제한'],
      ['unmute', '제한 해제'],
    ]) {
      const b = document.createElement('button');
      b.textContent = label;
      p.append(b);
      b.onclick = async () => {
        b.disabled = true;
        try {
          const res = await fetch('/api/operator/reports/' + encodeURIComponent(r.id), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
          });
          if (!res.ok) throw Error();
          await load();
        } catch {
          b.disabled = false;
          document.querySelector('output').textContent = '조치를 저장하지 못했습니다.';
        }
      };
    }
  }
  section('최근 운영 조치', decisions);
  for (const d of decisions)
    row(panel, [new Date(d.created).toLocaleString(), d.report_id, d.target, d.operator, d.action]);
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
