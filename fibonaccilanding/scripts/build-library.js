#!/usr/bin/env node
// Сборка библиотеки презентаций: content/library/*.json → готовый HTML в
// public/ru/prezentacii/... + sitemap.xml. Страницы статические: весь текст
// (intro, слайды, план, FAQ) лежит в исходном HTML, без рендера на клиенте.
//
// Запуск:  node scripts/build-library.js
// Новая тема: положить JSON (+ pptx в content/library/source/<slug>/),
// прогнать scripts/render-slides.py, затем этот скрипт.
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTENT = path.join(ROOT, 'content', 'library');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(PUBLIC, 'ru', 'prezentacii');
const SITE = 'https://fibonacciai.io';
const BASE = '/ru/prezentacii';
const APP_LOGIN = 'https://app.fibonacciai.io/login';
const TELEGRAM = 'https://t.me/Fibonacci_presentation_bot';
const METRIKA_ID = 111554421;
const TODAY = new Date().toISOString().slice(0, 10);

// лендинг и документы — в sitemap вместе с библиотекой
const STATIC_PAGES = [
  { loc: '/', alt: { en: '/', ru: '/ru', 'x-default': '/' } },
  { loc: '/ru', alt: { en: '/', ru: '/ru', 'x-default': '/' } },
  { loc: '/privacy' }, { loc: '/terms' }, { loc: '/refund' },
  { loc: '/ru/privacy' }, { loc: '/ru/terms' }, { loc: '/ru/refund' },
];
const STATIC_LASTMOD = '2026-10-18';

