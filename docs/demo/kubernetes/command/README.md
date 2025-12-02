---
title: Kubernetes 常用命令速查
createTime: 2025/01/01 10:00:00
permalink: /demo/kubernetes/command/
---

# Kubernetes 命令速查

Kubernetes 是容器编排的事实标准。作为运维人员，熟练掌握 kubectl 命令是管理 K8s 集群的基本功。

## 基础命令

### 集群信息

```bash
# 查看集群信息
kubectl cluster-info
kubectl cluster-info dump

# 查看集群版本
kubectl version
kubectl version --short

# 查看 API 版本
kubectl api-versions

# 查看 API 资源
kubectl api-resources
kubectl api-resources --namespaced=true   # 命名空间级别资源
kubectl api-resources --namespaced=false  # 集群级别资源

# 查看配置
kubectl config view
kubectl config get-contexts
kubectl config current-context

# 切换集群上下文
kubectl config use-context <context-name>

# 查看节点信息
kubectl get nodes
kubectl get nodes -o wide
kubectl describe node <node-name>
```

### 资源管理

#### 查看资源（get）

```bash
# 查看所有命名空间的资源
kubectl get all --all-namespaces
kubectl get all -A  # 简写

# 查看 Pod
kubectl get pods
kubectl get pods -n <namespace>
kubectl get pods -o wide  # 显示更多信息（节点、IP）
kubectl get pods -o yaml  # YAML 格式
kubectl get pods -o json  # JSON 格式
kubectl get pods --show-labels  # 显示标签
kubectl get pods -l app=nginx   # 按标签筛选
kubectl get pods --field-selector status.phase=Running  # 按字段筛选
kubectl get pods --sort-by=.metadata.creationTimestamp  # 排序

# 查看 Deployment
kubectl get deployments
kubectl get deploy -n <namespace>
kubectl get deploy -o wide

# 查看 Service
kubectl get services
kubectl get svc -n <namespace>

# 查看 ConfigMap
kubectl get configmap
kubectl get cm -n <namespace>

# 查看 Secret
kubectl get secrets
kubectl get secret -n <namespace>

# 查看 Ingress
kubectl get ingress
kubectl get ing -n <namespace>

# 查看 PV/PVC
kubectl get pv
kubectl get pvc
kubectl get pvc -n <namespace>

# 查看事件
kubectl get events
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
```

#### 详细信息（describe）

```bash
# 查看 Pod 详细信息
kubectl describe pod <pod-name>
kubectl describe pod <pod-name> -n <namespace>

# 查看 Node 详细信息
kubectl describe node <node-name>

# 查看 Deployment 详细信息
kubectl describe deployment <deployment-name> -n <namespace>

# 查看 Service 详细信息
kubectl describe svc <service-name> -n <namespace>
```

#### 创建和应用资源（create/apply）

```bash
# 从 YAML 文件创建资源
kubectl create -f <file.yaml>
kubectl create -f <directory>/  # 创建目录下所有资源

# 应用资源（创建或更新）
kubectl apply -f <file.yaml>
kubectl apply -f <directory>/
kubectl apply -f <url>  # 从 URL 应用

# 快速创建资源
kubectl create deployment nginx --image=nginx
kubectl create service clusterip my-svc --tcp=80:80
kubectl create configmap my-config --from-file=config.txt
kubectl create secret generic my-secret --from-literal=password=123456

# 创建命名空间
kubectl create namespace <namespace-name>
```

#### 删除资源（delete）

```bash
# 删除 Pod
kubectl delete pod <pod-name>
kubectl delete pod <pod-name> -n <namespace>
kubectl delete pod <pod-name> --force --grace-period=0  # 强制删除

# 删除 Deployment
kubectl delete deployment <deployment-name> -n <namespace>

# 删除 Service
kubectl delete service <service-name> -n <namespace>

# 从文件删除
kubectl delete -f <file.yaml>

# 删除所有资源
kubectl delete all --all -n <namespace>

# 删除命名空间
kubectl delete namespace <namespace-name>
```

#### 编辑资源（edit）

```bash
# 编辑 Pod
kubectl edit pod <pod-name> -n <namespace>

# 编辑 Deployment
kubectl edit deployment <deployment-name> -n <namespace>

# 编辑 ConfigMap
kubectl edit configmap <configmap-name> -n <namespace>
```

## 日志与调试

### 查看日志（logs）

