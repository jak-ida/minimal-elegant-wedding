const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: 'new' });
  for (const [w, h, mobile] of [[1280, 900, false], [390, 800, true]]) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, isMobile: mobile, hasTouch: mobile });
    await page.goto((process.env.BASE_URL || 'http://127.0.0.1:8123/index.html'), { waitUntil: 'networkidle0' });
    await page.evaluate(() => document.getElementById('gallery').scrollIntoView()); await sleep(1500);
    await page.click('.gallery__item:nth-child(1) .gallery__button'); await sleep(700);
    const y0 = await page.evaluate(() => window.scrollY);
    // click a dark margin at the top-left corner
    await page.mouse.click(8, 8); await sleep(500);
    const open = await page.evaluate(() => document.querySelector('dialog').open);
    const focus = await page.evaluate(() => document.activeElement.className);
    const y1 = await page.evaluate(() => window.scrollY);
    console.log(`${w}px: closed after outside click = ${!open}; focus returned to ${focus}; scroll position preserved = ${Math.abs(y0 - y1) < 2}`);
    // clicking the image itself must NOT close
    await page.click('.gallery__item:nth-child(1) .gallery__button'); await sleep(700);
    const box = await (await page.$('[data-lightbox-image]')).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await sleep(400);
    console.log(`${w}px: stays open when the photo itself is clicked = ${await page.evaluate(() => document.querySelector('dialog').open)}`);
    require('fs').mkdirSync(require('path').join(__dirname, 'output'), { recursive: true }); await page.screenshot({ path: require('path').join(__dirname, 'output', `lightbox-${w}.png`) });
    await page.close();
  }
  await browser.close();
})();
