const dotenv = require("dotenv");
dotenv.config();
const bcryptjs = require("bcryptjs");
const {UserModel,OtpModel} = require("../model");
const { responseHandler, asyncHandler, getJwtToken } = require('../helpers');


exports.verifyOtp = async (req,res,next) => {
    console.log("verifyOtp");
    const {email,otp} = req.body;
    // let user = await userRepository.retrieveOne({email:email})
    let user = await UserModel.findOne({
        where:{email:email},
        attributes:["user_id","email"],
        include:[
            {
                model:OtpModel,
                attributes:["user_id","sms","expires_in"],
                as:'otp'
            }
        ]
    });
    if (!user || !user.otp) {
        return res.status(400).json("Invalid email or OTP");
    }
    // console.log(user.otp);
    const otpInDb = user.otp.sms;
    const curDate = new Date().getTime();
    const expiresIn = user.otp.expires_in;
    console.log(expiresIn);
    console.log(new Date());
    // Check if OTP has expired
    console.log()
    if ( curDate > expiresIn ) {
        return res.status(400).json({cur:new Date(),old:new Date(expiresIn)})
        return res.status(400).json("OTP has expired");
    }
    if (!otpInDb ) { return res.status(400).json("expired")}
    const validUser = await bcryptjs.compare(otp, otpInDb);
    if ( validUser ){
        user.is_verified = true;
        user.save()
        const payload = {
            user: {
                id: user.user_id,
                email: user.email,
                isAdmin
            }
        }
        return getJwtToken(payload, "succesful",600, (err, data) => {
            if (err) {
                return res.status(err.code).json(err);
            }
            return res.status(200).json({ ...data, name: user.first_name, email: user.email })
        })
    }
    else {
        return res.status(400).json(responseHandler(false,400,"wrongOtp",null))
    }
}
