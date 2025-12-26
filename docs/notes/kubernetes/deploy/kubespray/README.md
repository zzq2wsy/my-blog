---
title: Kubespray 部署
createTime: 2025/01/01 10:00:00
permalink: /notes/kubernetes/deploy/kubespray/
---

# Kubespray 部署
+ 操作系统：Ubuntu 22.04
+ Kubespray 版本：v2.28.1
+ Kubernetes 安装方式：容器化安装和本地Ansible安装

## 一、前置准备
### 1. 节点免密登录
```bash
ssh-keygen -t rsa
for host in 192.168.100.107 192.168.100.112 192.168.100.117 192.168.100.118; do
  ssh-copy-id root@$host
done
```

+ Kubespray 通过 Ansible 以 SSH 方式批量管理节点
+ 免密是必需条件，否则 Playbook 会在首个任务失败

### 2. 基础网络与排障工具
```bash
apt update && apt install -y iputils-ping dnsutils telnet net-tools
```

+ 不影响集群运行，仅用于运维与排障

### 3. 关闭 Swap
```bash
swapoff -a && sed -i -E '/\s+swap\s+/ s/^/#/' /etc/fstab
```

+ kubelet 在默认配置下拒绝在开启 swap 的节点启动
+ Kubespray 会再次校验，但这里提前处理避免失败

### 4. systemd-resolved 配置
```bash
vim /etc/systemd/resolved.conf
systemctl restart systemd-resolved.service
resolvectl status
```

+ 确保宿主机 DNS 正常
+ 为后续容器镜像拉取、NTP、外部依赖提供基础

### 5. 为 containerd 与业务数据准备存储
```bash
pvcreate /dev/sdb
vgcreate lvm-vg /dev/sdb

lvcreate -n containerd -L 100G lvm-vg
lvcreate -n data -L 200G lvm-vg

mkfs.ext4 /dev/lvm-vg/containerd
mkfs.ext4 /dev/lvm-vg/data

mkdir -p /containerd /data
chmod 711 /containerd

echo '/dev/lvm-vg/containerd /containerd ext4 defaults 0 0' >> /etc/fstab
echo '/dev/lvm-vg/data /data ext4 defaults 0 0' >> /etc/fstab

mount -a

# 可优化项
# 1. fstab 用 UUID，避免盘符漂移
# blkid /dev/lvm-vg/containerd
# blkid /dev/lvm-vg/data
# echo 'UUID=xxxx  /containerd ext4 defaults 0 0' >> /etc/fstab
# echo 'UUID=yyyy  /data ext4 defaults 0 0' >> /etc/fstab

# 2. containerd 专用参数，减少 metadata IO（可选，未验证）
# /dev/lvm-vg/containerd /containerd ext4 defaults,noatime 0 0
```

+ `/containerd`：承载镜像层、容器层、快照，权限 711符合运行时最小权限原则
+ `/data`：业务数据、NFS 挂载目录
+ 与系统盘解耦，避免根分区被打满

### 6. 为 ceph-monitor 准备 local-static-provisioner 存储目录（可选）
```bash
# 每个 MON 节点执行
parted /dev/sdc --script mklabel gpt
parted /dev/sdc --script mkpart primary ext4 0% 100%
mkfs.ext4 /dev/sdc1

HOSTNAME=$(hostname)
mkdir -p /opt/local-static-provisioner/$HOSTNAME-volume-rook-ceph
mount /dev/sdc1 /opt/local-static-provisioner/$HOSTNAME-volume-rook-ceph

# 写入 fstab
# blkid /dev/sdc1
echo "/dev/sdc1 /opt/local-static-provisioner/zzq-k8s1-volume-rook-ceph ext4 defaults 0 2" >> /etc/fstab

# kubectl label node zzq-k8s1 rook-ceph.rook-monitor=
```

## 二、方式一：容器化 Kubespray 安装
+ 容器方式下，Kubespray 不会管理宿主机 NTP，需要**手动配置 chrony**

