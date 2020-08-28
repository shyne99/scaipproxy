
Install Nginx Controller, then Patch the deployment and service:

```
kubectl patch configmap udp-services -n kube-system --patch '{"data":{"5060":"default/vitalint-routr-sipudp:5060"}}'
kubectl patch configmap tcp-services -n kube-system --patch '{"data":{"5060":"default/vitalint-routr-siptcp:5060"}}'
kubectl patch deployment ingress-nginx-controller --patch "$(cat ingress-nginx-controller-patch.yaml)" -n kube-system
```

-- ingress-nginx-controller-patch.yaml --

```
spec:
  template:
    spec:
      containers:
      - name: controller
        ports:
         - containerPort: 5060
           hostPort: 5060
           protocol: UDP
         - containerPort: 5060
           hostPort: 5060
           protocol: TCP           
```

Install the helm chart

```
helm install vitalint \
--set adminService.type=NodePort \
--set routr.externAddr=$(minikube ip) \
--set image.tag=1.0.0-edge-20200807 \
.helm/
```