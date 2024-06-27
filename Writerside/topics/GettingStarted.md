# Getting Started

## Prerequisites

<tabs >
    <tab title="MacOS" >
        <h3>Docker</h3>
        Follow the <a href="https://docs.docker.com/desktop/install/mac-install">Desktop for Mac Official Installation Guide.</a> Download the installation file and run it.
        <h3>Install xcode-select</h3>
        Open your terminal and run:
        <code-block lang="shell">
        xcode-select --install
        </code-block>
        <h3>Install Homebrew</h3>
        For managing prerequisites on macOS, Homebrew is recommended. Install Homebrew by running:
        <code-block lang="shell">
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
        brew --version
        </code-block>
        <h3 id="MacOS-install-RequiredPackages">Install Required Packages</h3>
        Use Homebrew to install the following packages:
        <code-block lang="shell">
        brew install git curl go@1.22.2 jq libtool node@20 rabbitmq
        </code-block>
        <h3 id="MacOS-install-MongoDB">Install MongoDB</h3>
        Follow the <a href="https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-os-x">MongoDB Community Server for Mac Official Installation Guide.</a> Then, run the following commands:
        <code-block lang="shell">
        brew tap mongodb/brew
        brew update
        brew install mongodb-community
        </code-block>
    </tab>
    <tab  title="Linux" >
        <h3>Update and Upgrade System</h3>
        <code-block lang="shell">
        sudo apt update && sudo apt upgrade -y
        </code-block>
        <h3 id="Linux-install-RequiredPackages">Install Required Packages</h3>
        <code-block lang="shell">
        sudo apt install -y git curl jq libtool gcc g++ make
        </code-block>
        <h3>Install NodeJS</h3>
        <code-block lang="shell">
        # Install nvm (Node Version Manager)
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        # Download and install Node.js (you may need to restart the terminal)
        nvm install 20
        # Verify the right Node.js version is in the environment
        node -v # should print `v20.14.0`        
        # Verify the right NPM version is in the environment
        npm -v # should print `10.7.0` 
        </code-block>
        <h3>Install Golang</h3>
        Follow the <a href="https://go.dev/doc/install">Go Installation Guide.</a> Download <a href="https://go.dev/dl/go1.20.14.linux-amd64.tar.gz">Go 1.20.14 installation file.</a>
        <h3>Install Docker</h3>
        Follow the <a href="https://docs.docker.com/desktop/install/windows-install/#install-docker-desktop-on-windows">Docker Desktop for Windows Official Installation Guide.</a> Download the installation file and run it.
        <h3 id="Linux-install-MongoDB">Install MongoDB</h3>
        Follow the <a href="https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-ubuntu/#std-label-install-mdb-community-ubuntu"> MongoDB Community Edition for Ubuntu Official Installation Guide.</a> Download the installation file and run it.
        <h3>Install RabbitMQ</h3>
        Follow the <a href="https://www.rabbitmq.com/docs/install-debian.html#apt-cloudsmith"> RabbitMQ for Linux Official Installation Guide.</a> Download the installation file and run it.
    </tab>
</tabs>

___

---

***

## Installation Guide

### Download ovote Code

Run the following commands to clone the ovote repository and install dependencies:

```Shell
cd ~
git clone https://github.com/jsoone24/ovote.git

cd ~/ovote/backend-server
npm install

cd ~/ovote/frontend-server
npm install

cd ~/ovote/chaincode
go mod tidy
go mod vendor
```

### Download Hyperledger Fabric

Follow
the [Hyperledger Fabric 2.5 Official Documentation](https://hyperledger-fabric.readthedocs.io/en/release-2.5/prereqs.html)
and [Download Fabric samples, Docker images, and binaries](https://hyperledger-fabric.readthedocs.io/en/release-2.5/install.html).
Then, run:

```Shell
cd ~/ovote
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
./install-fabric.sh d s b
```

## Configuration

### Configure HTTPS SSL Certificates

Generate SSL certificates by running:

```Shell
cd ~/ovote
mkdir certs
cd certs
openssl genrsa -out key.pem 2048
openssl req -new -key key.pem -out csr.pem
openssl x509 -req -days 365 -in csr.pem -signkey key.pem -out cert.pem
```
