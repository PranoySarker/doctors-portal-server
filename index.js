const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;
require('dotenv').config();

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.e8rrf.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    await client.connect();
    const serviceCollection = client.db("doctors_portal").collection("services");

    app.get('/service', async (req, res) => {
        const query = {};
        const cursor = serviceCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
    })

    console.log('connected to database');
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello Doctor Uncle!!')
})

app.listen(port, () => {
    console.log(`Doctor Uncle listening on port ${port}`)
})