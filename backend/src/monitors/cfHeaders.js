function cfHeaders(config) {
  const h = {};
  if (config?.cfClientId)     h['CF-Access-Client-Id']     = config.cfClientId;
  if (config?.cfClientSecret) h['CF-Access-Client-Secret'] = config.cfClientSecret;
  return h;
}
module.exports = cfHeaders;
