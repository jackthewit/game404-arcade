// Vercel Serverless Function: 관리자 1차 비밀번호 + 아이폰 기본 「암호」 앱 6자리 OTP(TOTP) 2중 보안 인증 게이트웨이
import crypto from 'node:crypto';
import QRCode from 'qrcode';
import { SUPABASE_FALLBACK } from '../shared/config.js';

const OTP_ENROLL_RUN_ID = 'cfg_otp_2fa';
const ISSUER = '404아케이드';
const ACCOUNT_LABEL = '404아케이드:관리자';
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// 메모리 내 단기 브루트포스 방어 (IP별 OTP 실패 제한)
const otpFailMap = new Map();

function getSupabase() {
  return {
    url: (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || SUPABASE_FALLBACK.url).replace(/\/$/, ''),
    key: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_FALLBACK.key,
  };
}

function getTotpSecret() {
  const raw = String(process.env.ADMIN_TOTP_SECRET || '').trim().toUpperCase().replace(/[^A-Z2-7]/g, '');
  if (raw.length < 16) {
    throw new Error('서버에 ADMIN_TOTP_SECRET 환경변수가 설정되지 않았습니다.');
  }
  return raw;
}

function base32Decode(str) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of str.toUpperCase()) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// RFC 6238 표준 6자리 TOTP 생성 (SHA-1, 30초 주기 — 아이폰 기본 「암호」 앱 호환)
function generateTotp(secretBase32, timeStep) {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  let counter = BigInt(timeStep);
  for (let i = 7; i >= 0; i--) {
    buf[i] = Number(counter & 0xffn);
    counter >>= 8n;
  }
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1000000).padStart(6, '0');
}

function verifyTotpCode(secretBase32, codeInput) {
  const clean = String(codeInput || '').replace(/\D/g, '');
  if (clean.length !== 6) return false;
  const nowStep = Math.floor(Date.now() / 1000 / 30);
  // 시계 미세 오차를 위해 ±1 스텝(±30초) 허용, 상수 시간 비교
  const inputBuf = Buffer.from(clean, 'utf8');
  for (const delta of [0, -1, 1]) {
    const candidate = Buffer.from(generateTotp(secretBase32, nowStep + delta), 'utf8');
    if (candidate.length === inputBuf.length && crypto.timingSafeEqual(candidate, inputBuf)) {
      return true;
    }
  }
  return false;
}

function pwFingerprint(pw) {
  return crypto.createHash('sha256').update(String(pw || '')).digest('hex').slice(0, 20);
}

function signToken(payloadObj, secretBase32) {
  const body = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', `g404_2fa_sig:${secretBase32}`)
    .update(body)
    .digest('base64url');
  return `${body}.${sig}`;
}

function verifyToken(token, secretBase32) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto
    .createHmac('sha256', `g404_2fa_sig:${secretBase32}`)
    .update(body)
    .digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const obj = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!obj || typeof obj.exp !== 'number' || Date.now() > obj.exp) return null;
    return obj;
  } catch {
    return null;
  }
}

async function sbRpc(sb, fn, args) {
  const r = await fetch(`${sb.url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: sb.key,
      Authorization: `Bearer ${sb.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    throw new Error((data && data.message) || `DB 응답 오류 (${r.status})`);
  }
  return data;
}

async function isOtpEnrolled(sb) {
  try {
    const row = await sbRpc(sb, 'g404_get_run', { p_id: OTP_ENROLL_RUN_ID });
    return Boolean(row && row.id && row.meta && row.meta.enrolled);
  } catch {
    return false;
  }
}

async function markOtpEnrolled(sb) {
  await sbRpc(sb, 'g404_submit_run', {
    p_id: OTP_ENROLL_RUN_ID,
    p_room_id: 'AUTH2FA',
    p_game_id: '__config__',
    p_nickname: 'otp_2fa',
    p_target_value: 1,
    p_actual_value: 1,
    p_score: 1,
    p_error_mm: null,
    p_rank_title: 'enrolled',
    p_seed: 1,
    p_meta: { enrolled: true, enrolledAt: new Date().toISOString() },
  });
}

async function buildEnrollmentBundle(secretBase32) {
  const otpauthUri =
    `otpauth://totp/${encodeURIComponent(ACCOUNT_LABEL)}` +
    `?secret=${encodeURIComponent(secretBase32)}` +
    `&issuer=${encodeURIComponent(ISSUER)}` +
    `&algorithm=SHA1&digits=6&period=30`;
  const applePasswordsUri = otpauthUri.replace(/^otpauth:\/\//, 'apple-otpauth://');
  const qrDataUrl = await QRCode.toDataURL(otpauthUri, {
    width: 260,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: { dark: '#161122', light: '#ffffff' },
  });
  const manualKey = secretBase32.match(/.{1,4}/g).join(' ');
  return { otpauthUri, applePasswordsUri, qrDataUrl, manualKey, issuer: ISSUER };
}

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf) return xf.split(',')[0].trim();
  return req.socket?.remoteAddress || 'local';
}

