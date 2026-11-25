// 카카오페이 온라인 단건 결제 준비(Ready) 서버리스 엔드포인트
// 환경변수:
//   KAKAOPAY_SECRET_KEY : 카카오페이 디벨로퍼스 Secret key (필수 — dev 또는 prd)
//   KAKAOPAY_CID        : 가맹점 코드 (선택 — 미설정 시 테스트 단건 결제 코드 'TC0ONETIME' 사용)

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const secretKey = (process.env.KAKAOPAY_SECRET_KEY || '').trim();
  const cid = (process.env.KAKAOPAY_CID || 'TC0ONETIME').trim();

  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      configured: Boolean(secretKey),
      cid,
      isTestMode: cid === 'TC0ONETIME',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  if (!secretKey) {
    return res.status(200).json({
      ok: false,
      code: 'MISSING_SECRET_KEY',
      message: '서버 환경변수(KAKAOPAY_SECRET_KEY)가 아직 등록되지 않았습니다. 아래 카카오페이 QR 코드 또는 송금 링크를 이용해 주세요.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const rawAmount = Math.round(Number(body.amount || 3000));
    const amount = Math.max(100, Math.min(1000000, rawAmount));
    const message = String(body.message || '').trim().slice(0, 40);
    const itemName = message
      ? `404 아케이드 응원 (${message})`
      : '이게뭔겜? 404 아케이드 제작 응원 후원';

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'game404-arcade.vercel.app';
    const origin = `${proto}://${host}`;

    const randSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    const partnerOrderId = `DON_${Date.now()}_${randSuffix}`;
    const partnerUserId = `SUPPORTER_${randSuffix}`;

    const payload = {
      cid,
      partner_order_id: partnerOrderId,
      partner_user_id: partnerUserId,
      item_name: itemName,
      quantity: 1,
      total_amount: amount,
      tax_free_amount: 0,
      approval_url: `${origin}/?donate_status=approve&order_id=${encodeURIComponent(partnerOrderId)}`,
      cancel_url: `${origin}/?donate_status=cancel`,
      fail_url: `${origin}/?donate_status=fail`,
    };

    const kpRes = await fetch('https://open-api.kakaopay.com/online/v1/payment/ready', {
      method: 'POST',
      headers: {
        Authorization: `SECRET_KEY ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await kpRes.json().catch(() => ({}));
    if (!kpRes.ok || !data.tid) {
      return res.status(kpRes.status || 400).json({
        ok: false,
        code: data.error_code || 'KAKAOPAY_READY_FAILED',
        message: data.error_message || data.msg || '카카오페이 결제 준비 요청에 실패했습니다.',
      });
    }

    return res.status(200).json({
      ok: true,
      tid: data.tid,
      cid,
      isTestMode: cid === 'TC0ONETIME',
      amount,
      partner_order_id: partnerOrderId,
      partner_user_id: partnerUserId,
      next_redirect_pc_url: data.next_redirect_pc_url,
      next_redirect_mobile_url: data.next_redirect_mobile_url,
      next_redirect_app_url: data.next_redirect_app_url,
      android_app_scheme: data.android_app_scheme,
      ios_app_scheme: data.ios_app_scheme,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: err && err.message ? err.message : '결제 요청 중 오류가 발생했습니다.',
    });
  }
}
