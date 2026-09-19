# 本地开发测试环境（无北邮账号跑通全流程）

由两部分组成：

1. **`mock-server.mjs`**：零依赖 Node 服务，监听 `127.0.0.1:8787`，用
   `contracts/v1/fixtures/` 的脱敏夹具模拟移动教务（SJD）三个接口。
2. **`dev-local-endpoints` Cargo feature**：编译期把 src-tauri 的全部 SJD
   端点切到 `127.0.0.1:8787`（默认构建逐字节不变，发布/CI 命令不得启用，
   由 `test/dev-mock-contract.test.js` 防护）。

## 用法

```bash
# 终端 1：启动 mock
npm run mock

# 终端 2：以本地端点 feature 启动桌面端开发环境
npm run tauri dev -- --features dev-local-endpoints
```

登录界面输入任意非空学号/密码（例：`mock` / `mock`）即可拉取夹具课表与
两校区空教室。天不联网、不触碰真实教务凭据。

## 边界

- mock 只覆盖 SJD（登录 / 课表 / 空教室）；节假日、天气、黄历、竞赛、班车
  等无凭据公开数据仍走真实接口（如需完全离线可在设置中关闭对应卡片）。
- feature 开启时 `validate_sjd_redirect_target` 允许 http 重定向目标，
  仅服务于本地代理调试；默认构建保持 HTTPS 强制不变。
- Windows 中文路径下请从 `X:\where_to_study`（subst 盘符）启动构建。
