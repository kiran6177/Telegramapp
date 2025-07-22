const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
  telegramId: String,
  name: String,
  email: String,
  phone: String,
  motive: String,
  isAdmin: { type: Boolean, default: false }
});
module.exports = mongoose.model('User', UserSchema); 