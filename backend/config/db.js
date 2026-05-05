import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
// UPDATE: Add the ssl object to the Pool configuration
const pool = new Pool({ 
  connectionString,
  ssl: {
    rejectUnauthorized: false, // This tells pg to trust the Supabase certificate
  }
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter: adapter, 
});

export default prisma;

export const connectDB = async () => {
    try {
        await prisma.$connect();
        console.log("✅ Database Connected Successfully");
    } catch (error) {
        console.error("❌ Database Connection Failed:");
        console.error(error);
        process.exit(1);
    }
};