### 1. 时间同步（容器方式必须手动做）
```bash
# 安装chronyd
apt update && apt install -y chrony

# 停止并禁用默认的systemd-timesyncd（如果有，避免冲突）
systemctl stop systemd-timesyncd
systemctl disable systemd-timesyncd

# 启动并开机自启
systemctl start chrony && systemctl enable chrony

# 备份默认配置文件
cp /etc/chrony/chrony.conf /etc/chrony/chrony.conf.bak

# 重写配置文件，添加阿里云NTP源
cat <<EOF > /etc/chrony/chrony.conf
# This configuration is based on the NTP time synchronization scheme of kubespray. 
# For details, please refer to: (https://github.com/kubernetes-sigs/kubespray/blob/master/roles/kubernetes/preinstall/templates/chrony.conf.j2)

# Use public NTP servers (Aliyun)
server ntp.aliyun.com
server ntp1.aliyun.com

# Record the rate at which the system clock gains/losses time.
driftfile /var/lib/chrony/drift

# Allow the system clock to be stepped in the first three updates
# if its offset is larger than 1 second.
makestep 1.0 3

# Enable kernel synchronization of the real-time clock (RTC).
rtcsync

# Specify directory for log files.
logdir /var/log/chrony
EOF

# 重启服务生效配置
systemctl restart chrony

# 验证
systemctl status chrony
chronyc sources
chronyc tracking
timedatectl
```

### 2. 准备容器运行时环境
```bash
apt update && apt install -y podman python3
CONTAINER_RUNTIME=podman
KUBESPRAY_IMAGE=m.daocloud.io/quay.io/kubespray/kubespray:v2.28.1
```

### 3. 初始化 Kubespray Inventory（复制安装模板）
```bash
KUBESPRAY_INSTALLATION_DIRECTORY=$HOME/kubespray-installation && mkdir -p $KUBESPRAY_INSTALLATION_DIRECTORY

$CONTAINER_RUNTIME run --rm \
  -v $KUBESPRAY_INSTALLATION_DIRECTORY:/kubespray-installation \
  -it $KUBESPRAY_IMAGE \
  /bin/cp -rfp /kubespray/inventory/sample /kubespray-installation/inventory
```

### 4. 配置 inventory.ini 节点信息
```bash
INVENTORY_DIRECTORY=$KUBESPRAY_INSTALLATION_DIRECTORY/inventory
vim $INVENTORY_DIRECTORY/inventory.ini
```

+ 定义 control-plane / etcd / worker

```bash
# This inventory describe a HA typology with stacked etcd (== same nodes as control plane)
# and 3 worker nodes
# See https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html
# for tips on building your # inventory

# Configure 'ip' variable to bind kubernetes services on a different ip than the default iface
# We should set etcd_member_name for etcd cluster. The node that are not etcd members do not need to set the value,
# or can set the empty string value.
[kube_control_plane]
# node1 ansible_host=95.54.0.12  # ip=10.3.0.1 etcd_member_name=etcd1
# node2 ansible_host=95.54.0.13  # ip=10.3.0.2 etcd_member_name=etcd2
# node3 ansible_host=95.54.0.14  # ip=10.3.0.3 etcd_member_name=etcd3
zzq-k8s1 ansible_host=192.168.100.107
zzq-k8s2 ansible_host=192.168.100.112
zzq-k8s3 ansible_host=192.168.100.117

[etcd:children]
kube_control_plane

[kube_node]
# node4 ansible_host=95.54.0.15  # ip=10.3.0.4
# node5 ansible_host=95.54.0.16  # ip=10.3.0.5
# node6 ansible_host=95.54.0.17  # ip=10.3.0.6
zzq-k8s4 ansible_host=192.168.100.118
```

