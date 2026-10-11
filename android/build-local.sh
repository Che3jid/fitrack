#!/bin/sh
set -eu

fittrack_android_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$fittrack_android_dir"

# Prefer the project-local tools when they have been installed on this Mac.
fittrack_java="$fittrack_android_dir/.toolchain/amazon-corretto-17.jdk/Contents/Home"
fittrack_sdk="$fittrack_android_dir/.toolchain/sdk"
if [ -d "$fittrack_java" ] && [ -d "$fittrack_sdk" ] \
    && [ -x "$fittrack_android_dir/.toolchain/gradle-9.4.1/bin/gradle" ]; then
    if [ "$#" -eq 0 ]; then set -- :app:assembleDebug; fi
    exec env JAVA_HOME="$fittrack_java" ANDROID_HOME="$fittrack_sdk" \
        ANDROID_USER_HOME="$fittrack_android_dir/.toolchain/android-user" \
        GRADLE_USER_HOME="$fittrack_android_dir/.gradle-user" \
        "$fittrack_android_dir/.toolchain/gradle-9.4.1/bin/gradle" "$@"
fi

if [ "$#" -eq 0 ]; then set -- :app:assembleDebug; fi
exec ./gradlew "$@"
