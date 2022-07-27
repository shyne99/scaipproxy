#!/usr/bin/env bash

set -e

export SERVER_VERSION=$(node -e "console.log(require('./package.json').version)")

build_for_platform() {
  PLATFORM=$1

  BUILD_NAME="scaipproxy-$SERVER_VERSION""_$PLATFORM-x64_bin"
  # mkdir -p $BUILD_NAME/libs $BUILD_NAME/jre $BUILD_NAME/config $BUILD_NAME/etc
  mkdir -p $BUILD_NAME/libs $BUILD_NAME/config $BUILD_NAME/etc

  cp -a config/*.yml $BUILD_NAME/config
  cp -a config/stack.properties $BUILD_NAME/config/stack.properties
  cp -a etc/certs $BUILD_NAME/etc
  cp -a etc/schemas $BUILD_NAME/etc
  # cp -a etc/customjre/* $BUILD_NAME/jre
  cp libs/* $BUILD_NAME/libs
  cp scaipproxy $BUILD_NAME/
  cp README.md $BUILD_NAME/
  cp LICENSE $BUILD_NAME/

  tar -czvf $BUILD_NAME.tar.gz $BUILD_NAME
  zip -r $BUILD_NAME.zip $BUILD_NAME

  rm -rf $BUILD_NAME
}

build_for_platform 'linux'
