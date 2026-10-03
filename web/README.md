# Nokia 3310 黑色交互展台

这里保存 2026-10-03 从 https://daidainiao.online/ 的实际发布目录只读取回并逐文件校验的网页源码。四个源码文件保留线上原始字节；本分支从 main 的 `b6df19897c400551e31adce94201aa2147d19487` 创建，原有模型与资料保持原样。

加载完成后，页面只显示纯黑背景和居中的大尺寸手机。拖动旋转，滚轮或双指缩放；点击 15 个手机按键触发对应 GLB 动画。拖动、多指手势和长按不会触发按键。加载时有圆环，失败时显示错误说明，辅助技术可读取隐藏操作提示。LCD 与机身文字来自模型；未增加拨号或真实手机系统功能。

## 生成和预览

需要 Python 3.10+，只用标准库，不需要 npm、node_modules 或额外 Python 包。在仓库根目录运行：

```sh
python3 web/build.py
python3 -m http.server 8080 --directory web/dist
```

Windows 可使用 `py -3` 代替 `python3`。打开 http://localhost:8080/；页面依赖 HTTP 服务和支持 WebGL 的现代浏览器，不适合直接双击 HTML。HTML 使用根路径资源，部署时须放在网站根目录。

构建会从 npm 官方 registry 下载锁定的 Three.js `0.180.0`，验证 SHA-512 完整性，只读取清单中的六个运行时 JS 与 MIT 许可证。原模型从 `Blender工程/网页模型/nokia3310_interactive_v1.glb` 复制到 `assets/nokia3310.glb`，不会修改模型。每个源码、模型与依赖文件均验证 SHA-256 后写入 `web/dist/`；哈希见 `dependencies.lock.json`。下载源失效时构建会失败，不会自动升级版本。

离线重建可预先保存同一官方 tarball；自定义模型位置也必须具有锁文件指定的原始哈希：

```sh
python3 web/build.py --tarball /path/to/three-0.180.0.tgz
python3 web/build.py --model /path/to/nokia3310_interactive_v1.glb
```

生成目录不提交 Git。浏览器运行时的全部依赖由网站自身提供，无需连接 CDN。Three.js 的 MIT 许可随生成目录保留；模型及参考资料的来源和许可请查看仓库原有说明。

## 静态部署

将 `web/dist/` 的内容复制到静态网站根目录即可。先备份现有发布目录，再切换到新目录。下面是供配置时参考的 Caddy 站点块；替换域名与目录后再验证配置：

```caddyfile
example.com {
    root * /var/www/nokia3310
    encode zstd gzip
    file_server
}
```

本分支只保存代码与复现说明，不会执行部署、修改线上服务器或创建自动发布流程。

## 验证记录

- 从实际线上发布目录取得四个源码并核对 SHA-256；模型哈希与仓库 GLB 一致。
- 使用真实 GLB 与 Three.js 加载器检查：15 个按键均可射线命中，各自动画能回到初始位置，邻近按键保持原位；检查了六种指针触发条件。
- 四种视口比例下模型不裁切，15 个按键均能命中。用户电脑上的本地 Chrome 使用独立临时配置进行桌面及窄屏渲染，已检查纯黑、居中、无可见网页标题或操作按钮。
- 上述记录不是实际手机硬件上的触控与性能测试。材质效果会随设备 WebGL 支持变化。

构建打印所有生成文件的 SHA-256；可以与锁文件和部署内容再次对照。