### 5. 配置 kube-vip（控制平面高可用）
```yaml
sed -i -E 's/^kube_proxy_strict_arp: false/kube_proxy_strict_arp: true/g' $INVENTORY_DIRECTORY/group_vars/k8s_cluster/k8s-cluster.yml

cat << 'EOF' >> $INVENTORY_DIRECTORY/group_vars/k8s_cluster/k8s-cluster.yml
# -------------------------------------------------------------------
# kube-vip: Control Plane High Availability (Bare Metal / ARP mode)
# -------------------------------------------------------------------
# Enable kube-vip component
kube_vip_enabled: true

# Enable kube-vip for Kubernetes control-plane (apiserver HA)
kube_vip_controlplane_enabled: true

# Use ARP mode (recommended for bare metal / LAN)
kube_vip_arp_enabled: true

# Virtual IP address for kube-apiserver
kube_vip_address: 192.168.100.88

# Enable leader election to avoid ARP conflicts
kube_vip_leader_election: true
EOF
```

+ `kube_vip_enabled: true` 启用 kube-vip 组件本身
+ `kube_vip_controlplane_enabled: true` kube-apiserver 的高可用， control-plane场景  
+ `kube_vip_arp_enabled: true` 使用 **ARP 模式** 广播 VIP  
+ `kube_vip_address: 192.168.100.88` kube-apiserver 对外暴露的 **唯一虚拟 IP**
+ `kube_vip_leader_election: true` 使用 Kubernetes Lease 机制进行主备选举  

### 6. DNS、证书、containerd、镜像源配置
```bash
# 配置DNS
cat << 'EOF' >> $INVENTORY_DIRECTORY/group_vars/all/all.yml
upstream_dns_servers:
  - 223.5.5.5
  - 223.6.6.6
EOF

# 开启证书自动续期功能
sed -i -E 's/^auto_renew_certificates: false/auto_renew_certificates: true/g' $INVENTORY_DIRECTORY/group_vars/k8s_cluster/k8s-cluster.yml

# 配置 containerd 存储目录为 /containerd
sed -i -E 's@^# containerd_storage_dir: "/var/lib/containerd"@containerd_storage_dir: "/containerd"@g' $INVENTORY_DIRECTORY/group_vars/all/containerd.yml

# 使用 DaoCloud 镜像
# replace files_repo, kube_image_repo, gcr_image_repo, github_image_repo, docker_image_repo and quay_image_repo
sed -i 's@^# files_repo: .*@files_repo: "https://files.m.daocloud.io"@g' $INVENTORY_DIRECTORY/group_vars/all/offline.yml
sed -i 's@^# kube_image_repo: .*@kube_image_repo: "k8s.m.daocloud.io"@g' $INVENTORY_DIRECTORY/group_vars/all/offline.yml
sed -i 's@^# gcr_image_repo: .*@gcr_image_repo: "gcr.m.daocloud.io"@g' $INVENTORY_DIRECTORY/group_vars/all/offline.yml
sed -i 's@^# github_image_repo: .*@github_image_repo: "ghcr.m.daocloud.io"@g' $INVENTORY_DIRECTORY/group_vars/all/offline.yml
sed -i 's@^# docker_image_repo: .*@docker_image_repo: "docker.m.daocloud.io"@g' $INVENTORY_DIRECTORY/group_vars/all/offline.yml
sed -i 's@^# quay_image_repo: .*@quay_image_repo: "quay.m.daocloud.io"@g' $INVENTORY_DIRECTORY/group_vars/all/offline.yml
# uncomment lines with files_repo
sed -i -E '/# .*\{\{ files_repo/s/^# //g' $INVENTORY_DIRECTORY/group_vars/all/offline.yml
```

+ upstream_dns_servers：解决集群内 DNS 上游
+ auto_renew_certificates：避免 1 年后集群证书过期
+ DaoCloud 镜像源：解决国内网络问题

### 7. 执行安装
```bash
# you may have to retry several times to install kubernetes cluster successfully for the bad network
# 生产环境建议加 --network host 
# $CONTAINER_RUNTIME run --rm -it --network host
$CONTAINER_RUNTIME run --rm -it \
  -v $HOME/.ssh:/root/.ssh:ro \
  -v $INVENTORY_DIRECTORY:/kubespray-installation/inventory \
  $KUBESPRAY_IMAGE \
  ansible-playbook -i /kubespray-installation/inventory/inventory.ini --become --become-user=root cluster.yml
```

