const {
  clampSpots,
  createJsonResponse,
  callSupabaseRpc,
  getSupabaseConfig,
  getWaitlistLimit
} = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return createJsonResponse(res, 405, {
      success: false,
      message: "Method not allowed"
    });
  }

  const limit = getWaitlistLimit();
  const { configured } = getSupabaseConfig();

  if (!configured) {
    return createJsonResponse(res, 200, {
      success: true,
      configured: false,
      spots_claimed: 0,
      spots_remaining: limit,
      offer_fully_claimed: false,
      message: "Supabase configuration missing"
    });
  }

  try {
    const result = await callSupabaseRpc("waitlist_offer_status", {
      p_limit: limit
    });

    const claimed = Number.parseInt(result && result.claimed_count, 10);
    const safeClaimed = Number.isFinite(claimed) ? Math.max(0, claimed) : 0;
    const safeRemaining = clampSpots(result && result.spots_remaining, limit);

    return createJsonResponse(res, 200, {
      success: true,
      configured: true,
      spots_claimed: safeClaimed,
      spots_remaining: safeRemaining,
      offer_fully_claimed: safeRemaining <= 0
    });
  } catch (error) {
    console.error("waitlist-status error", error);

    return createJsonResponse(res, 500, {
      success: false,
      message: "Could not load waitlist status"
    });
  }
};
