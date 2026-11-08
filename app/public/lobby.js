const main = document.querySelector('main'),
  form = document.querySelector('form');
function mark(step) {
  try {
    const key = 'edm-first-visit',
      log = JSON.parse(localStorage.getItem(key) || '{}');
    if (!log[step]) {
      log[step] = Date.now();
      localStorage.setItem(key, JSON.stringify(log));
    }
  } catch {}
}
main.addEventListener('click', (e) => {
  if (e.target.closest('a[href]')) mark('theme');
});
async function load() {
  try {
    const res = await fetch('/api/lobby');
    if (!res.ok) throw Error();
    const { clubs } = await res.json(),
      content = document.createDocumentFragment();
    for (const club of clubs) {
      const section = document.createElement('section'),
        heading = document.createElement('h2');
      heading.textContent = club.name;
      section.append(heading);
      if (club.open) {
        const join = document.createElement('a');
        join.href = '/clubs/edm';
        join.textContent = '자동 입장';
        section.append(join);
        for (const channel of club.channels) {
          const p = document.createElement('p'),
            a = document.createElement('a');
          a.textContent =
            channel.channelId + ' · ' + channel.people + '/' + channel.capacity + '명';
          if (channel.people < channel.capacity)
            a.href = '/clubs/edm?channel=' + encodeURIComponent(channel.channelId);
          else a.textContent += ' · 만석';
          p.append(a);
          section.append(p);
        }
      } else if (club.review) {
        const link = document.createElement('a');
        link.href = club.review;
        link.textContent = '데스크톱 활동 검수';
        section.append(link);
      } else section.append('준비 중');
      content.append(section);
    }
    main.replaceChildren(content);
  } catch {
    main.textContent = '로비 정보를 불러오지 못했습니다.';
  }
}
await load();
setInterval(() => {
  if (!document.hidden) load();
}, 4000);
const session = await (await fetch('/api/session')).json();
if (session.status === 'authenticated') {
  document.getElementById('signin').hidden = true;
  mark('login');
  const p = await (await fetch('/api/account/profile')).json();
  for (const id of p.avatars)
    form.avatar.add(new Option({ indigo: '인디고', teal: '청록', rose: '로즈' }[id], id));
  form.nickname.value = p.nickname;
  form.avatar.value = p.avatar;
  form.hidden = false;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const out = form.querySelector('output');
    try {
      const res = await fetch('/api/account/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: form.nickname.value, avatar: form.avatar.value }),
      });
      if (res.ok) mark('profile');
      out.textContent = res.ok ? '저장했습니다.' : '저장되지 않았습니다.';
    } catch {
      out.textContent = '저장되지 않았습니다.';
    }
  };
}
