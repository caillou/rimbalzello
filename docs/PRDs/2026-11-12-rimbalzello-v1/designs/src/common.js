const C = { bd: '#ffd866', sd: '#ff61ef', hh: '#bef289', w: '#ffffff', drive: '#fc618d' };
const PATS = { bd: [0, 6, 10, 16, 22, 26], sd: [4, 12, 20, 28, 30], hh: [0, 2, 4, 6, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 25, 26, 28, 30] };

function steps(el, size) {
  el.innerHTML = ['bd', 'sd', 'hh'].map(n => {
    let s = `<div class="lane" style="font-size:${size}px"><span class="dim">${n} </span>`;
    for (let j = 0; j < 32; j++) {
      const hit = PATS[n].includes(j);
      const st = j === 9 ? 'background:#ffd866;color:#000' : `color:${hit ? C[n] : '#757575'}`;
      s += `<span style="${st}">${hit ? 'x' : '·'}</span>`;
    }
    return s + '</div>';
  }).join('');
}

function rows(el, list) {
  el.innerHTML = list.map(([name, v, col, muted]) => {
    const c = muted ? '#757575' : col;
    return `<div class="row"><span class="lbl" style="${muted ? 'color:#757575;text-decoration:line-through' : ''}">${name}</span>
      <div class="track"><div style="width:${v}%;background:${c}" class="fill"></div><div class="thumb" style="left:${v}%;background:${c}"></div></div>
      <span class="val">${muted ? 'mute' : v}</span></div>`;
  }).join('');
}

const MIX = [['bd', 63, C.bd], ['sd', 50, C.sd, true], ['hh', 78, C.hh]];
const FX = [['chaos', 34, C.w], ['drift', 22, C.w], ['drive', 40, C.drive]];
