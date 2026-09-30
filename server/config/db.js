const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is not defined. Set it to your MongoDB Atlas or local MongoDB connection string.");
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log("MongoDB Connected: " + conn.connection.host);
    return conn;
  } catch (error) {
    console.error("Error connecting to MongoDB. Check MONGO_URI and MongoDB availability:", error.message);
    throw error;
  }
};

module.exports = connectDB;