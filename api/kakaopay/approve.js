// 카카오페이 온라인 단건 결제 최종 승인(Approve) 서버리스 엔드포인트

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const secretKey = (process.env.KAKAOPAY_SECRET_KEY || '').trim();
  const defaultCid = (process.env.KAKAOPAY_CID || 'TC0ONETIME').trim();

  if (!secretKey) {
    return res.status(400).json({
      ok: false,
      code: 'MISSING_SECRET_KEY',
      message: 'KAKAOPAY_SECRET_KEY 환경변수가 설정되지 않았습니다.',
    });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const tid = String(body.tid || '').trim();
    const pgToken = String(body.pg_token || '').trim();
    const partnerOrderId = String(body.partner_order_id || '').trim();
    const partnerUserId = String(body.partner_user_id || '').trim();
    const cid = String(body.cid || defaultCid).trim();

    if (!tid || !pgToken || !partnerOrderId || !partnerUserId) {
      return res.status(400).json({
        ok: false,
        code: 'MISSING_PARAMS',
        message: '결제 승인에 필요한 정보(tid, pg_token, 주문번호)가 누락되었습니다.',
      });
    }

    const kpRes = await fetch('https://open-api.kakaopay.com/online/v1/payment/approve', {
      method: 'POST',
      headers: {
        Authorization: `SECRET_KEY ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        cid,
        tid,
        partner_order_id: partnerOrderId,
        partner_user_id: partnerUserId,
        pg_token: pgToken,
      }),
    });

    const data = await kpRes.json().catch(() => ({}));
    if (!kpRes.ok || !data.aid) {
      return res.status(kpRes.status || 400).json({
        ok: false,
        code: data.error_code || 'KAKAOPAY_APPROVE_FAILED',
        message: data.error_message || data.msg || '카카오페이 결제 승인에 실패했습니다.',
      });
    }

    return res.status(200).json({
      ok: true,
      aid: data.aid,
      tid: data.tid,
      item_name: data.item_name,
      total_amount: data.amount ? data.amount.total : null,
      approved_at: data.approved_at,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      code: 'INTERNAL_ERROR',
      message: err && err.message ? err.message : '결제 승인 처리 중 오류가 발생했습니다.',
    });
  }
}
