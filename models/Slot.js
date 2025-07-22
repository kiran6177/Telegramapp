const mongoose = require('mongoose');
const SlotSchema = new mongoose.Schema({
  date: String, // e.g., "2024-06-01"
  time: String, // e.g., "15:00"
  available: { type: Boolean, default: true }
});
module.exports = mongoose.model('Slot', SlotSchema); 