```bash
# 查看 Pod 日志
kubectl logs <pod-name>
kubectl logs <pod-name> -n <namespace>

# 实时查看日志
kubectl logs -f <pod-name>
kubectl logs -f <pod-name> -n <namespace>

# 查看多容器 Pod 中特定容器的日志
kubectl logs <pod-name> -c <container-name>

# 查看之前容器的日志（容器重启后）
kubectl logs <pod-name> --previous

# 查看最近 N 行日志
kubectl logs <pod-name> --tail=100

# 查看指定时间范围的日志
kubectl logs <pod-name> --since=1h
kubectl logs <pod-name> --since-time=2024-01-01T10:00:00Z

# 查看所有 Pod 的日志（通过标签）
kubectl logs -l app=nginx
```

### 进入容器（exec）

```bash
# 进入 Pod 执行命令
kubectl exec <pod-name> -- <command>
kubectl exec <pod-name> -n <namespace> -- ls /app

# 交互式进入容器
kubectl exec -it <pod-name> -- /bin/bash
kubectl exec -it <pod-name> -- /bin/sh

# 多容器 Pod 指定容器
kubectl exec -it <pod-name> -c <container-name> -- /bin/bash
```

### 端口转发（port-forward）

```bash
# 转发 Pod 端口到本地
kubectl port-forward <pod-name> 8080:80
kubectl port-forward <pod-name> 8080:80 -n <namespace>

# 转发 Service 端口
kubectl port-forward svc/<service-name> 8080:80

# 绑定所有网卡（允许外部访问）
kubectl port-forward --address 0.0.0.0 <pod-name> 8080:80
```

### 复制文件（cp）

```bash
# 从 Pod 复制文件到本地
kubectl cp <pod-name>:/path/to/file ./local-file
kubectl cp <namespace>/<pod-name>:/path/to/file ./local-file

# 从本地复制文件到 Pod
kubectl cp ./local-file <pod-name>:/path/to/file

# 多容器 Pod 指定容器
kubectl cp <pod-name>:/path/to/file ./local-file -c <container-name>
```

### 资源监控（top）

```bash
# 查看节点资源使用情况
kubectl top nodes

# 查看 Pod 资源使用情况
kubectl top pods
kubectl top pods -n <namespace>
kubectl top pods --containers  # 显示容器级别
kubectl top pods -l app=nginx   # 按标签筛选
```

## Deployment 管理

### 创建和更新

```bash
# 创建 Deployment
kubectl create deployment nginx --image=nginx:1.19

# 更新镜像
kubectl set image deployment/nginx nginx=nginx:1.20
kubectl set image deployment/nginx nginx=nginx:1.20 -n <namespace>

# 编辑 Deployment
kubectl edit deployment nginx

# 从文件更新
kubectl apply -f deployment.yaml
```

### 扩缩容

```bash
# 手动扩缩容
kubectl scale deployment nginx --replicas=5
kubectl scale deployment nginx --replicas=5 -n <namespace>

# 自动扩缩容
kubectl autoscale deployment nginx --min=2 --max=10 --cpu-percent=80
```

### 滚动更新

```bash
# 查看更新状态
kubectl rollout status deployment/nginx

# 查看更新历史
kubectl rollout history deployment/nginx
kubectl rollout history deployment/nginx --revision=2

# 暂停更新
kubectl rollout pause deployment/nginx

# 恢复更新
kubectl rollout resume deployment/nginx

# 回滚到上一个版本
kubectl rollout undo deployment/nginx

# 回滚到指定版本
kubectl rollout undo deployment/nginx --to-revision=2

# 重启 Deployment（重建所有 Pod）
kubectl rollout restart deployment/nginx
```

## ConfigMap 和 Secret

### ConfigMap 管理

```bash
# 从文件创建 ConfigMap
kubectl create configmap my-config --from-file=config.txt
kubectl create configmap my-config --from-file=config-dir/

# 从字面值创建
kubectl create configmap my-config --from-literal=key1=value1 --from-literal=key2=value2

# 查看 ConfigMap
kubectl get configmap my-config -o yaml

# 编辑 ConfigMap
kubectl edit configmap my-config

# 删除 ConfigMap
kubectl delete configmap my-config
```

### Secret 管理

