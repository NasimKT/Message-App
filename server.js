const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const randomstring = require('randomstring');
const cors = require('cors'); // Import the 'cors' middleware

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
app.use(bodyParser.json());
app.use(cors()); // Use the 'cors' middleware

const transporter = nodemailer.createTransport({
  service: 'Gmail', // Replace with your email service (e.g., 'Gmail')
  auth: {
    user: '', // Sender email address
    pass: '',    // Sender email password
  },
});

// A map to store generated OTPs, where keys are email addresses and values are OTPs
const otpMap = new Map();

app.post('/sendOTP', async (req, res) => {
  const { email } = req.body;

  // Generate a random 6-digit OTP
  const otp = randomstring.generate({
    length: 6,
    charset: 'numeric',
  });

  // Store the OTP in the map
  otpMap.set(email, otp);

  // Define email message options
  const mailOptions = {
    from: '', // Sender email address
    to: email,
    subject: 'Your OTP for Login',
    text: `Your OTP is: ${otp}`,
  };

  try {
    // Send the email with OTP
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'An error occurred while sending OTP' });
  }
});

app.post('/verifyOTP', (req, res) => {
  const { email, otp } = req.body;

  // Check if the provided OTP matches the one stored in the map
  if (otpMap.has(email) && otpMap.get(email) === otp) {
    // OTP is correct, remove it from the map
    otpMap.delete(email);
    res.status(200).json({ verified: true });
  } else {
    res.status(200).json({ verified: false });
  }
});

// Serve HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

// Keep track of connected users
const users = new Map();
let userCounter = 0; // Counter to track the order of connections

// Handle WebSocket connections
io.on('connection', (socket) => {
  console.log('User connected');

  // Assign a user role based on the order of connection
  userCounter++;
  const userRole = userCounter === 1 ? 'USER1' : 'USER2';

  // Store the user's socket ID and role
  users.set(socket.id, { socket: socket, role: userRole });

  // Notify the user about their role
  socket.emit('userRole', userRole);

  // Handle incoming messages
  socket.on('message', (data) => {
    console.log(`${userRole} - Message: ${data}`);

    // Send the message to all connected users
    const sender = users.get(socket.id);

    // Broadcast the message to all users, including the sender
    io.emit('message', { role: sender.role, message: data });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected');
    users.delete(socket.id);
    userCounter--;
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
