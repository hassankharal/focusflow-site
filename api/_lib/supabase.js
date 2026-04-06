const DEFAULT_LIMIT = 25;

function getWaitlistLimit() {
  const raw = process.env.WAITLIST_FREE_YEAR_LIMIT;
  const parsed = Number.parseInt(raw || String(DEFAULT_LIMIT), 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LIMIT;
  }

  return parsed;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return {
    url,
    serviceRoleKey,
    configured: Boolean(url && serviceRoleKey)
  };
}

function createJsonResponse(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function parseRequestBody(req) {
  if (req.body == null) {
    return {};
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (error) {
      return null;
    }
  }

  if (typeof req.body === "object") {
    return req.body;
  }

  return null;
}

async function callSupabaseRpc(functionName, payload) {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const endpoint = `${url}/rest/v1/rpc/${functionName}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(payload || {})
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      (data && (data.message || data.error_description || data.details)) ||
        `Supabase RPC failed: ${functionName}`
    );
    error.details = data;
    throw error;
  }

  if (Array.isArray(data)) {
    return data[0] || null;
  }

  return data;
}

function clampSpots(value, limit) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return limit;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed > limit) {
    return limit;
  }
  return parsed;
}

module.exports = {
  clampSpots,
  createJsonResponse,
  callSupabaseRpc,
  getSupabaseConfig,
  getWaitlistLimit,
  parseRequestBody
};