```bash
# 从文件创建 Secret
kubectl create secret generic my-secret --from-file=secret.txt

# 从字面值创建
kubectl create secret generic my-secret --from-literal=username=admin --from-literal=password=123456

# 创建 Docker Registry Secret
kubectl create secret docker-registry my-registry-secret \
    --docker-server=registry.example.com \
    --docker-username=user \
    --docker-password=pass \
    --docker-email=user@example.com

# 创建 TLS Secret
kubectl create secret tls my-tls-secret --cert=tls.crt --key=tls.key

# 查看 Secret（base64 编码）
kubectl get secret my-secret -o yaml

# 解码 Secret
kubectl get secret my-secret -o jsonpath='{.data.password}' | base64 --decode
```

## 存储管理

### PersistentVolume (PV)

```bash
# 查看 PV
kubectl get pv
kubectl get pv -o wide
kubectl describe pv <pv-name>

# 创建 PV
kubectl apply -f pv.yaml

# 删除 PV
kubectl delete pv <pv-name>
```

### PersistentVolumeClaim (PVC)

```bash
# 查看 PVC
kubectl get pvc
kubectl get pvc -n <namespace>
kubectl describe pvc <pvc-name> -n <namespace>

# 创建 PVC
kubectl apply -f pvc.yaml

# 删除 PVC
kubectl delete pvc <pvc-name> -n <namespace>
```

## 节点管理

### 节点操作

```bash
# 查看节点
kubectl get nodes
kubectl get nodes -o wide
kubectl describe node <node-name>

# 标记节点不可调度（维护模式）
kubectl cordon <node-name>

# 恢复节点可调度
kubectl uncordon <node-name>

# 驱逐节点上的所有 Pod（优雅关闭）
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# 给节点打标签
kubectl label nodes <node-name> disktype=ssd

# 删除节点标签
kubectl label nodes <node-name> disktype-

# 节点污点管理
# 设置污点
kubectl taint nodes <node-name> key=value:NoSchedule
kubectl taint nodes <node-name> key=value:NoExecute
kubectl taint nodes <node-name> key=value:PreferNoSchedule

# 查看污点
kubectl describe node <node-name> | grep Taints

# 删除污点
kubectl taint nodes <node-name> key:NoSchedule-
```

## 网络与服务

### Service 管理

```bash
# 创建 Service
kubectl create service clusterip my-svc --tcp=80:80
kubectl create service nodeport my-svc --tcp=80:80 --node-port=30080
kubectl create service loadbalancer my-svc --tcp=80:80

# 暴露 Deployment 为 Service
kubectl expose deployment nginx --port=80 --target-port=8080 --type=ClusterIP
kubectl expose deployment nginx --port=80 --type=NodePort
kubectl expose deployment nginx --port=80 --type=LoadBalancer

# 查看 Service 端点
kubectl get endpoints
kubectl get endpoints <service-name> -n <namespace>

# 查看 Service 详细信息
kubectl describe svc <service-name>
```

### Ingress 管理

```bash
# 查看 Ingress
kubectl get ingress
kubectl get ing -n <namespace>
kubectl describe ing <ingress-name> -n <namespace>

# 创建 Ingress
kubectl apply -f ingress.yaml

# 删除 Ingress
kubectl delete ing <ingress-name> -n <namespace>
```

### 网络调试

```bash
# 测试 DNS 解析
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup kubernetes.default
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup <service-name>.<namespace>.svc.cluster.local

# 测试连通性
kubectl run -it --rm debug --image=busybox --restart=Never -- wget -O- <service-name>
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- curl <service-name>

# 查看 Pod IP
kubectl get pod <pod-name> -o jsonpath='{.status.podIP}'

# 查看 Service ClusterIP
kubectl get svc <service-name> -o jsonpath='{.spec.clusterIP}'
```

## RBAC 权限管理

### ServiceAccount

```bash
# 创建 ServiceAccount
kubectl create serviceaccount my-sa -n <namespace>

# 查看 ServiceAccount
kubectl get serviceaccount -n <namespace>
kubectl describe sa my-sa -n <namespace>

# 查看 ServiceAccount Token
kubectl get secret $(kubectl get sa my-sa -n <namespace> -o jsonpath='{.secrets[0].name}') -n <namespace> -o jsonpath='{.data.token}' | base64 --decode
```

### Role 和 RoleBinding

