export const zhSidebar = {
  '/demo/': [
    {
      text: 'Demo',
      children: [
        {
          text: 'bar',
          link: '/demo/bar',
        },
        {
          text: 'foo',
          link: '/demo/foo',
        }
      ]
    }
  ],
  '/notes/linux/': [
    {
      text: 'Linux 学习笔记',
      children: [
        {
          text: '命令',
          link: '/notes/linux/command/',
        },
        {
          text: '操作系统',
          link: '/notes/linux/os/',
        }
      ]
    }
  ],
  '/notes/kubernetes/': [
    {
      text: 'Kubernetes 学习笔记',
      children: [
        {
          text: '命令',
          link: '/notes/kubernetes/command/',
        },
        {
          text: '部署',
          link: '/notes/kubernetes/deploy/',
        }
      ]
    }
  ]
}
