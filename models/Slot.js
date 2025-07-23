const mongoose = require('mongoose');
const SlotSchema = new mongoose.Schema({
  date: String, // e.g., "2024-06-01" (legacy)
  time: String, // e.g., "15:00" (legacy)
  datetimeUtc: { type: Date, required: true }, // new UTC datetime
  available: { type: Boolean, default: true }
});
module.exports = mongoose.model('Slot', SlotSchema); 