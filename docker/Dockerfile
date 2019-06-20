FROM ubuntu:18.04

RUN apt-get update && apt-get install -y --no-install-recommends openjdk-11-jdk
RUN apt-get install -qq -y curl && \
    (curl -fsL https://deb.nodesource.com/setup_10.x | bash -) && \
    apt-get install -y nodejs openjdk-11-jre build-essential
