const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { sequelize, User } = require('./models'); // Import sequelize and User model
const app = express();

app.use(bodyParser.raw({ type: 'application/json' }));

sequelize.sync()
  .then(() => {
    console.log('Database synced');
  })
  .catch((err) => {
    console.error('Error syncing database:', err);
  });


// Redirect root URL to /login
app.get('/', (req, res) => {
  res.redirect('/login');
});

// Redirect user to Discord OAuth
app.get('/login', (req, res) => {
  const redirectUri = encodeURIComponent('https://insidealert-backendserver-9ef87c4b222a.herokuapp.com/callback');
  const clientId = process.env.DISCORD_CLIENT_ID;
  const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify`;
  res.redirect(oauthUrl);
});

// Handle Discord OAuth callback
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  try {
    const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: 'https://insidealert-backendserver-9ef87c4b222a.herokuapp.com/callback',
      scope: 'identify',
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token } = tokenResponse.data;

    const userResponse = await axios.get('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const discordUser = userResponse.data;

    // Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: 'https://insidealert-backendserver-9ef87c4b222a.herokuapp.com/success',
      cancel_url: 'https://insidealert-backendserver-9ef87c4b222a.herokuapp.com/cancel',
      metadata: {
        discord_id: discordUser.id,
      },
    });

    res.redirect(session.url);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error during Discord OAuth');
  }
});

// Success and Cancel routes
app.get('/success', (req, res) => {
  res.send('Payment successful! You can close this page.');
});

app.get('/cancel', (req, res) => {
  res.send('Payment failed. Please try again.');
});

// Stripe webhook
app.post('/webhook', bodyParser.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
  const session = event.data.object;
  const discordId = session.metadata.discord_id;
  const customerId = session.customer;
  const subscriptionId = session.subscription;
  console.log(`Subscription complete for Discord user: ${discordId}`);

  // Find the user by Discord ID and either create or update
  User.findOne({ where: { discord_id: discordId } })
    .then(async (user) => {
      if (!user) {
        // User doesn't exist, create a new one
        await User.create({
          discord_id: discordId,
          stripe_customer_id: customerId,
          subscription_id: subscriptionId,
          subscription_status: 'active',
        });
        console.log(`Created new subscription for Discord user: ${discordId}`);
      } else {
        // User exists, update their details
        await user.update({
          stripe_customer_id: customerId,
          subscription_id: subscriptionId,
          subscription_status: 'active',
        });
        console.log(`Updated subscription for Discord user: ${discordId}`);
      }
    })
    .catch((err) => {
      console.error('DB error:', err);
    });
}

res.status(200).send();
});


app.get('/users', async (req, res) => {
  const { User } = require('./models');
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (err) {
    console.error('Failed to fetch users:', err);
    res.status(500).send('Error fetching users');
  }
});

const cancelSubscription = async (userId) => {
  try {
    // Retrieve the user from the database
    const user = await User.findOne({ where: { id: userId } });
    
    if (!user || !user.subscription_id) {
      console.log('No subscription found for user');
      return;
    }

    // Cancel the Stripe subscription
    const subscription = await stripe.subscriptions.del(user.subscription_id);
    
    // Update the user's subscription status in the database
    await user.update({ subscription_status: 'cancelled' });

    console.log(`Cancelled subscription for user: ${user.discord_id}`);
    return subscription;
  } catch (err) {
    console.error('Error canceling subscription:', err);
  }
};

app.post('/cancel-subscription', express.json(), async (req, res) => {
  console.log('Request body:', req.body);
  const { discord_id } = req.body; // Discord ID passed in the request body
  
  try {
    const user = await User.findOne({ where: { discord_id } });

    if (!user) {
      return res.status(404).send('User not found');
    }

    // Cancel the subscription
    const cancelledSubscription = await cancelSubscription(user.id);
    
    if (cancelledSubscription) {
      res.send('Subscription cancelled successfully');
    } else {
      res.status(500).send('Error cancelling subscription');
    }
  } catch (err) {
    console.error('Error handling cancel subscription:', err);
    res.status(500).send('Internal server error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
