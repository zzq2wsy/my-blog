---
title: kubeadm 部署
createTime: 2025/01/01 10:00:00
permalink: /notes/kubernetes/deploy/kubeadm/
---

# kubeadm 部署
## 1. 环境说明
| 项目 | 说明 |
| --- | --- |
| 操作系统 | Ubuntu 22.04 |
| Kubernetes | v1.32.5 |
| 容器运行时 | containerd |
| 网络插件 | Cilium 1.17.4 |
| 存储 | NVMe + LVM |


## 2. DNS 与系统解析配置
### 2.1 配置 systemd-resolved
```bash
vim /etc/systemd/resolved.conf
```

> 根据实际环境配置 DNS（内网 DNS、企业 DNS）
>

```bash
systemctl restart systemd-resolved.service
resolvectl status
```

+ 避免 kubelet / containerd / CoreDNS 出现 DNS 不一致问题
+ 生产环境必须明确 DNS 来源

## 3. 清理历史 Ceph / RAID / LVM 痕迹
### 3.1 清理旧 Rook/Ceph LVM
```bash
lvremove /dev/rook/rookdata2 /dev/rook/rookdata1 /dev/rook/rookmonitor
vgremove rook
```

+ 确保节点不残留旧 OSD / Monitor 元数据
+ 防止 rook-ceph 重建失败或误识别旧盘

### 3.2 停止遗留 mdraid
```bash
mdadm -S /dev/md127
```

### 3.3 擦除 NVMe RAID 超级块
```bash
mdadm --zero-superblock /dev/nvme0n1
mdadm --zero-superblock /dev/nvme1n1
mdadm --zero-superblock /dev/nvme2n1
mdadm --zero-superblock /dev/nvme3n1
```

+ 防止系统启动时自动 RAID
+ 防止 LVM / Ceph / Rook 误判磁盘状态

## 4. LVM 存储规划与初始化
### 4.1 创建卷组（VG）
```bash
# 如果是新的存储
# pvcreate /dev/nvme0n1 /dev/nvme3n1 /dev/nvme1n1 /dev/nvme2n1
vgcreate -s 32M lvm4002 \
  /dev/nvme0n1 /dev/nvme3n1 /dev/nvme1n1 /dev/nvme2n1

# 可优化
# nvme0,nvme1 → vg-system
#   ├─ containerd
#   ├─ juicefs
# nvme2,nvme3 → vg-ceph
#   └─ rookdata（裸）
# vgcreate -s 32M vg-system /dev/nvme0n1  /dev/nvme1n1
# vgcreate -s 32M vg-ceph /dev/nvme2n1 /dev/nvme3n1
```

+ `-s 32M`：PE 大小 32MB，适合 TB 级大盘，减少元数据数量

### 4.2 创建逻辑卷（LV）
```bash
lvcreate -y -L 900G  -n containerd   lvm4002
lvcreate -y -L 200G  -n juicefs     lvm4002
lvcreate -y -L 30G   -n rookmonitor lvm4002
lvcreate -y -L 5130G -n rookdata    lvm4002
```

| LV | 用途 | 说明 |
| --- | --- | --- |
| containerd | 容器数据 | overlay2 / 镜像层 |
| rookmonitor | Ceph Monitor | 特殊规划 |
| rookdata | Ceph OSD | **裸设备，禁止格式化** |
| juicefs | JuiceFS Cache | 本地缓存 |


### 4.3 格式化（仅限非 Ceph 盘）
```bash
mkfs.ext4 /dev/mapper/lvm4002-containerd
mkfs.ext4 /dev/mapper/lvm4002-juicefs
mkfs.xfs  /dev/mapper/lvm4002-rookmonitor
```

+ `rookdata` **禁止 mkfs**
+ Ceph OSD 必须使用裸块设备

### 4.4 挂载与 fstab
```bash
echo "/dev/mapper/lvm4002-containerd /containerd ext4 defaults 0 0" >> /etc/fstab
echo "/dev/mapper/lvm4002-juicefs    /var/jfsCache ext4 defaults 0 0" >> /etc/fstab

# 可优化
# fstab 用 UUID，避免盘符漂移
# blkid /dev/mapper/lvm4002-containerd
# blkid /dev/mapper/lvm4002-juicefs
# echo "UUID=xxxx   /containerd ext4 defaults 0 0" >> /etc/fstab
# echo "UUID=yyyy   /var/jfsCache ext4 defaults 0 0" >> /etc/fstab
```

