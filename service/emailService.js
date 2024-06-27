const dotenv = require("dotenv");
dotenv.config();
const otpGenerator = require("otp-generator");
var nodemailer = require("nodemailer");
const otpService = require("./otpService");
const { responseHandler } = require("../helpers");




exports.mailTransporter = async (isFormData,data,otp,result) => {
    console.log("mailTransporter")
    var transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.REACT_APP_USER,
            pass: process.env.REACT_APP_PASSWORD
        }
    });
    
    var mailOptions = {
        from: process.env.REACT_APP_USER,
        to: data.email,
        subject: isFormData ? "Contactform":"Verify Otp",
        text: isFormData ?  ` Email:${data.email} \n Phone:${data.phone} \n message:${data.message}`:` Verify OTP: ${otp}`,
    };
   transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log("error" ,error)
            return result(responseHandler(false,error.statusCode,error.message,null),null)
        }
        return result(null,responseHandler(true,200,"otpsend",null))
    });
    console.log("end of mailTransporter")
}


exports.sendOtpToEmail = async (data,userId,result) => {
        const otp = otpGenerator.generate(6, {
            digits: true,
            specialChars: false,
            lowerCaseAlphabets: false,
            upperCaseAlphabets: false,
            alphabets: false,
        });
        await otpService.create({email:data.email,sms: otp,user_id:userId});
        await this.mailTransporter(false,data, otp,result);
        console.log(otp)
        return otp;
};

exports.sendData = async (contactData,userId,result) => {
        await this.mailTransporter(true,contactData,0,result);
        console.log("end of sendData")
};
