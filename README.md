## Ratel Voice Example ( Server and blockchain )
This is a proof of concept for using blockchain incentive to obtain AI data.

You can test entire flow from obtaining data for AI training in exchange for tokens on a ethereum private network to train model to serve service.  

This example is for voice recognition system.
>  you can try it without blockchain parts if you want   
For more information about the idea, please check [website](https://ratelnetwork.com).  

## Features
1. Import texts from epub for data contributors to read out
2. Data contributors can record voice. the voice and meta data is saved on mongodb.
3. Issue token on private ethereum network in exchange for data
4. Train AI model on jupyter notebook
5. Test the model at webstie

## Client web app
For client side scripts, please check [here](https://github.com/kouohhashi/ratel_voice_web_client_example)  

## Demo
Here's a live [demo](https://ratel_voice.grabit.co/)  This is only for testing purpose.

## How to setup this system

### create workspace
```
mkdir workspace
```

### go to the directory
```
cd workspace/
```

## setup private ethereum network (optional)

### requirement
geth (optional only when you want to issue token)  
[How to install geth](https://github.com/ethereum/go-ethereum/wiki/Installation-Instructions-for-Ubuntu)

### create directory for ethereum private network
```
mkdir privatenet
```

### go to the direcotry
```
cd privatenet
```

### create accounts
```
geth account new --datadir ./data
> <address #1>
geth account new --datadir ./data
> <address #2>
geth account new --datadir ./data
> <address #3> (optional)
```

### puppeth
puppeth is a tool to generate a json file to create a genesis block.
```
puppeth
+-----------------------------------------------------------+
| Welcome to puppeth, your Ethereum private network manager |
|                                                           |
| This tool lets you create a new Ethereum network down to  |
| the genesis block, bootnodes, miners and ethstats servers |
| without the hassle that it would normally entail.         |
|                                                           |
| Puppeth uses SSH to dial in to remote servers, and builds |
| its network components out of Docker containers using the |
| docker-compose toolset.                                   |
+-----------------------------------------------------------+

Please specify a network name to administer (no spaces, please)
> ratel_network_demo

What would you like to do? (default = stats)
 1. Show network stats
 2. Configure new genesis
 3. Track new remote server
 4. Deploy network components
> 2

Which consensus engine to use? (default = clique)
 1. Ethash - proof-of-work
 2. Clique - proof-of-authority
> 2

How many seconds should blocks take? (default = 15)
> 5

Which accounts are allowed to seal? (mandatory at least one)
> 0x<address #1>
> 0x

Which accounts should be pre-funded? (advisable at least one)
> 0x<address #1>
> 0x<address #2>
> 0x

Specify your chain/network ID if you want an explicit one (default = random)
>

Anything fun to embed into the genesis block? (max 32 bytes)
>

What would you like to do? (default = stats)
 1. Show network stats
 2. Manage existing genesis
 3. Track new remote server
 4. Deploy network components
> 2

 1. Modify existing fork rules
 2. Export genesis configuration
> 2

Which file to save the genesis into? (default = ratel_network_demo.json)
>
```

### create genesis block
```
geth --datadir ./data init ratel_network_demo.json
```

### start private network
RPC should be running at 127.0.0.1.  
0.0.0.0 is only for testing purpose.
```
nohup geth --datadir ./data --nodiscover --networkid 60263 --rpc --rpcapi db,eth,net,web3,personal,miner,admin --cache=128 --rpcport 8545 --rpcaddr 0.0.0.0 --rpccorsdomain "*" &
```

### start geth console to start mining
```
geth attach http://127.0.0.1:8545
```

### unlock main acccount
```
web3.personal.unlockAccount(web3.eth.accounts[0], <your password>, 0)
```

### start mining
```
miner.start()
```

## Deploy smart contracts (optionall)

### download server scripts which contains server side scripts and smart contracts
At workspace directory,
```
git clone https://github.com/kouohhashi/ratel_voice_server_example.git
```

### go to the directory
```
cd workspace/ratel_voice_server_example/smart_contract
```

### install truffle
```
npm -g install truffle
```

### compile smart contracts
```
truffle compile
```

### deploy contracts
```
truffle migrate
```

### save address of RatelExampleToken and Custodian
Save RatelExampleToken smart contract address and Custodian smart contract address.
```
RatelExampleToken: <RatelExampleToken address>
Custodian: <Custodian address>
```

```
Running migration: 1_initial_migration.js
  Deploying Migrations...
  ... 0x767ca90172567755e77a71e4934b428103035208688bc393f35bd1c92d0e5bda
  Migrations: 0x5d3dc37050617946a3614863f68a66d2ab44562e
Saving successful migration to network...
  ... 0xcb336a73b014a22234f30e59f6c871483ed2faac6af5879685b16bb1c1301e93
Saving artifacts...
Running migration: 2_deploy_contracts.js
  Deploying RatelExampleToken...
  ... 0xfa7a2660df71725f76696201fa31b06e81cf16e324e2a13b609e2201b087c764
  RatelExampleToken: <RatelExampleToken address>
  Deploying Custodian...
  ... 0xd6c257d9fd838c349b10629d3387556421df3ad881250b5dab18d4e600eecb07
  Custodian: <Custodian address>
Saving successful migration to network...
  ... 0x0db5e1e06a842ad4a029e8cf5900b8043ee60497f0370b854156f65043ad623d
Saving artifacts...
```

### set token addresses and an oracle address.
1. open [remix.ethereum.org](http://remix.ethereum.org/)  
2. change rpc server address to your server.  
3. load RatelExampleToken and Custodian by at addresses above.  
4. execute transferCustodian method to update Custodian address.  
5. execute transferMinter to update oracle address.  
6. switch address to oracle address.  
7. unlock oracle address by `web3.personal.unlockAccount(web3.eth.accounts[1], 'your password')`
8. execute mint method to mint enough tokens from oracle address. (example: 1,000,000,000 tokens)

by the way, at current test environment, anyone who knows your RPC server address can access
 your blockchain server. This is not secure at all. we need to run at least 2 nodes and RPC node
 should not be an oracle or a sealer.  

## Setup server side  

### requirement

mongodb
```
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/3.6 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.6.list
sudo apt-get update
sudo apt-get install mongodb-org
sudo service mongod start
```

anaconda
```
cd /tmp/
curl -O https://repo.continuum.io/archive/Anaconda3-5.0.1-Linux-x86_64.sh
bash Anaconda3-5.0.1-Linux-x86_64.sh
```

avconv
```
sudo apt install libav-tools
```

tensorflow
```
pip install tensorflow
pip install -r requirements.txt
```
requirements.txt is located at workspace/ratel_voice_server_example/jupyter  


## server side


### download server scripts if you haven't at smart contracts section  
At workspace directory,
```
git clone https://github.com/kouohhashi/ratel_voice_server_example.git
```


### move to ratel_voice_server_example directory
```
cd workspace/ratel_voice_server_example
```

### install npm modules
```
npm install
```

### create setting.js
```
cp server/routes/settings_example.js server/routes/settings.js
vi server/routes/settings.js
```

### init database
```
npm run init_db
```

### start server
```
npm run server
```

### train AI model
before train AI model, you need data. you can add data from client. you can test client scripts [here](https://github.com/kouohhashi/ratel_voice_web_client_example)

### go tu jupyter
```
cd jupyter/
```


### create environment
```
conda create --name aind-vui python=3.5 numpy
source activate aind-vui
pip install tensorflow
pip install -r requirements.txt
KERAS_BACKEND=tensorflow python -c "from keras import backend"
jupyter notebook --ip=0.0.0.0 --no-browser
```

### Node version
node v8.9.1

### Tech stack
- Ethereum blockchain
- Node
- Tensorflow/Keras
- MongoDB

## Todo  
- Should separate blockchain part and node server part.
- Easy Install
- Use distributed storage like IPFS
- Adopt many languages.
- Adopt other no voice recognition AI project  
- Feature to share data with other AI projects

## License  
MIT. You can do whatever you want.  
