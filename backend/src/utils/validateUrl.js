function isSafeUrl(url) {
  if (!url) return true;
  try { return ['http:', 'https:'].includes(new URL(url).protocol); }
  catch { return false; }
}

module.exports = { isSafeUrl };