```bash
# 创建 Role
kubectl create role pod-reader --verb=get,list,watch --resource=pods -n <namespace>

# 创建 RoleBinding
kubectl create rolebinding pod-reader-binding --role=pod-reader --serviceaccount=<namespace>:my-sa -n <namespace>

# 查看 Role
kubectl get role -n <namespace>
kubectl describe role pod-reader -n <namespace>

# 查看 RoleBinding
kubectl get rolebinding -n <namespace>
kubectl describe rolebinding pod-reader-binding -n <namespace>
```

### ClusterRole 和 ClusterRoleBinding

```bash
# 创建 ClusterRole
kubectl create clusterrole node-reader --verb=get,list,watch --resource=nodes

# 创建 ClusterRoleBinding
kubectl create clusterrolebinding node-reader-binding --clusterrole=node-reader --serviceaccount=default:my-sa

# 查看 ClusterRole
kubectl get clusterrole
kubectl describe clusterrole node-reader

# 查看 ClusterRoleBinding
kubectl get clusterrolebinding
kubectl describe clusterrolebinding node-reader-binding
```

### 权限检查

```bash
# 检查当前用户权限
kubectl auth can-i create pods
kubectl auth can-i delete deployments --namespace=default
kubectl auth can-i '*' '*'  # 检查是否有所有权限

# 检查其他用户权限
kubectl auth can-i create pods --as=user1
kubectl auth can-i delete deployments --as=system:serviceaccount:default:my-sa
```

## 故障排查

### Pod 故障排查

```bash
# 查看 Pod 状态
kubectl get pod <pod-name> -o wide
kubectl describe pod <pod-name>

# 查看 Pod 事件
kubectl get events --field-selector involvedObject.name=<pod-name>

# 查看 Pod 日志
kubectl logs <pod-name>
kubectl logs <pod-name> --previous  # 查看重启前的日志

# 进入 Pod 调试
kubectl exec -it <pod-name> -- /bin/bash

# 检查 Pod 资源使用
kubectl top pod <pod-name>

# 查看 Pod YAML 配置
kubectl get pod <pod-name> -o yaml
```

### 常见问题排查

```bash
# Pod 一直处于 Pending 状态
kubectl describe pod <pod-name>  # 查看事件，通常是资源不足或调度问题
kubectl get nodes  # 检查节点状态
kubectl top nodes  # 检查资源使用情况

# Pod 一直处于 CrashLoopBackOff 状态
kubectl logs <pod-name>  # 查看容器日志
kubectl logs <pod-name> --previous  # 查看上一次崩溃的日志
kubectl describe pod <pod-name>  # 查看退出原因

# Pod 一直处于 ImagePullBackOff 状态
kubectl describe pod <pod-name>  # 查看镜像拉取失败原因
kubectl get secret  # 检查镜像仓库凭证

# 查看节点资源压力
kubectl describe node <node-name> | grep -A 5 "Conditions:"

# 查看集群事件
kubectl get events --sort-by='.lastTimestamp'
```

## 实用技巧

### 批量操作

```bash
# 删除所有 Evicted 的 Pod
kubectl get pods -A | grep Evicted | awk '{print $2 " --namespace=" $1}' | xargs kubectl delete pod

# 删除所有 Completed 的 Pod
kubectl delete pods --field-selector=status.phase==Succeeded -A

# 批量重启 Deployment
kubectl get deployments -n <namespace> -o name | xargs -I {} kubectl rollout restart {} -n <namespace>

# 查看所有容器镜像
kubectl get pods -A -o jsonpath="{.items[*].spec.containers[*].image}" | tr -s '[[:space:]]' '\n' | sort | uniq
```

### 使用 JSONPath

```bash
# 获取 Pod IP
kubectl get pod <pod-name> -o jsonpath='{.status.podIP}'

# 获取所有 Pod 名称和 IP
kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.podIP}{"\n"}{end}'

# 获取节点资源容量
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.capacity.cpu}{"\t"}{.status.capacity.memory}{"\n"}{end}'

# 获取 Service 的 ClusterIP 和 Port
kubectl get svc -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.clusterIP}{"\t"}{.spec.ports[0].port}{"\n"}{end}'
```

### 自动补全

```bash
# Bash 自动补全
source <(kubectl completion bash)
echo "source <(kubectl completion bash)" >> ~/.bashrc

# Zsh 自动补全
source <(kubectl completion zsh)
echo "source <(kubectl completion zsh)" >> ~/.zshrc

# 设置别名
alias k=kubectl
complete -F __start_kubectl k
```

---

*持续更新中...*