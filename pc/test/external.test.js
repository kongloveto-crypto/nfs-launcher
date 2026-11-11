const test = require('node:test');
const assert = require('node:assert');
const { isExternalUrl, isAllowedUrl } = require('../src/main/config');

test('link da playlist do Spotify vai para o navegador; o resto continua bloqueado', () => {
  assert.ok(isExternalUrl('https://open.spotify.com/playlist/2KYnOjOMzSCeQs97ZJiMe1'));
  assert.ok(!isAllowedUrl('https://open.spotify.com/playlist/2KYnOjOMzSCeQs97ZJiMe1', 'nfsu2'));
  for (const u of ['http://open.spotify.com/x', 'https://evil.com/open.spotify.com', 'https://open.spotify.com.evil.com/',
    'https://a:b@open.spotify.com/', 'https://open.spotify.com:8443/', 'javascript:alert(1)', 'file:///c:/x', 'nada']) {
    assert.ok(!isExternalUrl(u), u);
  }
});
