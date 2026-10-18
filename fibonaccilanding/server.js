const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

// единый вид адресов: без слэша на конце и без «/index.html» → 301
app.use((req, res, next) => {
  let p = req.path;
  if (p.endsWith('/index.html')) p = p.slice(0, -'/index.html'.length) || '/';
  else if (p.length > 1 && p.endsWith('/')) p = p.replace(/\/+$/, '') || '/';
  else return next();
  const q = req.originalUrl.indexOf('?');
  res.redirect(301, p + (q >= 0 ? req.originalUrl.slice(q) : ''));
});

// статика с кэшем и правильными типами
app.use(express.static(PUBLIC, {
  redirect: false, // не добавлять слэш к папкам — страницы библиотеки отдаются маршрутом ниже
  maxAge: '1h',
  setHeaders: (res, filePath) => {
    // короткий кэш для картинок, чтобы обновления подхватывались без 30-дневного залипания
    if (filePath.endsWith('.webp')) res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
  }
}));

const send = (file) => (req, res) => res.sendFile(path.join(__dirname, 'public', file));

// главная — английская версия
app.get('/', send('index.html'));

// русская версия
app.get('/ru', send('index-ru.html'));
app.get('/ru/privacy', send('privacy-ru.html'));
app.get('/ru/terms', send('terms-ru.html'));
app.get('/ru/refund', send('refund-ru.html'));

// английские документы
app.get('/privacy', send('privacy.html'));
app.get('/terms', send('terms.html'));
app.get('/refund', send('refund.html'));

// библиотека презентаций: готовый HTML из scripts/build-library.js
// /ru/prezentacii, /ru/prezentacii/<category>, /ru/prezentacii/<category>/<slug>
app.get(/^\/ru\/prezentacii(\/[a-z0-9-]+){0,2}$/, (req, res, next) => {
  const file = path.join(PUBLIC, req.path, 'index.html');
  res.sendFile(file, (err) => { if (err && !res.headersSent) next(); });
});

// старый русский SEO-слаг → 301 на /ru
app.get('/neyroset-dlya-prezentaciy', (req, res) => res.redirect(301, '/ru'));

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

app.listen(PORT, () => console.log('Landing on port ' + PORT));
