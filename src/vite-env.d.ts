/// <reference types="vite/client" />

interface Window {
  /**
   * 运行时注入的 API 地址（由 web 服务下发的 /config.js 设置）。
   * 前后端分离部署时，前端静态站和后端 API 不在同一个源，靠这个变量指向后端。
   */
  __NEBULA_API__?: string
}
