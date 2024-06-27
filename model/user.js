const { Sequelize, DataTypes } = require('sequelize');
const db = require("../config/db")

const UserModel = db.define("user", {
    user_id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true,
    },
    first_name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            len: [3, 255],
        },
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true,
        },
    },
    isAdmin:{
        type:Sequelize.BOOLEAN,
        defaultValue:false,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue:null
    },
    image_url: {
        type: DataTypes.STRING,
    },
    is_verified: {
        type: Sequelize.BOOLEAN, // Assuming it's a boolean flag
        allowNull: false,
        defaultValue: false // Set a default value if needed
    },
    is_google_linked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    }

}, { timestamps: false });


module.exports = { UserModel }