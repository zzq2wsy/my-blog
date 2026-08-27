# Blwsyed Blog

访问地址：[https://blog.blwsyed.top/](https://blog.blwsyed.top/)

本站使用 [VuePress](https://vuepress.vuejs.org/) + [vuepress-theme-plume](https://github.com/pengzhanbo/vuepress-theme-plume) 构建，内容逐渐完善中...

## 环境要求

- Node.js >= 20.6.0 或 >= 22.0.0
- pnpm >= 10

## 安装与运行

```shell
# 安装依赖
pnpm i

# 本地开发
pnpm docs:dev

# 生产构建
pnpm docs:build

# 本地预览构建产物
pnpm docs:preview
```

## 部署

本博客通过 GitHub Pages 部署，推送至 `main` 分支后会自动触发 `.github/workflows/deploy.yml` 工作流，构建并发布到 `gh-pages` 分支。
