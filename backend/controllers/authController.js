import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import validator from "validator";
import prisma from "../config/db.js";

//create token
const createToken = (id)=>{
    return jwt.sign({id}, process.env.JWT_SECRET, {expiresIn:"1d"})
}

//login user

const loginUser = async(req,res)=>{
    const {email,password} = req.body;
    try{
        const user = await prisma.user.findUnique({where:{email}});
        if(!user){
            return res.status(400).json({success:false, message:"User not found"})
        }
        const isMatch = await bcrypt.compare(password,user.password);
        if(!isMatch){
            return res.status(400).json({success:false, message:"Invalid credentials"})
        }
        //generate token
        const token = createToken(user.id);
        res.json({success:true,token});
    }
    catch(error){
        console.error("Error in loginUser:", error);
        return res.status(500).json({success:false, message:"Error occurred while logging in user"})
    }
}

//register user
const registerUser = async(req,res)=>{
    const {fullName,password,email} = req.body;
    try{
        //check if user already exists
        const exists = await prisma.user.findUnique({where:{email}});
        if(exists){
            return res.status(400).json({success:false, message:"User already exists"})
        }
        
        if(!validator.isEmail(email)){
            return res.status(400).json({success:false, message:"Invalid email"})
        }
        if(password.length<8){
            return res.status(400).json({success:false, message:"Password must be at least 8 characters long"})
        }
        //hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password,salt);
        //creating a user
        const newUser = await prisma.user.create({
            data: { fullName, email, password: hashedPassword }
        });
        
        //generate token
        const token = createToken(newUser.id);
        res.json({success:true,token});
    }
    catch(error){
        console.error("Error in registerUser:", error);
        return res.status(500).json({success:false, message:"Error occurred while registering user"})
    }

}

export {loginUser, registerUser}


/* MONGOOSE
import User from "../models/user.model.js";

// Finding a user
const user = await User.findOne({ email });
// Creating a user
const newUser = new User({ fullName, email, password });
await newUser.save();

PRISMA
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Finding a user
const user = await prisma.user.findUnique({ where: { email } });
// Creating a user
const newUser = await prisma.user.create({
  data: { fullName, email, password }
});*/