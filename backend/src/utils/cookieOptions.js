const isHttps = (process.env.FRONTEND_URL || '').startsWith('https://');

const cookieOptions = {
  httpOnly: true,
  secure: isHttps,
  sameSite: isHttps ? 'strict' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const clearCookieOptions = {
  httpOnly: true,
  secure: isHttps,
  sameSite: isHttps ? 'strict' : 'lax',
};

module.exports = { cookieOptions, clearCookieOptions };
