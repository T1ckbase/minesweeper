const rows = 8;
const cols = 8;
const baseUrl = 'https://t1ckbase-minesweeper.hf.space';

const html = '<table id="toc">\n' +
  '  <tr>\n' +
  '    <td align="center">\n' +
  `      <a href="${baseUrl}/game/reset"><img src="${baseUrl}/game/status" width="48px" height="48px" /></a>\n` +
  '    </td>\n' +
  '  </tr>\n' +
  Array.from({ length: rows }, (_, r) =>
    '  <tr>\n' +
    '    <td align="center">\n' +
    Array.from({ length: cols }, (_, c) => {
      const imageUrl = `${baseUrl}/cell/${r}/${c}/image`;
      const clickUrl = `${baseUrl}/cell/${r}/${c}/click`;
      return `      <a href="${clickUrl}"><img src="${imageUrl}" width="32px" height="32px" /></a>`;
    }).join('\n') + '\n' +
    '    </td>\n' +
    '  </tr>').join('\n') +
  '\n</table>';

console.log(html);