// ───────────────────────── данные ─────────────────────────
function loadContent() {
  const categories = new Map();
  const topics = new Map();
  const files = fs.readdirSync(CONTENT).filter((f) => f.endsWith('.json')).sort();
  for (const f of files) {
    const file = path.join(CONTENT, f);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    let dirty = false;
    for (const c of data.categories || []) categories.set(c.slug, c);
    for (const t of data.topics || []) {
      if (!t.updated) { t.updated = TODAY; dirty = true; } // фиксируем дату публикации для lastmod
      topics.set(t.slug, t);
    }
    if (dirty) fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
  // тема опубликована, если у неё есть категория и отрендерены превью
  for (const [slug, t] of topics) {
    const firstImg = t.slides && t.slides[0] && path.join(PUBLIC, t.slides[0].image);
    if (!categories.has(t.category)) throw new Error(`[${slug}] неизвестная категория ${t.category}`);
    if (!firstImg || !fs.existsSync(firstImg)) {
      console.warn(`[${slug}] нет превью слайдов — тема пропущена (запустите scripts/render-slides.py)`);
      topics.delete(slug);
    }
  }
  return { categories, topics };
}

// ───────────────────────── утилиты ─────────────────────────
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const jsonLd = (obj) => JSON.stringify(obj).replace(/</g, '\\u003c');
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
// короткое название темы для карточек: «Презентация на тему «X»» → X
const shortTitle = (t) => t.card_title || (t.h1.match(/«(.+)»\s*$/) || [, t.h1])[1];
const topicUrl = (t) => `${BASE}/${t.category}/${t.slug}`;
const catUrl = (c) => `${BASE}/${c.slug}`;
const ctaHref = (topic) => `${APP_LOGIN}?${topic ? `topic=${encodeURIComponent(topic)}&` : ''}from=library`;

function logoSvg() {
  const html = fs.readFileSync(path.join(PUBLIC, 'index-ru.html'), 'utf8');
  const m = html.match(/<svg width="28" height="28" viewBox="0 0 974 974"[\s\S]*?<\/svg>/);
  if (!m) throw new Error('не найден логотип в public/index-ru.html');
  // id градиента уникален на странице, логотип встречается дважды — оставляем один <defs>
  return m[0];
}

const METRIKA = `<!-- Yandex.Metrika counter -->
<script type="text/javascript">
(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
m[i].l=1*new Date();
for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${METRIKA_ID}', 'ym');
ym(${METRIKA_ID}, 'init', {webvisor:true, clickmap:true, accurateTrackBounce:true, trackLinks:true});
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/${METRIKA_ID}" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->`;

// цель Метрики на клик по CTA: data-cta="<slug>"
const CTA_SCRIPT = `<script>
document.addEventListener('click',function(e){
  var a=e.target.closest&&e.target.closest('a[data-cta]');
  if(a&&typeof ym==='function'){ym(${METRIKA_ID},'reachGoal','library_cta',{topic:a.getAttribute('data-cta')});}
});
</script>`;

const CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#080A1A;color:#C9CDE8;font-family:'Golos Text',system-ui,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.6}
img{display:block;max-width:100%;height:auto}
a{color:#A9B0FF;text-decoration:none}
a:hover{color:#fff}
:focus-visible{outline:2px solid #8E7BFF;outline-offset:3px;border-radius:8px}
.wrap{max-width:1180px;margin:0 auto;padding:0 clamp(16px,3vw,40px)}
header.top{position:sticky;top:0;z-index:60;backdrop-filter:blur(16px);background:rgba(8,10,26,.82);border-bottom:1px solid rgba(255,255,255,.07)}
header.top .wrap{max-width:1320px;display:flex;align-items:center;justify-content:space-between;gap:16px;padding-top:13px;padding-bottom:13px}
.logo{display:flex;align-items:center;gap:10px;color:#fff;font-family:'Oswald',sans-serif;font-weight:600;font-size:19px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.logo span{width:28px;height:28px;flex:none;display:inline-flex}
.hnav{display:flex;align-items:center;gap:18px;font-size:14px}
.hnav a.lnk{color:#A6ABC8}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;height:52px;padding:0 26px;border-radius:999px;font-size:16px;font-weight:600;white-space:nowrap;transition:transform .2s ease,background .2s ease}
.btn:hover{transform:translateY(-1px)}
.btn-main{background:linear-gradient(135deg,#4B54F5,#8442FF);color:#fff;box-shadow:0 16px 32px -16px rgba(132,66,255,.9)}
.btn-main:hover{color:#fff}
.btn-white{background:#fff;color:#12142E}
.btn-white:hover{color:#12142E}
.btn-ghost{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.28);color:#fff}
.btn-sm{height:40px;padding:0 18px;font-size:14px}
.crumbs{font-size:13.5px;color:#7F86AC;margin:22px 0 0}
.crumbs ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.crumbs li+li::before{content:"→";margin-right:6px;color:#3A3F63}
.crumbs a{color:#8E95BE}
h1{font-family:'Oswald',sans-serif;font-weight:700;text-transform:uppercase;color:#fff;font-size:clamp(30px,4.6vw,56px);line-height:1.02;margin:18px 0 0;text-wrap:balance;overflow-wrap:break-word}
h2{font-family:'Oswald',sans-serif;font-weight:700;text-transform:uppercase;color:#fff;font-size:clamp(24px,3vw,36px);line-height:1.08;margin:0 0 18px}
h3{font-family:'Oswald',sans-serif;font-weight:600;color:#fff;letter-spacing:.01em;font-size:19px;line-height:1.25;margin:0 0 10px}
.intro{font-size:clamp(16px,1.4vw,18.5px);line-height:1.62;color:#C3C7E8;margin:16px 0 0;max-width:72ch}
.cta-row{display:flex;flex-wrap:wrap;gap:12px;margin:26px 0 0}
.note{font-size:14px;color:#8E95BE;margin:14px 0 0}
section.blk{padding:clamp(40px,5vw,64px) 0 0}
.slides{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.slide{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:12px 12px 18px}
.slide img{border-radius:12px;border:1px solid rgba(255,255,255,.1);aspect-ratio:16/9;object-fit:cover;width:100%;background:#11132b}
.slide .txt{padding:14px 6px 0}
.slide .num{display:inline-block;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#8E7BFF;margin:0 0 6px}
.slide ul{margin:0;padding-left:18px;font-size:14.5px;line-height:1.55;color:#A6ABC8}
.slide li{margin:0 0 7px}
.slide li::marker{color:#8E7BFF}
.slide strong{color:#E4E6FF;font-weight:600}
.caption{margin:18px 0 0;font-size:15px;color:#A6ABC8}
.plan{margin:0;padding:0;list-style:none;counter-reset:p;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.plan li{counter-increment:p;display:flex;gap:12px;align-items:flex-start;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:12px 16px;font-size:15px;color:#C9CDE8}
.plan li::before{content:counter(p);flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:600;color:#fff;background:linear-gradient(135deg,#4B54F5,#8442FF)}
details.faq{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:16px 20px;margin:0 0 10px}
details.faq summary{list-style:none;cursor:pointer;display:flex;justify-content:space-between;gap:16px;align-items:center;font-size:16.5px;font-weight:600;color:#fff}
details.faq summary::-webkit-details-marker{display:none}
details.faq summary i{flex:none;width:14px;height:14px;background:linear-gradient(#A6ABC8,#A6ABC8) center/100% 2px no-repeat,linear-gradient(#A6ABC8,#A6ABC8) center/2px 100% no-repeat;transition:transform .2s ease}
details.faq[open] summary i{transform:rotate(45deg)}
details.faq p{margin:12px 0 0;font-size:15.5px;color:#A6ABC8}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.card{display:block;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:18px;overflow:hidden;color:#fff;transition:transform .2s ease,border-color .2s ease}
.card:hover{transform:translateY(-3px);border-color:rgba(142,123,255,.6);color:#fff}
.card img{aspect-ratio:16/9;object-fit:cover;width:100%;background:#11132b}
.card span{display:block;padding:14px 16px 16px;font-weight:600;font-size:15.5px;line-height:1.35}
.cat-block{margin:0 0 clamp(36px,4vw,52px)}
.cat-block p{margin:-6px 0 18px;color:#A6ABC8;max-width:72ch}
.cat-block .more{display:inline-block;margin:14px 0 0;font-size:14.5px}
.final{margin:clamp(48px,6vw,80px) 0 0;padding:clamp(28px,4vw,48px);border-radius:24px;background:linear-gradient(135deg,#4B54F5 0%,#8442FF 100%);text-align:center}
.final h2{margin:0 0 10px}
.final p{margin:0;color:#EDEBFF;font-size:16.5px}
.final .cta-row{justify-content:center}
footer.foot{margin-top:clamp(48px,6vw,80px);border-top:1px solid rgba(255,255,255,.08);background:#070919}
footer.foot .wrap{max-width:1320px;padding-top:clamp(32px,4vw,56px);padding-bottom:clamp(32px,4vw,56px);display:grid;grid-template-columns:repeat(auto-fit,minmax(228px,1fr));gap:26px;color:#8E95BE;font-size:14px}
footer.foot nav{display:flex;flex-direction:column;gap:9px}
footer.foot nav a{color:#8E95BE}
footer.foot .req{font-size:13px;line-height:1.7;color:#5A5F80}
footer.foot .req a{color:#5A5F80}
@media (max-width:760px){
  .slides,.plan{grid-template-columns:minmax(0,1fr)}
  .hnav a.lnk{display:none}
  .btn{height:50px;padding:0 20px;font-size:15px}
  .cta-row .btn{flex:1 1 100%}
}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

// ───────────────────────── каркас страницы ─────────────────────────
function page({ title, description, url, ogImage, jsonLdBlocks, body }) {
  const logo = logoSvg();
  const abs = SITE + url;
  return `<!DOCTYPE html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${METRIKA}
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${abs}">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:locale" content="ru_RU">
<meta property="og:site_name" content="Fibonacci AI">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs}">
${ogImage ? `<meta property="og:image" content="${SITE}${ogImage}">\n<meta property="og:image:width" content="1280">\n<meta property="og:image:height" content="721">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Golos+Text:wght@400;500;600&display=swap&subset=cyrillic">
<style>${CSS.trim()}</style>
${jsonLdBlocks.map((o) => `<script type="application/ld+json">${jsonLd(o)}</script>`).join('\n')}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="logo" href="/ru"><span>${logo}</span>Fibonacci&nbsp;AI</a>
  <nav class="hnav" aria-label="Основное меню">
    <a class="lnk" href="${BASE}">Примеры презентаций</a>
    <a class="lnk" href="/ru#pricing">Цены</a>
    <a class="btn btn-main btn-sm" href="${ctaHref('')}" data-cta="header">Попробовать</a>
  </nav>
</div></header>
<main class="wrap">
${body}
</main>
<footer class="foot"><div class="wrap">
  <div>
    <span class="logo"><span>${logo.replace(/id="fiblogograd"/, 'id="fiblogograd2"').replace(/url\(#fiblogograd\)/, 'url(#fiblogograd2)')}</span>Fibonacci&nbsp;AI</span>
    <p style="margin:14px 0 0;max-width:34ch">Нейросеть для создания презентаций. Сервисом пользуются более 10&nbsp;000 человек в месяц.</p>
  </div>
  <nav aria-label="Документы">
    <a href="${BASE}">Примеры презентаций</a>
    <a href="/ru/privacy">Политика конфиденциальности</a>
    <a href="/ru/terms">Пользовательское соглашение</a>
    <a href="/ru/refund">Возврат средств</a>
  </nav>
  <div class="req">ООО «Фибоначчи Групп»<br>ИНН 1644104441 · ОГРН 1231600055774<br>423457, г. Альметьевск, ул. Нефтяников, д. 11, кв. 109<br><a href="mailto:fibonaccislides@mail.ru">fibonaccislides@mail.ru</a></div>
</div></footer>
${CTA_SCRIPT}
</body></html>
`;
}

function crumbs(items) {
  const html = `<nav class="crumbs" aria-label="Хлебные крошки"><ol>${items.map((it, i) =>
    i === items.length - 1
      ? `<li><span aria-current="page">${esc(it.name)}</span></li>`
      : `<li><a href="${it.url}">${esc(it.name)}</a></li>`).join('')}</ol></nav>`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.name, item: SITE + it.url,
    })),
  };
  return { html, ld };
}

const tgIcon = '<svg width="20" height="20" aria-hidden="true" style="flex:none"><path d="M22 3 1.8 10.9l6.1 2.3 2.2 7.3 3.4-4.6 5.2 3.9L22 3Z" fill="#29ABE2"></path></svg>';

function card(t, lazy = true) {
  const s = t.slides[0];
  return `<a class="card" href="${topicUrl(t)}"><img src="${s.image}" width="${s.width || 1280}" height="${s.height || 721}" alt="${esc(s.alt)}"${lazy ? ' loading="lazy" decoding="async"' : ''}><span>${esc(shortTitle(t))}</span></a>`;
}

function finalCta(slug) {
  return `<section class="final">
  <h2>Не нашли нужную тему?</h2>
  <p>Напишите любую — презентация будет готова через минуту.</p>
  <div class="cta-row"><a class="btn btn-white" href="${ctaHref('')}" data-cta="${esc(slug)}">Сделать свою презентацию</a></div>
</section>`;
}

// «Тезис — пояснение» → подзаголовок жирным
function bulletHtml(b) {
  const i = b.indexOf(' — ');
  if (i > 0 && b.slice(0, i).split(/\s+/).length <= 8) {
    return `<strong>${esc(b.slice(0, i))}</strong> — ${esc(b.slice(i + 3))}`;
  }
  return esc(b);
}

// ───────────────────────── страницы ─────────────────────────
function topicPage(t, cat, all) {
  const url = topicUrl(t);
  const cr = crumbs([
    { name: 'Главная', url: '/ru' },
    { name: 'Презентации', url: BASE },
    { name: cat.name, url: catUrl(cat) },
    { name: shortTitle(t), url },
  ]);
  const ctaPrimary = ctaHref(t.cta_topic);
  const slidesHtml = t.slides.map((s, i) => `<article class="slide">
    <img src="${s.image}" width="${s.width || 1280}" height="${s.height || 721}" alt="${esc(s.alt)}"${i === 0 ? ' fetchpriority="high"' : ''}${i >= 2 ? ' loading="lazy"' : ''} decoding="async">
    <div class="txt">
      <span class="num">Слайд ${i + 1}</span>
      ${s.title ? `<h3>${esc(s.title)}</h3>` : ''}
      ${s.bullets && s.bullets.length ? `<ul>${s.bullets.map((b) => `<li>${bulletHtml(b)}</li>`).join('')}</ul>` : ''}
    </div>
  </article>`).join('\n  ');

  const total = t.slides_total;
  const caption = total
    ? `Это первые ${t.slides.length} ${plural(t.slides.length, 'слайд', 'слайда', 'слайдов')}. Полная презентация — около ${total} ${plural(total, 'слайда', 'слайдов', 'слайдов')}, собирается за минуту.`
    : `Это первые ${t.slides.length} слайда. Полная презентация собирается за минуту.`;

  // похожие: только опубликованные; меньше двух — добираем из категории, затем из остальных
  const related = [];
  const add = (s) => { const r = all.get(s); if (r && r.slug !== t.slug && !related.includes(r)) related.push(r); };
  (t.related || []).forEach(add);
  if (related.length < 2) [...all.values()].filter((x) => x.category === t.category).forEach((x) => add(x.slug));
  if (related.length < 2) [...all.values()].forEach((x) => related.length < 3 && add(x.slug));

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: t.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };

  const body = `${cr.html}
<h1>${esc(t.h1)}</h1>
<p class="intro">${esc(t.intro)}</p>
<div class="cta-row">
  <a class="btn btn-main" href="${ctaPrimary}" data-cta="${esc(t.slug)}">Сделать презентацию на эту тему</a>
  <a class="btn btn-ghost" href="${TELEGRAM}">${tgIcon}Сделать в Telegram</a>
</div>

<section class="blk" aria-labelledby="h-slides">
  <h2 id="h-slides">Первые слайды</h2>
  <div class="slides">
  ${slidesHtml}
  </div>
  <p class="caption">${caption}</p>
</section>

<section class="blk" aria-labelledby="h-plan">
  <h2 id="h-plan">План полной презентации</h2>
  <ol class="plan">${t.plan.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
  <div class="cta-row"><a class="btn btn-main" href="${ctaPrimary}" data-cta="${esc(t.slug)}">Сделать презентацию на эту тему</a></div>
</section>

<section class="blk" aria-labelledby="h-faq">
  <h2 id="h-faq">Частые вопросы</h2>
  ${t.faq.map((f) => `<details class="faq"><summary>${esc(f.q)}<i></i></summary><p>${esc(f.a)}</p></details>`).join('\n  ')}
</section>
${related.length ? `
<section class="blk" aria-labelledby="h-rel">
  <h2 id="h-rel">Похожие темы</h2>
  <div class="cards">${related.map((r) => card(r)).join('')}</div>
</section>` : ''}
${finalCta(t.slug)}`;

  return page({
    title: t.title, description: t.description, url, ogImage: t.slides[0].image,
    jsonLdBlocks: [cr.ld, faqLd], body,
  });
}

function categoryPage(cat, topics) {
  const url = catUrl(cat);
  const cr = crumbs([
    { name: 'Главная', url: '/ru' },
    { name: 'Презентации', url: BASE },
    { name: cat.name, url },
  ]);
  const body = `${cr.html}
<h1>${esc(cat.h1)}</h1>
<p class="intro">${esc(cat.intro)}</p>
<section class="blk" aria-labelledby="h-list">
  <h2 id="h-list">Темы</h2>
  <div class="cards">${topics.map((t, i) => card(t, i >= 4)).join('')}</div>
</section>
${finalCta(`hub-${cat.slug}`)}`;
  return page({
    title: `${cat.h1} — примеры и планы слайдов | Fibonacci AI`,
    description: cat.intro,
    url, ogImage: topics[0] && topics[0].slides[0].image,
    jsonLdBlocks: [cr.ld], body,
  });
}

function hubPage(categories, byCat) {
  const cr = crumbs([{ name: 'Главная', url: '/ru' }, { name: 'Презентации', url: BASE }]);
  let shown = 0;
  const blocks = [...categories.values()].filter((c) => byCat.get(c.slug)?.length).map((c) => {
    const list = byCat.get(c.slug);
    const html = `<section class="cat-block" aria-labelledby="c-${c.slug}">
  <h2 id="c-${c.slug}"><a href="${catUrl(c)}" style="color:#fff">${esc(c.name)}</a></h2>
  <p>${esc(c.intro)}</p>
  <div class="cards">${list.map((t) => card(t, shown++ >= 4)).join('')}</div>
  <a class="more" href="${catUrl(c)}">Все презентации раздела «${esc(c.name)}» →</a>
</section>`;
    return html;
  }).join('\n');
  const first = [...byCat.values()].flat()[0];
  const body = `${cr.html}
<h1>Примеры презентаций на разные темы</h1>
<p class="intro">Готовые примеры презентаций для уроков, докладов и проектов: первые слайды, план полной версии и ответы на частые вопросы. Выберите тему и сделайте свою презентацию за минуту — или напишите любую другую тему.</p>
<div class="cta-row"><a class="btn btn-main" href="${ctaHref('')}" data-cta="hub">Сделать свою презентацию</a></div>
<div class="blk" style="padding-top:clamp(36px,4vw,56px)">
${blocks}
</div>
${finalCta('hub')}`;
  return page({
    title: 'Примеры презентаций на разные темы — Fibonacci AI',
    description: 'Примеры презентаций по литературе, астрономии, здоровью и другим темам: первые слайды, план и ответы на вопросы. Сделайте свою презентацию за минуту с нейросетью.',
    url: BASE, ogImage: first && first.slides[0].image,
    jsonLdBlocks: [cr.ld], body,
  });
}

// ───────────────────────── sitemap ─────────────────────────
function sitemap(entries) {
  const urls = entries.map((e) => {
    const alt = e.alt ? Object.entries(e.alt).map(([l, h]) =>
      `\n    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${h}"/>`).join('') : '';
    return `  <url>\n    <loc>${SITE}${e.loc}</loc>\n    <lastmod>${e.lastmod}</lastmod>${alt}\n  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

// ───────────────────────── запуск ─────────────────────────
function write(rel, html) {
  const file = path.join(OUT, rel, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
}

function main() {
  const { categories, topics } = loadContent();

  // очищаем прошлую сборку HTML (картинки не трогаем)
  for (const entry of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) {
    if (entry === 'img') continue;
    fs.rmSync(path.join(OUT, entry), { recursive: true, force: true });
  }

  const byCat = new Map();
  for (const t of topics.values()) {
    if (!byCat.has(t.category)) byCat.set(t.category, []);
    byCat.get(t.category).push(t);
  }

  const map = [...STATIC_PAGES.map((p) => ({ ...p, lastmod: STATIC_LASTMOD }))];
  const latest = (list) => list.map((t) => t.updated).sort().pop();

  write('', hubPage(categories, byCat));
  map.push({ loc: BASE, lastmod: latest([...topics.values()]) });

  for (const [slug, list] of byCat) {
    const cat = categories.get(slug);
    write(slug, categoryPage(cat, list));
    map.push({ loc: catUrl(cat), lastmod: latest(list) });
    for (const t of list) {
      write(`${slug}/${t.slug}`, topicPage(t, cat, topics));
      map.push({ loc: topicUrl(t), lastmod: t.updated });
    }
  }

  fs.writeFileSync(path.join(PUBLIC, 'sitemap.xml'), sitemap(map));
  console.log(`Готово: ${topics.size} тем, ${byCat.size} категорий, хаб; sitemap — ${map.length} адресов.`);
}

main();
