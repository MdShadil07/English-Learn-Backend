const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/learn_english_db').then(async () => {
    const db = mongoose.connection.useDb('learn_english_db');
    await db.collection('users').updateOne({}, { $set: { verificationStatus: 'pending' } });
    console.log('Successfully added a mock pending request!');
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
