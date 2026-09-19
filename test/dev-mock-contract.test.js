import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_RS = readFileSync(join(ROOT, 'src-tauri', 'src', 'config.rs'), 'utf8');
const CARGO_TOML = readFileSync(join(ROOT, 'src-tauri', 'Cargo.toml'), 'utf8');
const PACKAGE_JSON = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

test('mock endpoint switch is gated behind the dev-local-endpoints feature', () => {
  const gatedBlocks = CONFIG_RS.match(
    /#\[cfg\(feature = "dev-local-endpoints"\)\][\r\n]+pub const [A-Z_]+: &str = "http:\/\/127\.0\.0\.1:8787[^"]*";/g,
  );
  assertMockEndpointsBehindFeatureGate(gatedBlocks);

  // 默认分支必须仍是正式 HTTPS 端点，逐条存在
  for (const expected of [
    'pub const SJD_ORIGIN: &str = "https://jwglweixin.bupt.edu.cn";',
    'pub const EMPTY_CLASSROOM_LOGIN_URL: &str = "https://jwglweixin.bupt.edu.cn/bjyddx/login";',
    'pub const EMPTY_CLASSROOM_TODAY_URL: &str = "https://jwglweixin.bupt.edu.cn/bjyddx/todayClassrooms";',
  ]) {
    if (!CONFIG_RS.includes(expected)) {
      throw new Error(`默认端点缺失或被改动：${expected}`);
    }
  }
});

function assertMockEndpointsBehindFeatureGate(gatedBlocks) {
  const count = (CONFIG_RS.match(/127\.0\.0\.1:8787/g) || []).length;
  if (!gatedBlocks || gatedBlocks.length !== count) {
    throw new Error(
      `存在未加 cfg(feature = "dev-local-endpoints") 门的 mock 端点：共 ${count} 处 127.0.0.1:8787，仅 ${gatedBlocks?.length ?? 0} 处受门控`,
    );
  }
}

test('dev-local-endpoints is not a default cargo feature', () => {
  if (!/dev-local-endpoints = \[\]/.test(CARGO_TOML)) {
    throw new Error('src-tauri/Cargo.toml 缺少 dev-local-endpoints feature 定义');
  }
  const defaultLine = CARGO_TOML.match(/^default = \[(.*)\]$/m)?.[1] ?? '';
  if (defaultLine.includes('dev-local-endpoints')) {
    throw new Error('dev-local-endpoints 不得进入 default features');
  }
});

test('mock server script is wired via npm run mock', () => {
  if (PACKAGE_JSON.scripts?.mock !== 'node scripts/dev/mock-server.mjs') {
    throw new Error('package.json 缺少 mock 脚本或指向错误');
  }
});

test('mock server only listens on loopback and serves contract fixtures', () => {
  const source = readFileSync(join(ROOT, 'scripts', 'dev', 'mock-server.mjs'), 'utf8');
  for (const expected of ["const HOST = '127.0.0.1'", "join(FIXTURES, name)", "sjd-curriculum.json", "sjd-classrooms-xitucheng.json", "sjd-classrooms-shahe.json"]) {
    if (!source.includes(expected)) {
      throw new Error(`mock-server.mjs 缺少约束：${expected}`);
    }
  }
  const code = source.replace(/^\/\/.*$/gm, '');
  const loopbackUrls = code.match(/https?:\/\/(?:127\.0\.0\.1|\$\{HOST\})[^'"]*/g) ?? [];
  const allUrls = code.match(/https?:\/\/[^'"\s]*/g) ?? [];
  if (allUrls.length !== loopbackUrls.length) {
    throw new Error(`mock server 不得包含非回环 URL：${allUrls.filter((u) => !loopbackUrls.includes(u))}`);
  }
});
