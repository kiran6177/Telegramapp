module.exports = function (req, res, next) {
  // const userId = req.body.telegramId || req.query.telegramId;
  // if (userId && userId.toString() === process.env.CEO_TELEGRAM_ID) {
    return next();
  // }
  // return res.status(403).json({ error: "Forbidden: Admins only" });
}; 