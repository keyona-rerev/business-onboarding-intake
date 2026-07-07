const jwt = require("jsonwebtoken");

const SECRET = process.env.INTAKE_JWT_SECRET;

function signSession(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "24h" });
}

function verifySession(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (e) {
    return null;
  }
}

function getCookie(event, name) {
  const header = event.headers.cookie || event.headers.Cookie || "";
  const match = header.split(";").map((c) => c.trim()).find((c) => c.startsWith(name + "="));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function sessionFromEvent(event) {
  const token = getCookie(event, "intake_session");
  if (!token) return null;
  return verifySession(token);
}

module.exports = { signSession, verifySession, getCookie, sessionFromEvent };
