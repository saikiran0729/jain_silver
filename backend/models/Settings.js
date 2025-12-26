const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    enum: ['showAsItIs', 'baseSilverPrice']
  },
  value: {
    type: mongoose.Schema.Types.Mixed, // Allow both Boolean and Number
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists per key
settingsSchema.statics.getSetting = async function(key) {
  let setting = await this.findOne({ key });
  if (!setting) {
    setting = new this({ key, value: false });
    await setting.save();
  }
  return setting;
};

settingsSchema.statics.setSetting = async function(key, value, updatedBy = null) {
  const setting = await this.findOneAndUpdate(
    { key },
    { 
      value,
      lastUpdated: new Date(),
      updatedBy
    },
    { upsert: true, new: true }
  );
  return setting;
};

// Export model, handling case where it might already be registered
let Settings;
try {
  Settings = mongoose.model('Settings', settingsSchema);
} catch (error) {
  // Model already registered, use existing
  Settings = mongoose.model('Settings');
}

module.exports = Settings;