### 8. 解除 control-plane 污点（按需，测试环境）
```bash
kubectl taint nodes --all node-role.kubernetes.io/control-plane-
```

### 9. 重置集群（可选，如有需要）
```bash
$CONTAINER_RUNTIME run --rm \
  -v $HOME/.ssh:/root/.ssh:ro \
  -v $INVENTORY_DIRECTORY:/kubespray-installation/inventory \
  -it $KUBESPRAY_IMAGE \
  ansible-playbook -i /kubespray-installation/inventory/inventory.ini --become --become-user=root reset.yml
```

## 三、方式二：Git Clone 本地化安装
### 1. 克隆指定版本 Kubespray
```bash
git clone https://github.com/kubernetes-sigs/kubespray.git
cd kubespray
git checkout v2.28.1
```

+ 锁定 Kubespray 版本v2.28.1，对应k8s v1.32.8

### 2. 安装 Python 虚拟环境工具
```bash
apt update && apt install -y python3-venv python3-pip
```

+ Kubespray 使用 Ansible + Python 依赖
+ 官方推荐使用 venv 隔离依赖，避免污染系统 Python

### 3. 创建并进入 Python 虚拟环境
```bash
python3 -m venv venv
source venv/bin/activate
```

+ venv **只在安装/重置 集群时需要**
+ 日常的 Kubernetes 运维 **完全不依赖该虚拟环境**

### 4. 安装 Kubespray 依赖
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

+ requirements.txt 中包含 Ansible、Jinja2、netaddr 等，仅在当前 venv 中生效

### 5. 复制示例 Inventory
```bash
cp -rfp inventory/sample inventory/mycluster
INVENTORY_DIRECTORY=/root/kubespray/inventory/mycluster
vim inventory/mycluster/inventory.ini
```

+ mycluster 是自定义的集群配置目录

```plain
# This inventory describe a HA typology with stacked etcd (== same nodes as control plane)
# and 3 worker nodes
# See https://docs.ansible.com/ansible/latest/inventory_guide/intro_inventory.html
# for tips on building your # inventory

# Configure 'ip' variable to bind kubernetes services on a different ip than the default iface
# We should set etcd_member_name for etcd cluster. The node that are not etcd members do not need to set the value,
# or can set the empty string value.
[kube_control_plane]
# node1 ansible_host=95.54.0.12  # ip=10.3.0.1 etcd_member_name=etcd1
# node2 ansible_host=95.54.0.13  # ip=10.3.0.2 etcd_member_name=etcd2
# node3 ansible_host=95.54.0.14  # ip=10.3.0.3 etcd_member_name=etcd3
zzq-k8s1 ansible_host=192.168.100.107
zzq-k8s2 ansible_host=192.168.100.112
zzq-k8s3 ansible_host=192.168.100.117

[etcd:children]
kube_control_plane

[kube_node]
# node4 ansible_host=95.54.0.15  # ip=10.3.0.4
# node5 ansible_host=95.54.0.16  # ip=10.3.0.5
# node6 ansible_host=95.54.0.17  # ip=10.3.0.6
zzq-k8s4 ansible_host=192.168.100.118
```

### 6. kube-vip 配置
```yaml
sed -i -E 's/^kube_proxy_strict_arp: false/kube_proxy_strict_arp: true/g' $INVENTORY_DIRECTORY/group_vars/k8s_cluster/k8s-cluster.yml

cat << 'EOF' >> $INVENTORY_DIRECTORY/group_vars/k8s_cluster/k8s-cluster.yml
# -------------------------------------------------------------------
# kube-vip: Control Plane High Availability (Bare Metal / ARP mode)
# -------------------------------------------------------------------
# Enable kube-vip component
kube_vip_enabled: true

# Enable kube-vip for Kubernetes control-plane (apiserver HA)
kube_vip_controlplane_enabled: true

# Use ARP mode (recommended for bare metal / LAN)
kube_vip_arp_enabled: true

# Virtual IP address for kube-apiserver
kube_vip_address: 192.168.100.88

# Enable leader election to avoid ARP conflicts
kube_vip_leader_election: true
EOF
```

