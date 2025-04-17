const { Sequelize, DataTypes } = require('sequelize');

// Use the DATABASE_URL environment variable
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  logging: false,  // Optional: disable logging for production
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false, // Disables SSL certificate validation (required for Heroku)
    },
  },
});

const User = sequelize.define('User', {
  discord_id: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  stripe_customer_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  subscription_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  subscription_status: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

// Sync the models with the database
sequelize.sync()
  .then(() => console.log('Database synced'))
  .catch((err) => console.error('Error syncing database:', err));

module.exports = { sequelize, User };