```bash
mkdir /containerd /var/jfsCache
chmod 711 /containerd
mount -a
```

## 5. 关闭 Swap
```bash
sed -i -E '/\s+swap\s+/ s/^/#/' /etc/fstab
swapoff -a
```

## 6. 换源与 Kubernetes 仓库配置
```bash
cat > /etc/apt/sources.list <<EOF
deb https://mirrors.aliyun.com/ubuntu/ jammy main restricted universe multiverse
deb-src https://mirrors.aliyun.com/ubuntu/ jammy main restricted universe multiverse

deb https://mirrors.aliyun.com/ubuntu/ jammy-security main restricted universe multiverse
deb-src https://mirrors.aliyun.com/ubuntu/ jammy-security main restricted universe multiverse

deb https://mirrors.aliyun.com/ubuntu/ jammy-updates main restricted universe multiverse
deb-src https://mirrors.aliyun.com/ubuntu/ jammy-updates main restricted universe multiverse

deb https://mirrors.aliyun.com/ubuntu/ jammy-backports main restricted universe multiverse
deb-src https://mirrors.aliyun.com/ubuntu/ jammy-backports main restricted universe multiverse

# Kubernetes v1.32
deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] \
https://mirrors.aliyun.com/kubernetes-new/core/stable/v1.32/deb/ /
EOF
```

```bash
curl -fsSL https://mirrors.aliyun.com/kubernetes-new/core/stable/v1.32/deb/Release.key \
| gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
```

## 7. 安装基础组件
```bash
apt update && apt install -y \
  lvm2 \
  kubelet=1.32.5-1.1 \
  kubeadm=1.32.5-1.1 \
  kubectl=1.32.5-1.1 \
  python3 \
  containerd \
  nfs-common
```

## 8. 内核模块与系统参数
### 8.1 加载模块
```bash
cat > /etc/modules-load.d/k8s.conf <<EOF
br_netfilter
EOF
```

### 8.2 sysctl 参数
```bash
cat > /etc/sysctl.d/k8s.conf <<EOF
fs.inotify.max_user_instances = 8192
net.bridge.bridge-nf-call-ip6tables = 1
net.bridge.bridge-nf-call-iptables = 1
net.ipv4.ip_forward = 1
EOF

# fs.inotify.max_user_instances = 8192 为了解决Too many open files
# 提升系统中每个用户（UID）可创建的 inotify 实例数的上限
# K8s节点上会运行数百个Pod/容器，每个容器/组件都可能创建 inotify 实例，默认值会快速耗尽
```

```bash
sysctl --system
```

## 9. containerd 配置
### 9.1 生成默认配置
```bash
mkdir /etc/containerd
containerd config default > /etc/containerd/config.toml
```

### 9.2 修改关键参数
```bash
# 数据目录迁移到独立磁盘
sed -i -Ee 's#^root = "/var/lib/containerd"#root = "/containerd/lib"#' /etc/containerd/config.toml
sed -i -Ee 's#^state = "/run/containerd"#state = "/containerd/run"#' /etc/containerd/config.toml

# 使用 systemd cgroup
sed -i -Ee 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml

# 更新 pause 镜像版本
sed -i -Ee 's#pause:3.8#pause:3.10#' /etc/containerd/config.toml
```

```bash
systemctl enable containerd kubelet
systemctl restart containerd kubelet
```

## 10. 初始化 Kubernetes 集群
```bash
kubeadm init \
  --kubernetes-version=v1.32.5 \
  --upload-certs \
  --control-plane-endpoint a28-control.host.cnconti.tech:6443
```

## 11. 安装 Helm
```bash
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
# helm version
```

## 12. 安装 Cilium 网络插件
```bash
helm install cilium cilium \
  --namespace kube-system \
  --repo https://helm.cilium.io/ \
  --version 1.17.4 \
  --set ipv4NativeRoutingCIDR=172.24.0.0/14 \
  --set ipam.operator.clusterPoolIPv4PodCIDRList=172.24.0.0/14
```

| 参数 | 说明 |
| --- | --- |
| ipv4NativeRoutingCIDR | 节点间直路由 CIDR |
| clusterPoolIPv4PodCIDRList | Pod IP 地址池 |
| 1.17.4 | K8s 1.32 兼容 |


