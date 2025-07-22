const mongoose = require('mongoose');
const BookingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  slot: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot' },
  motive: String,
  status: { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending' }
});
module.exports = mongoose.model('Booking', BookingSchema); 