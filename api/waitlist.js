const {
  clampSpots,
  createJsonResponse,
  callSupabaseRpc,
  getSupabaseConfig,
  getWaitlistLimit,
  parseRequestBody
} = require("./_lib/supabase");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function parseErrorMessage(error) {
  const message = String((error && error.message) || "");

  if (message.includes("INVALID_EMAIL")) {
    return "Enter a valid email address.";
  }

  if (message.includes("BOT_FIELD_FILLED")) {
    return "Request accepted.";
  }

  return "Could not submit waitlist signup right now.";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return createJsonResponse(res, 405, {
      success: false,
      message: "Method not allowed"
    });
  }

  const body = parseRequestBody(req);

  if (!body || typeof body !== "object") {
    return createJsonResponse(res, 400, {
      success: false,
      message: "Invalid request body"
    });
  }

  const limit = getWaitlistLimit();
  const { configured } = getSupabaseConfig();

  const email = normalizeEmail(body.email);
  const name = String(body.name || "").trim();
  const honeypot = String(body.company || "").trim();
  const source = String(body.source || "focusflow-landing").trim();
  const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};

  if (honeypot) {
    return createJsonResponse(res, 200, {
      success: true,
      duplicate: false,
      qualified_for_free_year: false,
      spots_remaining: limit,
      rank: null,
      message: "Thanks for joining the waitlist."
    });
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    return createJsonResponse(res, 400, {
      success: false,
      duplicate: false,
      qualified_for_free_year: false,
      spots_remaining: limit,
      rank: null,
      message: "Enter a valid email address."
    });
  }

  if (!configured) {
    return createJsonResponse(res, 500, {
      success: false,
      duplicate: false,
      qualified_for_free_year: false,
      spots_remaining: limit,
      rank: null,
      message: "Waitlist backend is not configured."
    });
  }

  try {
    const result = await callSupabaseRpc("signup_waitlist", {
      p_email: email,
      p_name: name || null,
      p_source: source || "focusflow-landing",
      p_metadata: metadata,
      p_honeypot: null,
      p_limit: limit
    });

    const success = Boolean(result && result.success);
    const duplicate = Boolean(result && result.duplicate);
    const qualifiedForFreeYear = Boolean(result && result.qualified_for_free_year);
    const spotsRemaining = clampSpots(result && result.spots_remaining, limit);

    const rankRaw = Number.parseInt(result && result.rank, 10);
    const rank = Number.isFinite(rankRaw) ? rankRaw : null;

    return createJsonResponse(res, 200, {
      success,
      duplicate,
      qualified_for_free_year: qualifiedForFreeYear,
      spots_remaining: spotsRemaining,
      rank,
      message: (result && result.message) || "Waitlist updated."
    });
  } catch (error) {
    console.error("waitlist submit error", error);

    const message = parseErrorMessage(error);
    const isValidation = message === "Enter a valid email address.";
    const isBot = message === "Request accepted.";

    if (isBot) {
      return createJsonResponse(res, 200, {
        success: true,
        duplicate: false,
        qualified_for_free_year: false,
        spots_remaining: limit,
        rank: null,
        message: "Thanks for joining the waitlist."
      });
    }

    return createJsonResponse(res, isValidation ? 400 : 500, {
      success: false,
      duplicate: false,
      qualified_for_free_year: false,
      spots_remaining: limit,
      rank: null,
      message
    });
  }
};
