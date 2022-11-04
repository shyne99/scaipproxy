##
## Builder
##
FROM adoptopenjdk/openjdk11:jdk-11.0.11_9-debian-slim as builder

COPY . /build/
WORKDIR /build

ENV GRAALVM_HOME "/build/graalvm-ce-java11-21.1.0"
SHELL ["/bin/bash", "-c"]

RUN apt-get update && apt-get install -y npm zip wget \
  && wget https://github.com/graalvm/graalvm-ce-builds/releases/download/vm-21.1.0/graalvm-ce-java11-linux-amd64-21.1.0.tar.gz \
  && tar -xzf graalvm-ce-java11-linux-amd64-21.1.0.tar.gz \
  && $GRAALVM_HOME/bin/gu install nodejs \
  && wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash \
  && source ~/.bashrc && nvm install 16 \
  && npm install --legacy-peer-deps && npm test && npm run distro

##
## Runner
##
FROM adoptopenjdk/openjdk11:jdk-11.0.11_9-debian-slim as runner
LABEL maintainer="Pedro Sanders <psanders@fonoster.com>"

ENV LANG C.UTF-8

RUN mkdir -p /opt/scaipproxy
WORKDIR /opt/scaipproxy

COPY --from=builder /build/scaipproxy-*_linux-x64_bin.tar.gz ./

RUN apt-get update && apt-get install curl iproute2 -y \
  && tar xvf scaipproxy-*_linux-x64_bin.tar.gz \
  && cp -a scaipproxy-*_linux-x64_bin/* . \
  && rm -rf scaipproxy-*_linux-x64_bin scaipproxy-*_linux-x64_bin.tar.gz \
  && curl -qL -o /usr/bin/netdiscover https://github.com/CyCoreSystems/netdiscover/releases/download/v1.2.5/netdiscover.linux.amd64 \
  && chmod +x /usr/bin/netdiscover \
  && apt-get autoremove -y \
  && touch /.dockerenv

EXPOSE 4567
EXPOSE 5060/udp

CMD ["./scaipproxy"]

HEALTHCHECK --interval=30s --timeout=30s --retries=3 \
  CMD ["curl", "-k", "--fail", "--silent", "--show-error", "--connect-timeout", "5", "-L", "https://localhost:4567/api/v1beta1/system/status"]
