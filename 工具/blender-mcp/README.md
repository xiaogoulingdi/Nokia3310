# 本机 Blender MCP

2026-10-04 已安装并连通社区项目 [ahujasid/mcp-for-blender](https://github.com/ahujasid/mcp-for-blender)（原名 `blender-mcp`）。使用 PyPI 官方项目包 `mcp-for-blender==2.1.3`，其随包插件版本 1.8、协议 13，当前 Blender 为 5.2.2 LTS。

## 安装到哪里

- 服务端：`C:\Users\why_thinkpad\.local\bin\mcp-for-blender.exe`，由现有 `uv tool install` 管理。
- Blender 插件：`%APPDATA%\Blender Foundation\Blender\5.2\scripts\addons\blender_mcp.py`，已启用并保存偏好。
- Codex：`%USERPROFILE%\.codex\config.toml` 的 `mcp_servers.blender`，stdio 启动上述完整路径；连接 `127.0.0.1:9876`。
- 备份：Codex 原配置旁的 `config.before-blender-mcp.toml`；Blender `config/userpref.before-blender-mcp.blend`。备份留在各自用户配置目录，不进入仓库。

插件随 Blender 启动本机连接服务；若侧栏没有连接，在 3D 视图按 N，打开 MCP for Blender 面板并启动服务器。Codex 工具列表尚未刷新时，重新打开 Codex 即可读取新的 MCP 配置。没有调用付费生成接口，插件的外部素材／生成集成均关闭，遥测关闭。

## 本次实际验证

已经通过 MCP `execute_blender_code` 在运行中的 Blender 修改模型，并再次打开完成的 `Nokia3310_交互优化_v2.blend`；结果见 [安装验证.json](安装验证.json)。仅安装配置文件不能替代这一连接检查。

本次遇到导出器需要 `active_object` / 视图上下文而 MCP 回调没有提供的错误。因此最终 GLB 导出采用 Blender 自带的后台脚本；建模脚本和 MCP 客户端都保留在仓库。后续通过 `client.py --script 路径` 执行时，客户端提供 3D 视图覆盖上下文；脚本内再次打开文件会重建上下文，复杂导出仍建议使用后台命令。

`enable_addon.py` 仅用于安装配置；`check_connection.py` 会打开本项目 v2 文件；`client.py` 是连接同一官方 MCP 服务端的本地客户端，用于本轮工具列表刷新前验证。不要在其他未保存工程打开时运行会换工程的脚本。

## 重新生成网页资产

`Blender工程/脚本/修正功能键与导出v2.py` 只允许以 v1 为输入，会写入 v2，适合复现本次修改。若 v2 已经被人工精修，应另存新版本，避免再次运行生成脚本覆盖精修成果。执行方式：

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' --background --factory-startup 'Blender工程/Nokia3310_交互优化_v1.blend' --python-exit-code 1 --python 'Blender工程/脚本/修正功能键与导出v2.py'
```

随后双击项目根目录的 `启动本地预览.cmd`。安装 MCP 与上述本地修改均不会自动上传模型或部署网站。
