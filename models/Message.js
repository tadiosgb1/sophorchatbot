module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define("Message", {
    telegram_id: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    message: DataTypes.TEXT,
    direction: {
      type: DataTypes.ENUM("in", "out"),
      allowNull: false
    }
  });

//   Message.associate = models => {
//     Message.belongsTo(models.User, {
//       foreignKey: "telegram_id",
//       targetKey: "telegram_id"
//     });
//   };

  return Message;
};