function checkOtpLock(ip) {
  const rec = otpFailMap.get(ip);
  if (!rec) return false;
  if (rec.count >= 6 && Date.now() - rec.at < 2 * 60 * 1000) return true;
  if (Date.now() - rec.at >= 2 * 60 * 1000) otpFailMap.delete(ip);
  return false;
}

function recordOtpFail(ip) {
  const rec = otpFailMap.get(ip) || { count: 0, at: 0 };
  rec.count += 1;
  rec.at = Date.now();
  otpFailMap.set(ip, rec);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  try {
    const sb = getSupabase();
    const secret = getTotpSecret();
    const ip = getClientIp(req);
    const step = String(body.step || '');

    // [1단계] 관리자 비밀번호 검증 → 통과 시 2단계(6자리 OTP 입력)로 진입
    if (step === 'prelogin') {
      const pw = String(body.pw || '');
      if (!pw) return res.status(400).json({ ok: false, error: 'bad_pw' });

      const authRes = await sbRpc(sb, 'g404_admin', { p_pw: pw, p_action: 'login', p_payload: {} });
      if (!authRes || !authRes.ok) {
        return res.status(401).json({ ok: false, error: (authRes && authRes.error) || 'bad_pw' });
      }

      const enrolled = await isOtpEnrolled(sb);
      const preToken = signToken(
        { kind: 'pre', pwFp: pwFingerprint(pw), exp: Date.now() + 5 * 60 * 1000 },
        secret
      );

      if (!enrolled) {
        const bundle = await buildEnrollmentBundle(secret);
        return res.status(200).json({
          ok: true,
          nextStep: 'otp_setup',
          preToken,
          ...bundle,
        });
      }

      return res.status(200).json({
        ok: true,
        nextStep: 'otp_verify',
        preToken,
      });
    }

    // [2단계] 아이폰 「암호」 앱 6자리 코드 검증 → 통과해야만 최종 입장 토큰 발급
    if (step === 'verify_otp') {
      if (checkOtpLock(ip)) {
        return res.status(429).json({
          ok: false,
          error: 'otp_locked',
          message: '6자리 코드를 여러 번 틀려 2분 동안 잠겼습니다. 잠시 후 다시 시도해 주세요.',
        });
      }

      const pw = String(body.pw || '');
      const preToken = String(body.preToken || '');
      const otpCode = String(body.otpCode || '').replace(/\D/g, '');

      const preObj = verifyToken(preToken, secret);
      if (!preObj || preObj.kind !== 'pre' || preObj.pwFp !== pwFingerprint(pw)) {
        return res.status(401).json({
          ok: false,
          error: 'session_expired',
          message: '1단계 인증 시간이 만료되었습니다. 비밀번호부터 다시 입력해 주세요.',
        });
      }

      if (!verifyTotpCode(secret, otpCode)) {
        recordOtpFail(ip);
        return res.status(401).json({
          ok: false,
          error: 'bad_otp',
          message: '6자리 인증 코드가 일치하지 않습니다. 아이폰 「암호」 앱의 현재 6자리 숫자를 입력해 주세요.',
        });
      }

      const authRes = await sbRpc(sb, 'g404_admin', { p_pw: pw, p_action: 'login', p_payload: {} });
      if (!authRes || !authRes.ok) {
        return res.status(401).json({ ok: false, error: (authRes && authRes.error) || 'bad_pw' });
      }

      otpFailMap.delete(ip);
      const enrolled = await isOtpEnrolled(sb);
      if (!enrolled) {
        await markOtpEnrolled(sb);
      }

      const sessionToken = signToken(
        { kind: '2fa_session', pwFp: pwFingerprint(pw), exp: Date.now() + 6 * 60 * 60 * 1000 },
        secret
      );

      return res.status(200).json({
        ok: true,
        sessionToken,
        games: Array.isArray(authRes.games) ? authRes.games : [],
      });
    }

    // [인증된 세션 전용] 관리자 작업 실행 (반드시 6자리 OTP 통과 세션 토큰이 있어야만 실행됨)
    if (step === 'rpc') {
      const pw = String(body.pw || '');
      const sessionToken = String(body.sessionToken || '');
      const action = String(body.action || '');
      const payload = body.payload || {};

      const sess = verifyToken(sessionToken, secret);
      if (!sess || sess.kind !== '2fa_session' || sess.pwFp !== pwFingerprint(pw)) {
        return res.status(401).json({
          ok: false,
          error: 'otp_required',
          message: '2중 로그인 세션이 만료되었습니다. 다시 로그인해 주세요.',
        });
      }

      // 비밀번호 변경: 반드시 사용자가 방금 입력한 '현재 비밀번호(current_pw)'가 일치해야만 변경 가능!
      if (action === 'change_pw') {
        const currentPw = String(payload.current_pw || '');
        const newPw = String(payload.new_pw || '').trim();
        if (!currentPw) {
          return res.status(400).json({ ok: false, error: 'current_pw_required' });
        }
        if (newPw.length < 4) {
          return res.status(400).json({ ok: false, error: 'pw_too_short' });
        }
        // DB 단에서 currentPw 해시 검증 수행 (틀리면 bad_pw 반환)
        const chgRes = await sbRpc(sb, 'g404_admin', {
          p_pw: currentPw,
          p_action: 'change_pw',
          p_payload: { new_pw: newPw },
        });
        if (!chgRes || !chgRes.ok) {
          return res.status(401).json({
            ok: false,
            error: (chgRes && chgRes.error) || 'bad_current_pw',
          });
        }
        const nextToken = signToken(
          { kind: '2fa_session', pwFp: pwFingerprint(newPw), exp: Date.now() + 6 * 60 * 60 * 1000 },
          secret
        );
        return res.status(200).json({ ok: true, sessionToken: nextToken });
      }

      // 설정 탭에서 새 아이폰 기기 추가용 OTP QR 다시 보기 (현재 비밀번호 + 현재 6자리 코드 이중 재확인 필수!)
      if (action === 'reissue_otp_qr') {
        const currentPw = String(payload.current_pw || '');
        const otpCode = String(payload.otp_code || '').replace(/\D/g, '');
        if (!currentPw) {
          return res.status(400).json({ ok: false, error: 'current_pw_required' });
        }
        const chk = await sbRpc(sb, 'g404_admin', { p_pw: currentPw, p_action: 'login', p_payload: {} });
        if (!chk || !chk.ok) {
          return res.status(401).json({ ok: false, error: 'bad_current_pw' });
        }
        if (!verifyTotpCode(secret, otpCode)) {
          return res.status(401).json({ ok: false, error: 'bad_otp' });
        }
        const bundle = await buildEnrollmentBundle(secret);
        return res.status(200).json({ ok: true, ...bundle });
      }

      const rpcRes = await sbRpc(sb, 'g404_admin', {
        p_pw: pw,
        p_action: action,
        p_payload: payload,
      });
      if (!rpcRes || !rpcRes.ok) {
        return res.status(400).json({ ok: false, error: (rpcRes && rpcRes.error) || 'rpc_failed' });
      }
      return res.status(200).json(rpcRes);
    }

    return res.status(400).json({ ok: false, error: 'invalid_step' });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'server_error',
      message: err.message || '서버 처리 오류가 발생했습니다.',
    });
  }
}
