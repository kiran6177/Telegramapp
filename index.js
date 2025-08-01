require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const User = require('./models/User');
const Slot = require('./models/Slot');
const Booking = require('./models/Booking');
const isAdmin = require('./middleware/isAdmin');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/scheduler', { useNewUrlParser: true, useUnifiedTopology: true });

const bot = new TelegramBot(process.env.BOT_TOKEN); // Remove polling: true

// Helper to format slot datetimeUtc
function formatSlotDateTime(utcString) {
  if (!utcString) return '';
  const d = new Date(utcString);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata'
  }).replace(/, (\d{1,2}):([0-5][0-9]) (AM|PM)/, (m, h, min, ap) => `, ${h}${min !== '00' ? ':' + min : ''} ${ap}`);
}

// --- API ROUTES ---
app.get('/api/test', (req, res) => {
  res.send('Hello World');
});

// Whoami route to check if user is admin
app.post('/api/whoami', (req, res) => {
  const { telegramId } = req.body;
  if (telegramId && telegramId.toString() === process.env.CEO_TELEGRAM_ID) {
    return res.json({ role: 'admin' });
  }
  return res.json({ role: 'user' });
});

// Get available slots (public)
app.get('/api/slots', async (req, res) => {
  const slots = await Slot.find({ datetimeUtc: { $gte: new Date() }, available: true });
  res.json(slots);
});

// Admin: Add slot (protected)
app.post('/api/slots', isAdmin, async (req, res) => {
  const { datetimeUtc } = req.body;
  if (!datetimeUtc) {
    return res.status(400).json({ error: 'datetimeUtc is required' });
  }
  const slot = new Slot({ datetimeUtc: new Date(datetimeUtc) });
  await slot.save();
  res.json(slot);
});

// Book a slot (public)
app.post('/api/bookings', async (req, res) => {
  const { telegramId, name, email, phone, motive, slotId } = req.body;
  let user = await User.findOne({ telegramId });
  if (!user) {
    user = new User({ telegramId, name, email, phone, motive });
    await user.save();
  }
  const booking = new Booking({ user: user._id, slot: slotId, motive });
  await booking.save();
  await Slot.findByIdAndUpdate(slotId, { available: false });
  bot.sendMessage(process.env.CEO_TELEGRAM_ID, `New booking request from ${name} for ${booking.motive}. Approve?`, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Approve", callback_data: `approve_${booking._id}` },
          { text: "Decline", callback_data: `decline_${booking._id}` }
        ]
      ]
    }
  });
  res.json({ success: true });
});

// Admin: Get all bookings (protected)
app.get('/api/bookings', isAdmin, async (req, res) => {
  const bookings = await Booking.find().populate('user').populate('slot');
  res.json(bookings.filter(booking => booking.slot.datetimeUtc > new Date()));
});

bot.on('message', (msg) => {
  console.log('User ID:', msg.from.id);
  // Optionally, reply to the user with their ID:
  bot.sendMessage(msg.chat.id, `Welcome to Value at Void`);
});

// Add this after bot initialization
bot.onText(/\/start/, (msg) => {
  const isCeo = msg.from.id && msg.from.id.toString() === process.env.CEO_TELEGRAM_ID;
  const buttonText = isCeo ? 'Explore Appointments' : 'Book a Call';
  const welcomeText = isCeo
    ? 'Welcome San! Use the button below to explore all appointments.'
    : 'Welcome! Click below to book a call.';
  bot.sendMessage(msg.chat.id, welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: buttonText,
            web_app: { url: process.env.FRONTEND_URL }
          }
        ]
      ]
    }
  });
});

// Approve/Decline booking (from Telegram bot)
bot.on('callback_query', async (query) => {
  const [action, bookingId] = query.data.split('_');
  const booking = await Booking.findById(bookingId).populate('user').populate('slot');
  if (!booking) return;

  if (action === 'approve') {
    booking.status = 'approved';
    await booking.save();
    bot.sendMessage(booking.user.telegramId, `Your appointment with Value at Void for ${formatSlotDateTime(booking.slot.datetimeUtc)} is approved!`);
    // Edit the original message to show it's approved
    bot.editMessageText(
      `Booking for ${booking.user.name} (${formatSlotDateTime(booking.slot.datetimeUtc)}) has been approved.`,
      {
        chat_id: query.message.chat.id, 
        message_id: query.message.message_id,
      }
    );
  } else if (action === 'decline') {
    booking.status = 'declined';
    await booking.save();
    bot.sendMessage(booking.user.telegramId, `Sorry, your booking with Value at Void for ${formatSlotDateTime(booking.slot.datetimeUtc)} was declined.`);
    await Slot.findByIdAndUpdate(booking.slot._id, { available: true });
    // Edit the original message to show it's declined
    bot.editMessageText(
      `Booking for ${booking.user.name} (${formatSlotDateTime(booking.slot.datetimeUtc)}) has been declined.`,
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
      }
    );
  }
  bot.answerCallbackQuery(query.id, { text: `Booking ${action}d.` });
});

// Webhook endpoint for Telegram
app.post('/api/bot', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Backend running on port ${PORT}`);
  // Automatically set Telegram webhook on server startup
  const url = `${process.env.BACKEND_URL}/api/bot`;
  try {
    await bot.setWebHook(url);
    console.log(`Telegram webhook set to ${url}`);
  } catch (err) {
    console.error('Failed to set Telegram webhook:', err.message);
  }
});

// Helper endpoint to set webhook (call this once after deploy)
app.get('/set-webhook', async (req, res) => {
  const url = `${process.env.BACKEND_URL}/api/bot`;
  try {
    await bot.setWebHook(url);
    res.send(`Webhook set to ${url}`);
  } catch (err) {
    res.status(500).send('Failed to set webhook: ' + err.message);
  }
}); 