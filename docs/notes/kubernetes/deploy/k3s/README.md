---
title: K3s 部署
createTime: 2025/8/02 12:00:00
permalink: /notes/kubernetes/deploy/k3s/
---

# K3s 部署
## 一、前置条件
1. 所有节点具备互联网访问能力
2. 操作需 **root 权限** 或 sudo 权限
3. 硬件资源要求：参考 [K3s 官方硬件要求](https://docs.k3s.io/installation/requirements)（最低 1 CPU、512MB 内存、10GB 磁盘）。
4. 规划节点：假设共 4 个节点，主机名与 IP 如下（需根据实际环境修改 IP）：

| IP 地址 | 主机名 | 角色 |
| --- | --- | --- |
| 192.168.1.104 | k3s1 | 控制平面（主节点） |
| 192.168.1.105 | k3s2 | 工作节点 |
| 192.168.1.106 | k3s3 | 工作节点 |
| 192.168.1.107 | k3s4 | 工作节点 |


## 二、初始化节点基础配置（所有节点执行）
### 1. 设置主机名
分别在 4 个节点执行以下命令，替换 `<hostname>` 为对应主机名（k3s1/k3s2/k3s3/k3s4）：

```bash
hostnamectl set-hostname k3s1
hostnamectl set-hostname k3s2
hostnamectl set-hostname k3s3
hostnamectl set-hostname k3s4
```

### 2. 配置 /etc/hosts（域名解析）
所有节点执行以下命令，添加节点 IP 与主机名的映射（需根据实际 IP 修改）：

```bash
cat >> /etc/hosts << EOF
192.168.1.104 k3s1
192.168.1.105 k3s2
192.168.1.106 k3s3
192.168.1.107 k3s4
EOF
```

### 3. 配置容器镜像加速器（所有节点执行）
创建 K3s 镜像仓库配置文件，加速 docker.io 镜像拉取：

```bash
mkdir -p /etc/rancher/k3s

cat > /etc/rancher/k3s/registries.yaml << EOF
mirrors:
  docker.io:
    endpoint:
      - "https://dockerproxy.net"
EOF
```

## 三、部署 K3s 集群
### 1. 初始化第一个控制平面
执行以下命令安装 K3s 控制平面，启用 VXLAN 网络模式，并为控制平面添加污点（避免普通 Pod 调度到控制平面）：

```bash
curl -sfL https://rancher-mirror.rancher.cn/k3s/k3s-install.sh | INSTALL_K3S_MIRROR=cn sh -s - server --cluster-init --flannel-backend=vxlan --node-taint "node-role.kubernetes.io/control-plane=true:NoSchedule"
```

+ **参数说明**：
    - `INSTALL_K3S_MIRROR=cn`：使用国内镜像源，加速安装。
    - `--cluster-init`：初始化集群（支持后续添加高可用控制平面）。
    - `--flannel-backend=vxlan`：使用 VXLAN 作为网络插件（跨节点容器通信）。
    - `--node-taint`：为控制平面添加污点，仅允许有对应容忍的 Pod 调度。

### 2. 获取集群加入令牌
控制平面初始化完成后，查看并记录节点加入令牌（后续工作节点需用此令牌加入集群）：

```bash
cat /var/lib/rancher/k3s/server/node-token
```

### 3. 部署工作节点（在 k3s2、k3s3、k3s4 节点执行）
替换 `<join-token>` 为步骤 2 中获取的令牌，执行以下命令安装 K3s 工作节点并加入集群：

```bash
curl -sfL https://rancher-mirror.rancher.cn/k3s/k3s-install.sh | INSTALL_K3S_MIRROR=cn K3S_URL=https://k3s1:6443 K3S_TOKEN=<join-token> sh -
```

+ **参数说明**：
    - `K3S_URL`：指向控制平面地址（k3s1 的 6443 端口，K3s API Server 默认端口）。
    - `K3S_TOKEN`：集群加入令牌，确保工作节点认证通过。

### 4. 配置 kubectl 客户端
将 K3s 集群配置文件复制到当前用户目录，确保普通用户可使用 kubectl 操作集群：

```bash
mkdir -p $HOME/.kube

cp /etc/rancher/k3s/k3s.yaml $HOME/.kube/config
```

### 5. 验证集群状态
执行以下命令确认集群节点是否正常：

```bash
kubectl get nodes

kubectl -n kube-system get pods 
```

## 四、卸载 K3s 集群
### 1. 移除工作节点（从集群中删除 k3s2/k3s3/k3s4）
#### 步骤 1：标记节点为不可调度
防止新 Pod 调度到待删除的工作节点（替换 `<node-name>` 为实际节点名，如 k3s2）：

```bash
kubectl cordon <node-name>
# 示例：kubectl cordon k3s2
```

#### 步骤 2：驱逐节点上的 Pod
将节点上的 Pod 迁移到其他节点（忽略 DaemonSet Pod，删除 EmptyDir 数据）：

```bash
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data
# 示例：kubectl drain k3s2 --ignore-daemonsets --delete-emptydir-data
# kubectl get pods -o wide --all-namespaces | grep <node-name>
```

#### 步骤 3：删除节点
从集群中移除节点：

```bash
kubectl delete node <node-name>
# 示例：kubectl delete node k3s2
```

#### 步骤 4：卸载工作节点的 K3s（在待删除的工作节点执行，如 k3s2）
停止 K3s 工作节点服务并卸载：

```bash
# 停止 k3s-agent 服务
systemctl stop k3s-agent

# 执行卸载脚本
/usr/local/bin/k3s-agent-uninstall.sh
/usr/local/bin/k3s-uninstall.sh
```

### 2. 卸载控制平面
停止 K3s 控制平面服务并卸载：

```bash
# 停止 k3s 服务
systemctl stop k3s

# 执行卸载脚本
/usr/local/bin/k3s-uninstall.sh
```


