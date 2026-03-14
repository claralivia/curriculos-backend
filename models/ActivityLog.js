const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    actorNome: {
      type: String,
      default: ''
    },
    actorEmail: {
      type: String,
      default: ''
    },
    actorRole: {
      type: String,
      default: ''
    },
    action: {
      type: String,
      required: true,
      index: true
    },
    resourceType: {
      type: String,
      enum: ['auth', 'cv', 'user', 'backup', 'system'],
      default: 'system'
    },
    resourceId: {
      type: String,
      default: ''
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ip: {
      type: String,
      default: ''
    },
    userAgent: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
