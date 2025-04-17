// User model example
module.exports = (sequelize, DataTypes) => {
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

  return User;
};
