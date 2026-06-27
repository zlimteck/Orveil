const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const schema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  totp: {
    secret:      { type: String, default: null },
    enabled:     { type: Boolean, default: false },
    backupCodes: [{ type: String }],
  },
  passkeys: [{
    credentialID: { type: String, required: true },
    publicKey:    { type: String, required: true },
    counter:      { type: Number, default: 0 },
    deviceType:   { type: String, default: '' },
    name:         { type: String, default: 'Passkey' },
    createdAt:    { type: Date, default: Date.now },
  }],
}, { timestamps: true });

schema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

schema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', schema);
