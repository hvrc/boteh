const express = require('express');
const path = require('path');
const app = express();

// Serve files from root directory
app.use(express.static(path.join(__dirname)));

// Serve files from src directory
app.use('/src', express.static(path.join(__dirname, 'src')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 2999;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
}).on('error', (err) => {
  console.error(`Server failed to start: ${err.message}`);
});
