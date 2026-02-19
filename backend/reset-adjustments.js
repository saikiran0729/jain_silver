require('dotenv').config();
const mongoose = require('mongoose');

async function resetAdjustments() {
    const uri = process.env.MONGODB_URI;

    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });

    const SilverRate = mongoose.model('SilverRate', new mongoose.Schema({}, { strict: false }), 'silverrates');

    const result = await SilverRate.updateMany(
        { location: 'Andhra Pradesh' },
        { $set: { manualAdjustment: 0, manualAdjustmentPercentage: 0 } }
    );

    const fs = require('fs');
    fs.writeFileSync('d:\\jain_silver\\reset_output.txt',
        `Modified: ${result.modifiedCount}, Matched: ${result.matchedCount}\n`
    );

    // Verify
    const rates = await SilverRate.find({ location: 'Andhra Pradesh' })
        .select('name manualAdjustment manualAdjustmentPercentage')
        .lean();

    let output = '';
    rates.forEach(r => {
        output += `${r.name}: adj=${r.manualAdjustment}, pct=${r.manualAdjustmentPercentage}\n`;
    });
    fs.appendFileSync('d:\\jain_silver\\reset_output.txt', output);

    await mongoose.disconnect();
    process.exit(0);
}

resetAdjustments().catch(e => {
    const fs = require('fs');
    fs.writeFileSync('d:\\jain_silver\\reset_output.txt', `Error: ${e.message}\n${e.stack}`);
    process.exit(1);
});
