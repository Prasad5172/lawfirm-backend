var express = require("express");
const cors = require("cors");
const app = express();
const dotenv = require('dotenv');
dotenv.config();
const path = require('path');
const dayjs = require("dayjs")
const fs = require("fs");
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');
const { v4: uuid } = require('uuid');
const stripe = require('stripe')(`${process.env.STRIPE_SECRET_KEY}`);
const bodyParser = require("body-parser");
const { userRepository } = require("./repository/index.js");

// Configure CORS to allow requests from http://localhost:3000
const corsOptions = {
  origin: 'http://localhost:3000',
};
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  console.log("webhook")
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    // Handle successful payment here and create calendar event
    const appointmentData = paymentIntent.metadata;

    const auth = await authorize();
    const eventData = {
      summary: appointmentData.summary,
      description: appointmentData.description,
      start: { dateTime: appointmentData.start, timeZone: 'Asia/Kolkata' },
      end: { dateTime: appointmentData.end, timeZone: 'Asia/Kolkata' },
      attendees: [{ email: appointmentData.attendeeEmail }],
    };

    const calendarEvent = await addEvent(auth, eventData);
    console.log('Calendar Event Created:', calendarEvent);
  }

  res.status(200).json({ received: true });
});


app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/", require("./routes/index.js"));

const SCOPES = ['https://www.googleapis.com/auth/calendar'];

const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function loadSavedCredentialsIfExist() {
  try {
    const content = fs.readFileSync(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

async function saveCredentials(client) {
  const content = fs.readFileSync(CREDENTIALS_PATH);
  const keys = JSON.parse(content);
  const key = keys.installed || keys.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
   fs.writeFileSync(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) {
    return client;
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
  if (client.credentials) {
    await saveCredentials(client);
  }
  return client;
}

async function addEvent(auth, eventData) {
  const calendar = google.calendar({ version: 'v3', auth });
  const response = await calendar.events.insert({
    calendarId: "primary",
    conferenceDataVersion: 1,
    requestBody: {
      summary: eventData.summary,
      description: eventData.description,
      start: {
        dateTime: dayjs(eventData.start).toISOString(),
        timeZone: "Asia/Kolkata"
      },
      end: {
        dateTime: dayjs(eventData.end).toISOString(),
        timeZone:  "Asia/Kolkata"
      },
      conferenceData: {
        createRequest: {
          requestId: uuid(),
        },
      },
      attendees: eventData.attendees
    }
  });
  return response.data; // Return the event details including the event ID
}


async function updateEvent(auth, eventId, eventData) {
  const calendar = google.calendar({ version: 'v3', auth });
  const response = await calendar.events.update({
    calendarId: "primary",
    eventId: eventId,
    requestBody: {
      summary: eventData.summary,
      description: eventData.description,
      start: {
        dateTime: dayjs(new Date()).toISOString(),
        timeZone: eventData.timeZone || "Asia/Kolkata"
      },
      end: {
        dateTime: dayjs(eventData.end).toISOString(),
        timeZone: eventData.timeZone || "Asia/Kolkata"
      },
      attendees: eventData.attendees
    }
  });
  return response.data; // Return the updated event details
}

async function deleteEvent(auth, eventId) {
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
  });
}

async function listEvents(auth) {
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = res.data.items;
  return events;
}


app.post("/event", async (req, res) => {
  try {
    const auth = await authorize();
    console.log(auth)
    const event = await addEvent(auth, req.body);
    console.log(event);
    res.send({
      msg: "Event created successfully",
      eventId: event.id // Send back the event ID
    });
  } catch (error) {
    console.error("Error creating event", error);
    res.status(500).send("Error creating event");
  }
});

app.put("/event/:eventId", async (req, res) => {
  try {
    const auth = await authorize();
    const eventId = req.params.eventId;
    const event = await updateEvent(auth, eventId, req.body);
    console.log(event);
    res.send({
      msg: "Event updated successfully",
      eventId: event.id // Send back the updated event ID
    });
  } catch (error) {
    console.error("Error updating event", error);
    res.status(500).send("Error updating event");
  }
});

app.delete("/event/:eventId", async (req, res) => {
  try {
    const auth = await authorize();
    await deleteEvent(auth, req.params.eventId);
    res.send({ msg: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event", error);
    res.status(500).send("Error deleting event");
  }
});

app.get("/events", async (req, res) => {
  try {
    const auth = await authorize();
    const events = await listEvents(auth);
    res.send(events);
  } catch (error) {
    console.error("Error listing events", error);
    res.status(500).send("Error listing events");
  }
});



app.post("/create-payment-intent", async (req, res) => {
  console.log("create-payment-intent")
  const { items } = req.body;

  // Create a PaymentIntent with the order amount and currency
  const paymentIntent = await stripe.paymentIntents.create({
    amount: 1000,
    currency: "usd",
    
  });
  console.log(paymentIntent.client_secret)
  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});

app.post('/api/bookevent', async (req, res) => {
  const { name, email, phone, problem, date, slot } = req.body;

  // Create payment intent with appointment details as metadata
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 1000, // Amount in cents
      currency: 'usd',
      metadata: {
        summary: `Appointment with ${name}`,
        description: problem,
        start: new Date(date + 'T' + slot).toISOString(),
        end: new Date(date + 'T' + slot).toISOString(), // Example duration
        attendeeEmail: email,
      },
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});


app.get("/users",async (req,res) => {
  await userRepository.retrieveAll((err,data) => {
   if (err) {
     return res.status(err.code).json(responseHandler(false, err.code, err.message, null));
 }
   return res.status(200).json( data)
  });
 
})

app.listen(8000, () => {
  console.log("Server listening on port 8000");
});
