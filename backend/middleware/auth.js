import jwt from "jsonwebtoken"

const authMiddleware = async (req,res,next)=>{
    const { token } = req.headers;
    if(!token){
        return res.status(401).json({ success:false, message: "Unauthorized: No token provided" });
    }
    try {
        const token_decode = jwt.verify(token,process.env.JWT_SECRET);
        req.body = req.body || {};  // // ensure req.body is defined
        req.body.userId= token_decode.id; // to get user id from token and store in req.body for further use
        next();
    } catch (error) {
        console.log("Error in authMiddleware:", error);
        res.json({ success:false, message: "Unauthorized: Invalid token" });
    }
}

export default authMiddleware;