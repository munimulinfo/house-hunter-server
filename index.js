const express = require("express");
const mongoose = require("mongoose");
const { ObjectId } = require("mongoose").Types;
const bodyParser = require("body-parser");
const jwt = require("jsonwebtoken");
const argon2 = require("argon2");
const cors = require("cors");
require("dotenv").config();
const { Schema } = mongoose;
const app = express();

// Middleware
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(bodyParser.json());

// MongoDB Connection
const { DATABASE_URL, PORT } = process.env;

// check Auth
const checkAuth = (...roles) => {
  return async (req, res, next) => {
    const token = req.headers.authorization;
    if (!token) {
      return res.status(401).json({ message: "you are not Authorized" });
    }

    try {
      const decoded = jwt.verify(token, "nissan-vai");
      if (roles.length && !roles.includes(decoded.role)) {
        return res
          .status(403)
          .json({ message: "Unauthorized. Insufficient role." });
      }
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
  };
};

async function connectToDatabase() {
  try {
    await mongoose.connect(DATABASE_URL);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

// Routes
app.get("/", async (req, res) => {
  res.send("This server is running");
});

app.get("/allUser", checkAuth("house-owner"), async (req, res) => {
  const result = await UserModel.find({});
  res.send(result);
});

app.post("/register", async (req, res) => {
  try {
    const { fullName, role, phone, email, password } = req.body;
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await argon2.hash(password);
    const newUser = {
      fullName,
      role,
      phone,
      email,
      password: hashedPassword,
    };

    const result = await UserModel.create(newUser);
    res.status(201).json({
      success: true,
      message: "User Created Successfully",
      data: result,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});
/// user login in database
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await UserModel.findOne({ email });

    if (!user || !(await argon2.verify(user.password, password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const userData = {
      userId: user._id,
      role: user.role,
      email: user.email,
      name: user?.fullName,
    };
    const token = jwt.sign(userData, "nissan-vai", {
      expiresIn: "1d",
    });

    res.status(200).json({ userData, token });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
});

//**********house Owner api **********************

//allhouse are get

app.get("/allOwnerHouse", async (req, res) => {
  const result = await HouseModel.find({});
  res.send(result);
});

///get house with owner id
app.get("/findIdByHOuse/:id", checkAuth("house-owner"), async (req, res) => {
  try {
    const id = req.params.id;
    const result = await HouseModel.find({ userId: new ObjectId(id) });
    res.status(201).json({
      data: result,
      message: "house retrived succesfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//delet house by house owner id
app.delete("/deletHouse/:id", checkAuth("house-owner"), async (req, res) => {
  try {
    const id = req.params.id;
    const result = await HouseModel.findByIdAndDelete(id);
    res.status(201).json({
      data: result,
      message: "house deletd succesfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

/// create HOuse only house-owner can  create
app.post("/postHouse", checkAuth("house-owner"), async (req, res) => {
  try {
    const houseData = req.body;
    const result = await HouseModel.create(houseData);
    res.status(201).json({
      data: result,
      message: "house save on data base successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
});

/// edit HOuse only house owner can edit house
app.put("/editHouse/:id", checkAuth("house-owner"), async (req, res) => {
  const id = req.params.id;
  console.log(id);
  const {
    name,
    address,
    city,
    bedrooms,
    bathrooms,
    roomSize,
    picture,
    availabilityDate,
    rentPerMonth,
    phoneNumber,
    description,
  } = req.body;

  const result = await HouseModel.findByIdAndUpdate(
    id,
    {
      name,
      address,
      city,
      bedrooms,
      bathrooms,
      roomSize,
      picture,
      availabilityDate,
      rentPerMonth,
      phoneNumber,
      description,
    },
    { new: true }
  );
  res.status(201).json({
    data: result,
    message: "house succesfully Updated",
  });
});

// *******************House Owner ALL Api ARE End********************//

//***************Star House Resnt Api*************************//

app.get(
  "/getBookedHousebyId/:id",
  checkAuth("house-owner"),
  async (req, res) => {
    const id = req.params.id;
    const result = await BookedHouseModel.find({
      "house.userId": new ObjectId(id),
    });
    res.status(201).json({
      data: result,
      message: "all booked house retrive succesfully",
    });
  }
);

app.get(
  "/getSingleBooked-house/:email",
  checkAuth("house-renter"),
  async (req, res) => {
    try {
      const email = req.params.email;
      console.log(email);
      const result = await BookedHouseModel.find({ email: email });
      res.status(201).json({
        data: result,
        message: "all booked house retrived successfull",
      });
    } catch (error) {
      res.status(500).json(error.message);
    }
  }
);

app.post("/bookedHouse", checkAuth("house-renter"), async (req, res) => {
  try {
    const bookedHouse = req.body;

    // Find existing booked houses by the user's email
    const existingBookedHouses = await BookedHouseModel.find({
      email: bookedHouse.email,
    });

    // Check the number of existing booked houses
    if (existingBookedHouses.length >= 2) {
      return res.status(400).json({
        message:
          "You have already booked two houses. Cannot book more at this time.",
      });
    }

    // Create a new entry in the database for the booked house
    const result = await BookedHouseModel.create(bookedHouse);

    // Send a success response
    res.status(200).json({
      data: result,
      message: "Booked house successfully.",
    });
  } catch (error) {
    // Handle errors
    res.status(500).json({
      message: error.message,
    });
  }
});

//Delete Booked House
app.delete(
  "/dletBookedHouse/:id",
  checkAuth("house-renter"),
  async (req, res) => {
    try {
      const id = req.params.id;
      const result = await BookedHouseModel.findByIdAndDelete(id);
      res.status(201).json({
        data: result,
        message: "Booking House Deleted Succesfully",
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  }
);
//*******************All rest Api End this Line********************//
// Graceful Shutdown
const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed. Exiting process...");
    process.exit(0);
  });
});

///********All Mongose Model Are Create HERe***********///
// User Model
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  role: { type: String, required: true },
  phone: { type: Number, required: true },
  email: { type: String, required: true },
  password: { type: String, required: true },
});

const UserModel = mongoose.model("User", userSchema);

const houseSchema = new mongoose.Schema({
  userId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: [true, "name is required"] },
  address: { type: String, required: [true, " address is required"] },
  city: { type: String, required: [true, "city is required"] },
  bedrooms: { type: Number, required: [true, "bedrooms is required"] },
  bathrooms: { type: Number, required: [true, "bathrooms is required"] },
  roomSize: { type: Number, required: [true, "roomSize is required"] },
  picture: { type: String, required: [true, "picture is required"] },
  availabilityDate: {
    type: Date,
    required: [true, " availabilityDate is required"],
  },
  rentPerMonth: { type: Number, required: [true, "rentPerMonth is required"] },
  phoneNumber: {
    type: String,
    required: [true, "phoneNumber is required"],
  },
  description: { type: String, required: [true, "description is required"] },
});

const HouseModel = mongoose.model("House", houseSchema);

// booked house mongoose schema

const bookedHouseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  house: {
    name: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    bedrooms: {
      type: Number,
      required: true,
    },
    bathrooms: {
      type: Number,
      required: true,
    },
    roomSize: {
      type: Number,
      required: true,
    },
    picture: {
      type: String,
      required: true,
    },
    availabilityDate: {
      type: Date,
      required: true,
    },
    rentPerMonth: {
      type: Number,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
  },
});

const BookedHouseModel = mongoose.model("BookedHouse", bookedHouseSchema);

// Connect to Database and Start Server
connectToDatabase();
