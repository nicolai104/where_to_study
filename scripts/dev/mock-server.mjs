#!/usr/bin/env node
// Where To Study 本地开发 mock server（零依赖，fixtures 驱动）
//
// 用途：无北邮账号时的本地开发环境。复用 contracts/v1/fixtures 的脱敏夹具
// 模拟移动教务（SJD）接口，配合 `--features dev-local-endpoints` 编译期端点
// 切换使用。仅监听 127.0.0.1，绝不访问外部网络。
//
// 用法：
//   npm run mock
//   另开终端：npm run tauri dev -- --features dev-local-endpoints
//   登录界面输入任意非空学号/密码（例如 mock / mock）。
//
// 端点：
//   POST /bjyddx/login                       → {code:1, data:{token}}
//   POST /bjyddx/student/curriculum?week=    → sjd-current-week.json
//   POST /bjyddx/student/curriculum?week=all → sjd-curriculum.json
//   GET  /bjyddx/todayClassrooms?campusId=01 → sjd-classrooms-xitucheng.json
//   GET  /bjyddx/todayClassrooms?campusId=04 → sjd-classrooms-shahe.json

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const PORT = Number(process.env.WTS_MOCK_PORT || 8787);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES = join(ROOT, 'contracts', 'v1', 'fixtures');

const MOCK_TOKEN = 'mock-token-for-local-development';

function fixture(name) {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

function sendJson(res, statusCode, body) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(''));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const route = `${req.method} ${url.pathname}${url.search}`;
  console.log(`[mock] ${route}`);

  if (req.method === 'POST' && url.pathname === '/bjyddx/login') {
    const body = await readBody(req);
    const params = new URLSearchParams(body);
    if (!params.get('userNo')?.trim() || !params.get('pwd')) {
      sendJson(res, 200, { code: 0, Msg: 'mock: 学号或密码为空' });
      return;
    }
    sendJson(res, 200, { code: 1, Msg: 'success', data: { token: MOCK_TOKEN } });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/bjyddx/student/curriculum') {
    const week = url.searchParams.get('week') ?? '';
    if (week === 'all') {
      sendJson(res, 200, fixture('sjd-curriculum.json'));
    } else {
      sendJson(res, 200, fixture('sjd-current-week.json'));
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/bjyddx/todayClassrooms') {
    const campus = url.searchParams.get('campusId');
    if (campus === '01') {
      sendJson(res, 200, fixture('sjd-classrooms-xitucheng.json'));
    } else if (campus === '04') {
      sendJson(res, 200, fixture('sjd-classrooms-shahe.json'));
    } else {
      sendJson(res, 200, { code: 0, Msg: `mock: 未知 campusId=${campus}` });
    }
    return;
  }

  sendJson(res, 404, { code: 0, Msg: `mock: 未实现的端点 ${route}` });
});

server.listen(PORT, HOST, () => {
  console.log(`[mock] Where To Study 开发 mock 已启动：http://${HOST}:${PORT}`);
  console.log('[mock] 登录凭据：任意非空学号 + 密码（例：mock / mock）');
  console.log('[mock] 数据源：contracts/v1/fixtures/*.json（脱敏夹具）');
});