### 7. DNS 上游服务器
```bash
cat << 'EOF' >> $INVENTORY_DIRECTORY/group_vars/all/all.yml
upstream_dns_servers:
  - 223.5.5.5
  - 223.6.6.6
EOF
```

### 8. 启用 Kubespray 管理时间同步
```bash
sed -i -E \
  -e 's/^ntp_enabled: false/ntp_enabled: true/' \
  -e 's/^ntp_manage_config: false/ntp_manage_config: true/' \
  $INVENTORY_DIRECTORY/group_vars/all/all.yml

# 添加阿里云NTP源
vim $INVENTORY_DIRECTORY/group_vars/all/all.yml
```

```yaml
## NTP Settings
# Start the ntpd or chrony service and enable it at system boot.
ntp_enabled: true
ntp_manage_config: true
ntp_servers:
  - "ntp.aliyun.com iburst"
  - "ntp1.aliyun.com iburst"
```

### 9. containerd、镜像源配置
```bash
# 配置 containerd 存储目录为 /containerd
sed -i -E 's@^# containerd_storage_dir: "/var/lib/containerd"@containerd_storage_dir: "/containerd"@g' $INVENTORY_DIRECTORY/group_vars/all/containerd.yml

# 使用 DaoCloud 镜像
# replace files_repo, kube_image_repo, gcr_image_repo, github_image_repo, docker_image_repo and quay_image_repo
sed -i 's@^# files_repo: .*@files_repo: "https://files.m.daocloud.io"@g' $INVENTORY_DIRECTORY/group_vars/all/offline.yml
sed -i 's@^# kube_image_repo: .*@kube_image_repo: "k8s.m.daocloud.io"@g' $INVENTORY_DIRECTORY/group_vars/all/offline.yml
sed -i 's@^# gcr_image_repo: .*@gcr_image_repo: "gcr.m.daocloud.io"@g' $INVENTORY_DIRECTORY/group_vars/all/offline.yml
sed -i 's@^# github_image_repo: .*@github_image_repo: "ghcr.m.daocloud.io"@g' $INVENTORY_DIRECTORY/group_vars/all/offline.yml
sed -i 's@^# docker_image_repo: .*@docker_image_repo: "docker.m.daocloud.io"@g' $INVENTORY_DIRECTORY/group_vars/all/offline.yml
sed -i 's@^# quay_image_repo: .*@quay_image_repo: "quay.m.daocloud.io"@g' $INVENTORY_DIRECTORY/group_vars/all/offline.yml
# uncomment lines with files_repo
sed -i -E '/# .*\{\{ files_repo/s/^# //g' $INVENTORY_DIRECTORY/group_vars/all/offline.yml
```

### 10. 安装集群
```bash
ansible-playbook \
  -i inventory/mycluster/inventory.ini \
  --become --become-user=root \
  cluster.yml

# 退出虚拟环境（可选）
deactivate
```

+ 安装成功后可以 **退出 venv**
+ 只有在执行 `cluster.yml / reset.yml` 时才需要重新进入 venv

### 11. 重置集群（可选，如有需要）
```bash
source venv/bin/activate

ansible-playbook \
  -i inventory/mycluster/inventory.ini \
  --become --become-user=root \
  reset.yml

deactivate
```

## 四、两种方式的本质区别总结
| 维度 | 容器方式 | Git Clone 方式 |
| --- | --- | --- |
| Python/Ansible | 在容器内 | 在宿主机 venv |
| NTP | 需手动 | Kubespray 管理 |
| 环境污染 | 无 | 有（可控） |
| 生产推荐 | 是 | 是 |


