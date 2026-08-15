const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// статика с кэшем и правильными типами
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.webp')) res.setHeader('Cache-Control', 'public, max-age=2592000');
  }
}));

// главная страница на слаг
app.get('/neyroset-dlya-prezentaciy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log('Landing on port ' + PORT));
