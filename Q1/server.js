require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
    console.log('Connected to MongoDB');
});

const numberSchema = new mongoose.Schema({
    value: Number,
    type: String,
    timestamp: { type: Date, default: Date.now }
});

const NumberModel = mongoose.model('Number', numberSchema);

app.get('/numbers/:numberid', async (req, res) => {
    const numberId = req.params.numberid;
    let apiUrl;

    switch (numberId) {
        case 'p':
            apiUrl = 'http://20.244.56.144/test/primes';
            break;
        case 'f':
            apiUrl = 'http://20.244.56.144/test/fibo';
            break;
        case 'e':
            apiUrl = 'http://20.244.56.144/test/even';
            break;
        case 'r':
            apiUrl = 'http://20.244.56.144/test/rand';
            break;
        default:
            return res.status(400).json({ error: 'Invalid number ID' });
    }

    try {
        const response = await axios.get(apiUrl, { timeout: 500 });
        const newNumbers = response.data.numbers.filter(num => num !== null && num !== undefined);

        const windowPrevState = await NumberModel.find().sort({ timestamp: 1 }).limit(10).exec();

        for (const num of newNumbers) {
            await NumberModel.updateOne({ value: num }, { value: num, type: numberId }, { upsert: true }).exec();
        }

        const allNumbers = await NumberModel.find().sort({ timestamp: 1 }).exec();
        if (allNumbers.length > 10) {
            const excessNumbers = allNumbers.slice(0, allNumbers.length - 10);
            for (const num of excessNumbers) {
                await NumberModel.deleteOne({ _id: num._id }).exec();
            }
        }

        const windowCurrState = await NumberModel.find().sort({ timestamp: 1 }).limit(10).exec();
        const average = windowCurrState.reduce((acc, curr) => acc + curr.value, 0) / windowCurrState.length;

        res.json({
            windowPrevState: windowPrevState.map(num => num.value),
            windowCurrState: windowCurrState.map(num => num.value),
            numbers: newNumbers,
            avg: parseFloat(average.toFixed(2))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch numbers from third-party server' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
