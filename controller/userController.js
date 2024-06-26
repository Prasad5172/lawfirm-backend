const bcryptjs = require("bcryptjs")
const { userService } = require("../service")
const { responseHandler, asyncHandler, getJwtToken } = require('../helpers');
const { userRepository } = require("../repository")
const { emailService } = require("../service");
const jwt = require("jsonwebtoken")
const googleAuth = require("./googleAuthController")

const User = (user) => ({
    first_name: user.first_name,
    email: user.email,
    password: user.password,
});


exports.register = asyncHandler(async (req, res) => {
    console.log("register route in controller")
    const authHeader = req.headers.authorization;
    console.log(authHeader);
    let token = null
    if (authHeader) {
        token = authHeader.split(" ")[1];
    }
    if (token != null) {
        var googleUserData = null;
        await googleAuth.googleAuthApi(token, (err, data) => {
            if (err) {
                return res.status(err.code).json(err);
            }
            console.log("data", data)
            googleUserData = data.data
        });
        // return googleUserData;
        console.log(googleUserData)
        const { email, name, picture, email_verified } = googleUserData;
        if (!email_verified) {
            return res.status(400).json("email is not verified by google");
        }
        let user = await userRepository.retrieveOne({ email: email })
        console.log(user)
        if (user == null) {
            user = await userRepository.create({ email: email, first_name: name, image_url: picture, is_google_linked: true });
        } else {
            user.is_google_linked = true;
            user.image_url=picture;
            await user.save();
        }
        return res.status(200).json(responseHandler(true, 200, "succesful", null))
    }

    try {
        var checkUser = await userRepository.retrieveOne({ email: req.body.email })
        if (checkUser && checkUser.is_verified) {
            return res.status(400).json(responseHandler(false, 400, "notValidMail", null))
        } else if (!checkUser) {
            // console.log(checkUser)
            // console.log("check user is null")
            checkUser = await userService.register(req.body);
        } else {
            // console.log("before",checkUser)
            checkUser.password = await bcryptjs.hash(req.body.password, 10);
            checkUser.save()
            // console.log("after",checkUser)
        }
        // console.log("checkUser",checkUser)
        await emailService.sendOtpToEmail(req.body, checkUser.user_id, (err, data) => {
            if (err) {
                return res.status(err.code).json(err);
            }
            return res.status(200).json(data)
        })
    } catch (error) {
        console.log(error);
        return res
            .status(500)
            .json(responseHandler(false, 500, 'Server Error', null));
    }
})

exports.login = async (req, res, next) => {
    console.log("login")
    console.log(req.body)
    try {
        const { email, password } = req.body;
        console.log(email)
        console.log(password)
        const user = await userRepository.retrieveOne({ email: email })
        const payload = {
            user: {
                id: user.user_id
            }
        }
        console.log(user)
        if (user && user.is_google_linked) {
            return getJwtToken(payload, "succesful",3600, (err, data) => {
                if (err) {
                    return res.status(err.code).json(responseHandler(false, err.code, err.message, null));
                }
                return res.status(200).json({ ...data, name: user.first_name, email: user.email })
            });
        }
        if (user == null || user && !user.is_verified) {
            return res.status(400).json(responseHandler(false,400,"signup",null));
        }
        if( user.password && !password && email){      // if user registred with email,password and  not registred with google and try to login with google
            return res.status(400).json(responseHandler(false,400,"signup",null))
        }
        const isMatch = await bcryptjs.compare(password, user.password)
        console.log("isMatch", isMatch)
        if (isMatch) {
            return getJwtToken(payload, "succesful",3600, (err, data) => {
                if (err) {
                    return res.status(err.code).json(err);
                }
                return res.status(200).json({ ...data, name: user.first_name, email: user.email })
            })
        }
        return res.status(400).json(responseHandler(false, 400, "failed", null));
    } catch (error) {
        console.log(error + "insignin");
        return res.status(400).json(responseHandler(false, 500, error.message, null));
    }
}






exports.checkEmail = asyncHandler(async (req, res) => {
    const { email } = req.body
    let user = null;
    await userService.retrieveOneByEmail(email, (err, data) => {
        if (err) {
            return res.status(err.code).json(err);
        }
        user = data;
    })
    if (user) {
        res.status(200).json("successful")
    } else {
        res.status(400).json("notsuccessful")
    }
}
)



exports.resetPassword = asyncHandler(async (req, res,next) => {
    try {
        const { email, password } = req.body;
        const passwordHash = await bcryptjs.hash(password, 10);
        let user = await userRepository.retrieveOne({ email: email });
        user.password = passwordHash;
        await user.save()
        return res.status(200).json("succesful");
    } catch (error) {
        console.log(error);
        res.status(400).json("failedtoupdate");
    }
}
)



exports.protected = async (req, res, next) => {
    console.log("protected")
    return res.status(200).send("awesome it works for protected route");
}

exports.retriveUser = async (req, res, next) => {
    const userId = req.user.user_id;
    const user = await userRepository.getProfile(userId);
    return res.status(200).json(responseHandler(false, 200, "success", user));
}


exports.verifyToken =async (req, res,next) => {
    try {
        const token = req.headers.authorization.substring(7)
        var id = null;
        jwt.verify(token, process.env.JWT_SECRET, (error, decoded) => {
            if (error) {
                return res
                    .status(400)
                    .json(responseHandler(false, 400, 'Try again', error));
            }
            id = decoded.user.user_id;
        });
        var user = await userRepository.getProfile( id )
        if(user){
            return res.status(200).json(responseHandler(true,200,"succesful",user));
        }
        return res.status(400).json(responseHandler(false,400,"token is not valid",null))
    } catch (error) {
        console.log(error);
        return res.status(400).json(responseHandler(false,500,error.message,null))
    }
}