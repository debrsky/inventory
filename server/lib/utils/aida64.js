const fs = require('fs');
const iconv = require('iconv-lite');
const cheerio = require('cheerio');

/**
 * Парсит отчет AIDA64 и извлекает информацию о системе.
 *
 * @param {string} pathToReportFile - Путь к файлу отчета AIDA64.
 * @returns {Promise<Object>} Объект с информацией о системе:
 *   @property {string} os - Информация об операционной системе.
 *   @property {string} cpu - Тип центрального процессора.
 *   @property {string} ram - Информация о системной памяти.
 *   @property {string} mb - Информация о системной плате.
 *   @property {string} ip - Первичный адрес IP.
 *   @property {string} mac - Первичный адрес MAC.
 *   @property {Array<string>} drives - Массив строк с информацией о дисковых накопителях.
 * @throws {Error} В случае возникновения ошибки при чтении или парсинге файла.
 */
async function parseReport(pathToReportFile) {
  const report = iconv.decode(
    await fs.promises.readFile(pathToReportFile),
    'win1251'
  );
  const $ = cheerio.load(report);

  const summary = $('table:has(a[name="summary"]) + table');

  const mb = summary.find('td:contains("Системная плата") + td').text().trim();
  const cpu = summary.find('td:contains("Тип ЦП") + td').text().trim();
  const ram = summary
    .find('td:contains("Системная память") + td')
    .text()
    .trim();
  const ip = summary.find('td:contains("Первичный адрес IP") + td').text().trim();
  const mac = summary.find('td:contains("Первичный адрес MAC") + td').text().trim();

  const drives = [];
  summary.find('td:contains("Дисковый накопитель") + td').each((i, elem) => {
    drives.push($(elem).text().trim());
  });

  const os = summary
    .find('td:contains("Операционная система") + td')
    .text()
    .trim();

  const cpuid = $('table:has(a[name="cpuid"]) + table td:contains("Имя ЦП CPUID") + td').text().trim();

  const result = { os, cpu, cpuid, ram, mb, ip, mac, drives };

  return result;
}

module.exports = {
  parseReport
};
