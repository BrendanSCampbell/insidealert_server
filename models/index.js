const { DataTypes } = require('sequelize');
const sequelize = require('../sequelize');  // adjust the path based on where sequelize.js is located

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

module.exports = User;
