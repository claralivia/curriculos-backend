const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  mensagem: { type: String, required: true },
  tipo: { type: String, enum: ['info', 'novidade', 'alerta'], default: 'novidade' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Announcement', AnnouncementSchema);
