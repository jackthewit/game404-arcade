// 카카오톡·인스타·디스코드 공유 시 지인의 전체 랭킹 기록이 미리보기(OG 태그)로 뜨게 하는 동적 공유 엔드포인트
// 사용 예: /s/haircut?ref=7K9M2P  (구버전 ?c=, ?d= 도 모두 호환)
const GAME_META = {
  snap: {
    name: '웨딩·여행 스냅 알바',
    emoji: '📸',
    desc: '오리·전 애인부터 UFO·선글라스 알파카까지 매번 다른 랜덤 소동 속에서 예시 사진과 똑같이 찍는 10스테이지 스냅 알바!',
  },
  jjamppong: {
    name: '짬뽕 탄막',
    emoji: '🍜',
    desc: '하필 새하얀 흰 티 입은 날 시킨 사악한 해물짬뽕! 젓가락질마다 사방으로 튀는 국물 탄막을 피해 오래 버티세요!',
  },
  boxcut: {
    name: '열려라 택배!',
    emoji: '📦',
    desc: '밀려드는 택배 폭탄! 테이프 선을 따라 칼각 직선으로 쫙 그어 뜯고 상자 속 깜짝 선물을 획득하세요!',
  },
  nail: {
    name: '손톱 색칠하기',
    emoji: '💅',
    desc: '살에 한 방울만 묻어도 못 지워요! 숨을 참아 수전증을 멈추고 다섯 손톱 풀컬러 정밀도에 도전하세요!',
  },
  cake: {
    name: '케이크 글씨 쓰기',
    emoji: '🎂',
    desc: '한 번 짜면 못 지우는 쫀득한 3D 초코펜! 직접 쓴 수제 케이크에 촛불을 켜고 360°로 돌려 공유해 보세요!',
  },
  haircut: {
    name: '어떻게 잘라드릴까요?',
    emoji: '✂️',
    desc: '왼쪽·가운데·오른쪽 3번에 나눠 실제 길이(cm)로 다듬는 미용실 눈대중 챌린지!',
  },
  toilet: {
    name: '무한 두루마리',
    emoji: '🧻',
    desc: '화장실 두루마리 휴지를 안 끊기고 100km까지 돌돌돌돌! 미라가 될 때까지 빼서 기록 경쟁!',
  },
  film: {
    name: '강화필름 한번에',
    emoji: '📱',
    desc: '탑·프론트·레프트 구도로 미세한 미끄러짐을 이기고 0.1mm 정밀 부착에 도전하세요!',
  },
};

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodePayload(d) {
  try {
    const b64 = String(d).replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = Buffer.from(pad, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const game = GAME_META[req.query.game] ? req.query.game : 'haircut';
  const meta = GAME_META[game];
  const ref = typeof req.query.ref === 'string' ? req.query.ref.trim() : '';
  const code = typeof req.query.c === 'string' ? req.query.c.trim() : (ref && ref.length <= 16 ? ref : '');
  const rawD = typeof req.query.d === 'string' ? req.query.d.trim() : (ref && ref.length > 16 ? ref : '');

  let run = null;

  const sbUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zaxwhkbeuriuxbtvlwsi.supabase.co';
  const sbKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpheHdoa2JldXJpdXhidHZsd3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MjgwNzQsImV4cCI6MjEwOTIwNDA3NH0.rXuoxJxtbZU7vog7dMNwLpeiMeJd6YK6W_ZNGS36ZFM';
  if (code && sbUrl && sbKey) {
    try {
      const r = await fetch(`${sbUrl.replace(/\/$/, '')}/rest/v1/rpc/g404_get_run`, {
        method: 'POST',
        headers: {
          apikey: sbKey,
          Authorization: `Bearer ${sbKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_id: code }),
      });
      if (r.ok) {
        const obj = await r.json();
        if (obj && obj.id) run = obj;
      }
    } catch {
      // fallback
    }
  }

  if (!run && rawD) {
    const p = decodePayload(rawD);
    if (p) {
      run = {
        nickname: p.n || '지인',
        target_value: p.t,
        actual_value: p.v,
        score: p.sc,
        error_mm: p.e,
        rank_title: p.r || '',
      };
    }
  }

  let ogTitle = `${meta.emoji} ${meta.name} — 이게뭔겜? 404 아케이드`;
  let ogDesc = meta.desc;

  if (run) {
    const who = run.nickname || '지인';
    if (game === 'haircut') {
      const err = run.error_mm != null ? `${Number(run.error_mm).toFixed(1)}mm` : '';
      ogTitle = `✂️ ${who}님의 [어떻게 잘라드릴까요?] 기록: 오차 ${err} (${Math.round(run.score || 0)}점)`;
      ogDesc = `전체 랭킹에서 ${who}님의 위치를 확인하고 기록을 깨 보세요! (${run.rank_title || '도전자'})`;
    } else if (game === 'toilet') {
      const m = Number(run.score || 0);
      const lenStr = m >= 1000 ? `${(m / 1000).toFixed(2)}km` : `${m.toFixed(1)}m`;
      ogTitle = `🧻 ${who}님의 [무한 두루마리] 기록: ${lenStr} 안 끊기고 감기!`;
      ogDesc = `전체 랭킹에서 ${who}님의 위치를 확인하고 기록을 깨 보세요! (${run.rank_title || '휴지 장인'})`;
    } else if (game === 'film') {
      ogTitle = `📱 ${who}님의 [강화필름 한번에] 기록: ${Math.round(run.score || 0)}점`;
      ogDesc = `전체 랭킹에서 ${who}님의 위치를 확인하고 기록을 깨 보세요! (${run.rank_title || '필름 장인'})`;
    } else if (game === 'cake') {
      ogTitle = `🎂 ${who}님의 [케이크 글씨 쓰기] 기록: ${Math.round(run.score || 0)}점`;
      ogDesc = `전체 랭킹에서 ${who}님의 위치를 확인하고 초코펜 레터링 기록을 깨 보세요! (${run.rank_title || '파티시에'})`;
    } else if (game === 'nail') {
      const tCode = Math.round(Number(run.target_value || 0));
      const dStr = tCode === 3 ? '상' : tCode === 2 ? '중' : tCode === 1 ? '하' : '';
      const sec = Number(run.actual_value || 0);
      const secTxt = sec > 5 ? ` · ${sec.toFixed(1)}초` : '';
      ogTitle = `💅 ${who}님의 [손톱 색칠하기${dStr ? ` · ${dStr}` : ''}] 총점 ${Number(run.score || 0).toFixed(1)}점${secTxt}`;
      ogDesc = `전체 랭킹에서 ${who}님의 위치를 확인하고 타임어택 네일아트 기록을 깨 보세요! (${run.rank_title || '네일리스트'})`;
    } else if (game === 'boxcut') {
      const bx = Math.round(Number(run.actual_value || 0));
      const gf = Math.round(Number(run.target_value || 0));
      ogTitle = `📦 ${who}님의 [열려라 택배!] 기록: ${Math.round(Number(run.score || 0)).toLocaleString()}점 (${bx}상자 개봉 · 선물 ${gf}개)`;
      ogDesc = `전체 랭킹에서 ${who}님의 위치를 확인하고 칼각 언박싱 기록을 깨 보세요! (${run.rank_title || '언박싱 도전자'})`;
    } else if (game === 'jjamppong') {
      const sec = Number(run.score || 0).toFixed(2);
      const wv = Math.round(Number(run.actual_value || 0));
      ogTitle = `🍜 ${who}님의 [짬뽕 탄막] 흰 티 생존 기록: ${sec}초 (${wv}젓가락 방어)`;
      ogDesc = `사악한 짬뽕 국물 지옥에서 ${who}님보다 오래 살아남아 보세요! (${run.rank_title || '순백 수호자'})`;
    } else if (game === 'snap') {
      const pay = Math.round(Number(run.score || 0)).toLocaleString();
      const st = Math.round(Number(run.actual_value || 1));
      const sh = Math.round(Number(run.target_value || 0));
      ogTitle = `📸 ${who}님의 [웨딩·여행 스냅 알바] 수입: ${pay}원 (STAGE ${st}/10 · 인생샷 ${sh}장)`;
      ogDesc = `오리와 외계인이 난입하는 스냅 알바에서 ${who}님의 기록을 깨 보세요! (${run.rank_title || '스냅 작가'})`;
    }
  }

  const qs = ref
    ? `?ref=${encodeURIComponent(ref)}`
    : code
      ? `?ref=${encodeURIComponent(code)}`
      : rawD
        ? `?ref=${encodeURIComponent(rawD)}`
        : '';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'game404-arcade.vercel.app').split(',')[0].trim();
  const origin = `https://${host}`;
  const ogImg = `${origin}/assets/thumb-${game}.jpg`;
  const targetPath = `/${game}/${qs}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="icon" type="image/png" href="/assets/icon-192.png">
  <title>${esc(ogTitle)}</title>
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="이게뭔겜? 404 아케이드">
  <meta property="og:title" content="${esc(ogTitle)}">
  <meta property="og:description" content="${esc(ogDesc)}">
  <meta property="og:image" content="${esc(ogImg)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(ogTitle)}">
  <meta name="twitter:description" content="${esc(ogDesc)}">
  <meta name="twitter:image" content="${esc(ogImg)}">
  <meta http-equiv="refresh" content="0;url=${esc(targetPath)}">
</head>
<body style="background:#14111b;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
  <p>전체 랭킹 도전장으로 이동 중... <a href="${esc(targetPath)}" style="color:#ffd84a">바로 열기</a></p>
  <script>location.replace(${JSON.stringify(targetPath)});</script>
</body>
</html>`);
}
