import type { ThemeSidebarMulti } from 'vuepress-theme-plume'

// doc 类型的 collection 已经在 collections.ts 中通过 sidebar: 'auto' 配置了侧边栏，
// 这里不要再重复配置相同的路径，避免配置冲突导致侧边栏和路由注册异常。
// 如果后续有其他非 collection 的文档路径需要自定义侧边栏，在此处添加。
export const zhSidebar: ThemeSidebarMulti = {
}