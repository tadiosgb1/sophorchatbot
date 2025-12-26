module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("User", {
    telegram_id: {
      type: DataTypes.BIGINT,
   // <- Make primary key
      allowNull: false
    },
    username: DataTypes.STRING,
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING
  });

  // User.associate = models => {
  //   User.hasMany(models.Message, {
  //     foreignKey: "telegram_id",
  //     sourceKey: "telegram_id"
  //   });
  // };

  return User;
};
