"""Use the installed MCP server from a terminal before Codex reloads its tool list."""
import asyncio
import json
import os
import sys
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    env = dict(os.environ, BLENDER_HOST='127.0.0.1', BLENDER_PORT='9876', DISABLE_TELEMETRY='true')
    executable = Path.home() / '.local/bin/mcp-for-blender.exe'
    async with stdio_client(StdioServerParameters(command=str(executable), env=env)) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            if len(sys.argv) == 1:
                result = await session.list_tools()
                print(json.dumps([{'name': t.name, 'inputSchema': t.inputSchema} for t in result.tools
                                  if t.name in ('get_scene_info', 'execute_blender_code', 'get_viewport_screenshot')], ensure_ascii=False))
            elif sys.argv[1] == '--script':
                path = Path(sys.argv[2]).resolve()
                code = "import bpy\nw=bpy.context.window_manager.windows[0]\na=next(a for a in w.screen.areas if a.type=='VIEW_3D')\nwith bpy.context.temp_override(window=w,area=a,region=next(r for r in a.regions if r.type=='WINDOW')):\n " + f"exec(compile({path.read_text(encoding='utf-8')!r}, {str(path)!r}, 'exec'), {{'__file__': {str(path)!r}}})"
                result = await session.call_tool('execute_blender_code', {'code': code, 'user_prompt': '在 v2 工作副本修正功能键并导出网页模型'})
                for block in result.content:
                    if block.type == 'text':
                        print(block.text)
            else:
                result = await session.call_tool(sys.argv[1], json.loads(sys.argv[2]) if len(sys.argv) > 2 else {})
                for block in result.content:
                    if block.type == 'text':
                        print(block.text)

asyncio.run(main())
