import dotenv from 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';

//import Routers
import authRouter from './routes/authRoute.js';



//app config
const app = express();
const PORT = process.env.PORT || 5000;
connectDB();

//middleware
app.use(express.json()); // Parse JSON bodies from incoming requests
app.use(cors());   // acess backend from frontend


//api endpoints on the basis of routes
app.use("/api/auth", authRouter); // to access auth routes from frontend


//routes
app.get("/",(req,res)=>{
    res.send("Hello World!");
})



//listen the server
app.listen(PORT, ()=>{
    console.log(`Server is running on http://localhost:${PORT}`);
})