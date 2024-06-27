const dotenv = require("dotenv")
dotenv.config()
const config = require('../config');
const { responseHandler } = require('./handler');
const JWT = require('jsonwebtoken');

exports.getJwtToken = (payload, logMessage,expireIn, result) => {
  JWT.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: `${expireIn}s`},
    (error, token) => {
      if (error) {
        console.log('error: ', error);
        return result(responseHandler(false, error.statusCode, error.message, null), null);
      }
      return result(null, responseHandler(true, 200, logMessage, { token }));
    },
  );
};


exports.isExpired =async (exp) => {
  const currentTime = Math.floor(Date.now() / 1000);
  if(currentTime < exp){
    return true;
  }
  return false;
  
}

