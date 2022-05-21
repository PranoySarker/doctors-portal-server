const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;
require('dotenv').config();

app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.e8rrf.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyjwt(req, res, next) {
    console.log('abc');
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAthorized access' })
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' });
        }
        console.log(decoded); // bar
        req.decoded = decoded;
        next();
    });
}

async function run() {
    await client.connect();
    const serviceCollection = client.db("doctors_portal").collection("services");
    const bookingCollection = client.db("doctors_portal").collection("bookings");
    const userCollection = client.db("doctors_portal").collection("users");
    const doctorCollection = client.db("doctors_portal").collection("doctors");

    const verifyAdmin = async (req, res, next) => {
        const requester = req.decoded.email;
        const requesterAccount = await userCollection.findOne({ email: requester })
        if (requesterAccount.role === 'admin') {
            next();
        }
        else {
            res.status(403).send({ message: 'forbidden access' })
        }
    }

    app.get('/service', async (req, res) => {
        const query = {};
        const cursor = serviceCollection.find(query).project({ name: 1 });
        const result = await cursor.toArray();
        res.send(result);
    })

    app.get('/user', verifyjwt, async (req, res) => {
        const users = await userCollection.find().toArray();
        res.send(users);
    });

    app.get('/admin/:email', async (req, res) => {
        const email = req.params.email;
        const user = await userCollection.findOne({ email: email });
        const isAdmin = user.role === 'admin';
        res.send({ admin: isAdmin });
    })

    app.put('/user/admin/:email', verifyjwt, async (req, res) => {
        const email = req.params.email;
        const requester = req.decoded.email;
        const requesterAccount = await userCollection.findOne({ email: requester })
        if (requesterAccount.role === 'admin') {
            const filter = { email: email };
            const updateDoc = {
                $set: { role: 'admin' },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result);
        }
        else {
            res.status(403).send({ message: 'forbidden access' })
        }

    })

    app.put('/user/:email', async (req, res) => {
        const email = req.params.email;
        const user = req.body;
        const filter = { email: email };
        const options = { upsert: true };
        const updateDoc = {
            $set: user,
        };
        const result = await userCollection.updateOne(filter, updateDoc, options);
        const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET);
        res.send({ result, token });
    })

    app.get('/available', async (req, res) => {
        const date = req.query.date || 'May 11, 2022';

        //step-1: get all services
        const services = await serviceCollection.find().toArray();

        //step-2: get the booking of that day
        const query = { date: date };
        const bookings = await bookingCollection.find(query).toArray();

        //step-3: for each service find booking for that service
        services.forEach(service => {
            const serviceBookings = bookings.filter(booking => booking.treatment === service.name);
            const bookedSlots = serviceBookings.map(booking => booking.slot);
            const available = service.slots.filter(slot => !bookedSlots.includes(slot));
            service.slots = available;
        })
        res.send(services);
    })

    app.get('/booking', verifyjwt, async (req, res) => {
        const patient = req.query.patient;
        const decodedEmail = req.decoded.email;
        if (patient === decodedEmail) {
            const query = { patient: patient };
            const bookings = await bookingCollection.find(query).toArray();
            return res.send(bookings);
        }
        else {
            return res.status(403).send({ message: 'forbidden access' })
        }

    })

    app.post('/booking', async (req, res) => {
        const data = req.body;

        const query = {
            treatment: data.treatment,
            date: data.date,
            patient: data.patient
        }
        const exists = await bookingCollection.findOne(query);
        if (exists) {
            return res.send({ success: false, booking: exists })
        }

        const result = await bookingCollection.insertOne(data);
        return res.send({ success: true, result });
    })

    app.get('/doctor', verifyjwt, async (req, res) => {
        const doctors = await doctorCollection.find().toArray();
        res.send(doctors);
    })

    app.post('/doctor', verifyjwt, verifyAdmin, async (req, res) => {
        const doctor = req.body;
        const result = await doctorCollection.insertOne(doctor);
        res.send(result);
    })

    app.delete('/doctor/:email', verifyjwt, async (req, res) => {
        const email = req.params.email;
        const filter = { email: email }
        const result = await doctorCollection.deleteOne(filter);
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