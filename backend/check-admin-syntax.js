
try {
    const admin = require('./routes/admin');
    console.log('✅ routes/admin.js loaded successfully');
} catch (error) {
    console.error('❌ Syntax error in routes/admin.js:', error);
    process.exit(1);
}
