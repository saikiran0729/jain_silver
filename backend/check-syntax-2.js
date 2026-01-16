
try {
    require('./routes/rates');
    console.log('✅ routes/rates.js loaded successfully');
} catch (error) {
    console.error('❌ Error loading routes/rates.js:', error);
}
