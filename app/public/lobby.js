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
const activities = {
  edm: '중앙 무대에서 조명에 맞춰 군무',
  hiphop: '골목에서 자유 춤 · 루프탑 사진 촬영',
  social: '정원과 테라스에서 테이블 대화',
  retro: '미러볼 아래 중앙·보조 홀에서 디스코 춤',
};
let lastListing;
function channelLink(club, channel) {
  const p = document.createElement('p'), a = document.createElement('a');
  a.textContent = channel.channelId + ' · ' + channel.people + '/' + channel.capacity + '명';
  if (channel.people < channel.capacity)
    a.href = '/clubs/' + club.id + '?channel=' + encodeURIComponent(channel.channelId);
  else a.textContent += ' · 만석';
  p.append(a);
  return p;
}
function clubCard(club, testLobby) {
  const section = document.createElement('section');
  const info = document.createElement('div');
  if (testLobby) {
    const image = document.createElement('img');
    image.src = '/lobby-maps/' + club.id + '.webp';
    image.alt = club.name + ' 실제 맵';
    section.append(image);
    info.className = 'club-info';
  }
  const heading = document.createElement('h2');
  heading.textContent = club.name;
  info.append(heading);
  if (testLobby) {
    const activity = document.createElement('p');
    activity.textContent = activities[club.id];
    const population = document.createElement('p');
    population.textContent = '실제 접속 ' + club.people + '명';
    info.append(activity, population);
  }
  if (club.open || club.review) {
    const join = document.createElement('a');
    join.href = club.open ? '/clubs/' + club.id : club.review;
    join.textContent = testLobby ? '클럽 입장' : '자동 입장';
    join.setAttribute('aria-label', club.name + ' ' + join.textContent);
    join.className = 'enter';
    info.append(join);
  } else info.append('준비 중');
  const channels = document.createElement('div');
  channels.className = 'club-channels';
  channels.append(...club.channels.map(channel => channelLink(club, channel)));
  section.append(info, channels);
  return section;
}
async function load() {
  try {
    const res = await fetch('/api/lobby');
    if (!res.ok) throw Error();
    const { clubs } = await res.json();
    const listing = JSON.stringify(clubs);
    if (listing === lastListing) return;
    const testLobby = clubs.some(club => club.review);
    document.body.classList.toggle('test-lobby', testLobby);
    const focus = main.contains(document.activeElement) ? document.activeElement.href : null;
    main.replaceChildren(...clubs.map(club => clubCard(club, testLobby)));
    if (focus) [...main.querySelectorAll('a')].find(a => a.href === focus)?.focus({preventScroll:true});
    lastListing = listing;
  } catch {
    lastListing = undefined;
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
