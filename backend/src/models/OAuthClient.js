const mongoose = require('mongoose');

// RFC 7591 dynamically registered OAuth client.
const oauthClientSchema = new mongoose.Schema({
  client_id:                 { type: String, required: true, unique: true },
  client_id_issued_at:       { type: Number, required: true },
  client_secret:             { type: String, default: null },
  client_secret_expires_at:  { type: Number, default: 0 },
  redirect_uris:             { type: [String], required: true },
  token_endpoint_auth_method: { type: String, default: 'none' },
  grant_types:                { type: [String], default: ['authorization_code', 'refresh_token'] },
  response_types:             { type: [String], default: ['code'] },
  client_name:                { type: String, default: '' },
  client_uri:                 { type: String, default: '' },
  scope:                      { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('OAuthClient', oauthClientSchema);
