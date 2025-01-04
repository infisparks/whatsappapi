// index.js

const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios'); // For fetching images
const fs = require('fs');
const path = require('path');

// Initialize Express app
const app = express();
const port = 3000;

// Middleware to parse JSON and URL-encoded data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// NOTE: Using 'puppeteer' now, not 'puppeteer-core'
const puppeteer = require('puppeteer');

// Initialize WhatsApp client with local authentication
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: false, // Set to 'true' if you don't want a visible browser
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  },
});

// Display QR code in terminal for authentication
client.on('qr', (qr) => {
  console.log('QR RECEIVED', qr);
  qrcode.generate(qr, { small: true });
});

// Log successful authentication
client.on('ready', () => {
  console.log('WhatsApp Client is ready!');
});

// Handle authentication failures
client.on('auth_failure', msg => {
  console.error('AUTHENTICATION FAILURE', msg);
});

// Log incoming messages (optional)
client.on('message', msg => {
  console.log(`Message from ${msg.from}: ${msg.body}`);
});

// Initialize the client
client.initialize();

/**
 * Helper function to fetch image from URL and convert to MessageMedia
 * @param {string} imageUrl - The URL of the image to fetch
 * @returns {Promise<MessageMedia>} - The MessageMedia object
 */
const fetchImageFromUrl = async (imageUrl) => {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');
    const mimeType = response.headers['content-type'];
    const filename = path.basename(imageUrl).split('?')[0] || 'image.jpg';
    return new MessageMedia(mimeType, buffer.toString('base64'), filename);
  } catch (error) {
    throw new Error('Failed to fetch image from URL.');
  }
};

// Endpoint to send text message
app.post('/send-text', async (req, res) => {
  const { number, message } = req.body;

  if (!number || !message) {
    return res.status(400).json({ success: false, error: 'Number and message are required.' });
  }

  try {
    // Ensure the number is in the correct format
    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;

    await client.sendMessage(chatId, message);
    res.json({ success: true, message: 'Message sent successfully.' });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, error: 'Failed to send message.' });
  }
});

// Endpoint to send image via URL
app.post('/send-image-url', async (req, res) => {
  const { number, imageUrl, caption } = req.body;

  if (!number || !imageUrl) {
    return res.status(400).json({ success: false, error: 'Number and image URL are required.' });
  }

  try {
    // Ensure the number is in the correct format
    const chatId = number.includes('@c.us') ? number : `${number}@c.us`;

    // Fetch the image from the URL
    const media = await fetchImageFromUrl(imageUrl);

    await client.sendMessage(chatId, media, { caption: caption || '' });

    res.json({ success: true, message: 'Image sent successfully.' });
  } catch (error) {
    console.error('Error sending image:', error);
    res.status(500).json({ success: false, error: 'Failed to send image.' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`WhatsApp API server running at http://localhost:${port}`);
});
