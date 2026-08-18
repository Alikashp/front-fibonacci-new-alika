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

const send = (file) => (req, res) => res.sendFile(path.join(__dirname, 'public', file));

// главная страница на слаг
app.get('/neyroset-dlya-prezentaciy', send('index.html'));
app.get('/', send('index.html'));

// юридические документы — без .html в адресе
app.get('/privacy', send('privacy.html'));
app.get('/terms', send('terms.html'));
app.get('/refund', send('refund.html'));

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => console.log('Landing on port ' + PORT));
